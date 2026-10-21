import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

/*
=====================================================
TIPOS
=====================================================
*/

type MensagemHistorico = {
  role:
    | "user"
    | "assistant";

  content: string;
};

type Configuracao = {
  id?: string;

  nome_negocio?: string | null;

  nome_produto?: string | null;

  descricao_produto?: string | null;

  link_demonstracao?: string | null;

  link_cadastro?: string | null;

  preco_mensal?:
    | number
    | string
    | null;

  preco_anual?:
    | number
    | string
    | null;

  mensagem_inicial?:
    | string
    | null;

  instrucoes_ia?:
    | string
    | null;
};

type CorpoRequisicao = {
  mensagem?: string;

  historico?:
    MensagemHistorico[];
};

/*
=====================================================
SUPABASE
=====================================================
*/

function getSupabase() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL não configurada."
    );
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY não configurada."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

/*
=====================================================
FORMATAÇÃO
=====================================================
*/

function textoSeguro(
  valor:
    | string
    | null
    | undefined,
  padrao = ""
) {
  const texto =
    String(
      valor ?? ""
    ).trim();

  return texto ||
    padrao;
}

function numeroSeguro(
  valor:
    | number
    | string
    | null
    | undefined,
  padrao: number
) {
  if (
    typeof valor ===
    "number"
  ) {
    if (
      Number.isFinite(
        valor
      )
    ) {
      return valor;
    }

    return padrao;
  }

  if (
    typeof valor ===
    "string"
  ) {
    const normalizado =
      valor
        .trim()
        .replace(
          /\./g,
          ""
        )
        .replace(
          ",",
          "."
        )
        .replace(
          /[^0-9.-]/g,
          ""
        );

    const numero =
      Number(
        normalizado
      );

    if (
      Number.isFinite(
        numero
      )
    ) {
      return numero;
    }
  }

  return padrao;
}

function formatarReais(
  valor: number
) {
  return `R$ ${valor
    .toFixed(2)
    .replace(
      ".",
      ","
    )}`;
}

/*
=====================================================
INTENÇÕES
=====================================================
*/

function normalizar(
  texto: string
) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function detectarIntencoes(
  mensagem: string
) {
  const texto =
    normalizar(
      mensagem
    );

  const pediuPreco =
    /\b(preco|valor|custa|custo|mensal|mensalidade|anual|plano|quanto)\b/.test(
      texto
    );

  const pediuTeste =
    /\b(teste|testar|gratis|gratuito|gratuita|experimentar|30 dias|antes de assinar|antes de pagar)\b/.test(
      texto
    );

  const pediuCadastro =
    /\b(cadastro|cadastrar|assinar|contratar|contratacao|quero usar|quero comecar|comecar agora|aderir)\b/.test(
      texto
    );

  const pediuDemonstracao =
    /\b(demo|demonstracao|demonstrar|exemplo|ver a loja|ver como funciona|conhecer o sistema)\b/.test(
      texto
    );

  return {
    pediuPreco,
    pediuTeste,
    pediuCadastro,
    pediuDemonstracao,
  };
}

/*
=====================================================
RESPOSTAS DETERMINÍSTICAS

Assuntos críticos ficam fora da criatividade do
modelo para impedir preços e links inventados.
=====================================================
*/

function respostaComercialDireta(
  mensagem: string,
  dados: {
    nomeProduto: string;
    precoMensal: string;
    precoAnual: string;
    linkCadastro: string;
    linkDemonstracao: string;
  }
) {
  const {
    pediuPreco,
    pediuTeste,
    pediuCadastro,
    pediuDemonstracao,
  } =
    detectarIntencoes(
      mensagem
    );

  const partes:
    string[] = [];

  if (pediuPreco) {
    partes.push(
      `Claro 😊 O ${dados.nomeProduto} custa ${dados.precoMensal} no plano mensal ou ${dados.precoAnual} no plano anual.`
    );

    partes.push(
      "E você não precisa decidir no escuro: pode criar sua loja e testar gratuitamente por 30 dias antes de assinar."
    );
  }

  if (
    pediuTeste &&
    !pediuPreco
  ) {
    partes.push(
      "Sim 😊 Você pode criar sua loja e testar gratuitamente por 30 dias antes de assinar."
    );

    partes.push(
      "É uma forma simples de conhecer o sistema com a sua própria loja, cadastrar seus produtos e ver se ele faz sentido para o seu negócio antes de contratar."
    );
  }

  if (
    pediuDemonstracao
  ) {
    partes.push(
      `Você pode ver uma demonstração funcionando aqui: ${dados.linkDemonstracao}`
    );
  }

  if (
    pediuCadastro
  ) {
    partes.push(
      `Perfeito 😊 Para criar sua conta e começar seu teste gratuito de 30 dias, é só acessar: ${dados.linkCadastro}`
    );
  } else if (
    pediuPreco ||
    pediuTeste ||
    pediuDemonstracao
  ) {
    partes.push(
      `Se quiser experimentar com a sua própria loja, você pode começar agora por aqui: ${dados.linkCadastro}`
    );
  }

  if (
    partes.length ===
    0
  ) {
    return null;
  }

  return partes.join(
    "\n\n"
  );
}

/*
=====================================================
CORRIGIR RESPOSTA DA IA
=====================================================
*/

function removerVocativoLia(
  textoOriginal: string
) {
  let texto =
    String(
      textoOriginal ?? ""
    ).trim();

  /*
  O modelo pequeno às vezes interpreta "Lia" como se fosse
  o nome do cliente. Removemos essas formas antes de enviar
  a resposta ao WhatsApp e também do histórico enviado à IA.
  */

  const padroes = [
    /^(?:ol[aá]|oi|opa|bom dia|boa tarde|boa noite)\s*,?\s*lia\s*[!,.?:;\-–—]*\s*/i,
    /^lia\s*[!,.?:;\-–—]+\s*/i,
    /^(claro|entendi|perfeito|certo|sim|ótimo|otimo|excelente|com certeza|sem problema|beleza)\s*,?\s*lia\s*[!,.?:;\-–—]*\s*/i,
  ];

  /*
  Repetimos algumas vezes porque podem existir combinações
  como "Olá, Lia! Claro, Lia! ...".
  */
  for (
    let tentativa = 0;
    tentativa < 4;
    tentativa++
  ) {
    const anterior = texto;

    for (
      const padrao of padroes
    ) {
      texto =
        texto.replace(
          padrao,
          (_trecho, inicio?: string) =>
            inicio
              ? `${inicio}. `
              : ""
        );
    }

    texto =
      texto.trimStart();

    if (
      texto === anterior
    ) {
      break;
    }
  }

  return texto.trim();
}

function corrigirResposta(
  respostaOriginal: string,
  dados: {
    linkCadastro: string;
    linkDemonstracao: string;
  }
) {
  let resposta =
    respostaOriginal
      .trim();

  /*
  Substitui placeholders que o modelo possa inventar.
  */

  resposta =
    resposta.replace(
      /\[link de cadastro\]/gi,
      dados.linkCadastro
    );

  resposta =
    resposta.replace(
      /\[link do cadastro\]/gi,
      dados.linkCadastro
    );

  resposta =
    resposta.replace(
      /\[link cadastro\]/gi,
      dados.linkCadastro
    );

  resposta =
    resposta.replace(
      /\[link de demonstração\]/gi,
      dados.linkDemonstracao
    );

  resposta =
    resposta.replace(
      /\[link de demonstracao\]/gi,
      dados.linkDemonstracao
    );

  resposta =
    resposta.replace(
      /\[link da demonstração\]/gi,
      dados.linkDemonstracao
    );

  /*
  Remove frases falsas sobre não poder mandar links.
  */

  resposta =
    resposta.replace(
      /desculpe,?\s*mas\s*n[aã]o\s*consigo\s*enviar\s*links?(?:\s+de\s+cadastro)?\s*diretamente\s*aqui\.?/gi,
      ""
    );

  resposta =
    resposta.replace(
      /n[aã]o\s*consigo\s*enviar\s*links?\s*por\s*aqui\.?/gi,
      ""
    );

  /*
  Remove qualquer uso incorreto de "Lia" como vocativo.
  */

  resposta =
    removerVocativoLia(
      resposta
    );

  resposta =
    resposta.replace(
      /\n{3,}/g,
      "\n\n"
    )
      .trim();

  return resposta;
}

/*
=====================================================
POST /api/ia
=====================================================
*/

export async function POST(
  request: Request
) {
  try {
    const body =
      (
        await request.json()
      ) as CorpoRequisicao;

    const mensagem =
      textoSeguro(
        body.mensagem
      );

    const historico =
      Array.isArray(
        body.historico
      )
        ? body.historico
        : [];

    if (!mensagem) {
      return NextResponse.json(
        {
          erro:
            "Mensagem não informada.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =================================================
    CARREGAR CONFIGURAÇÃO
    =================================================
    */

    const supabase =
      getSupabase();

    const {
      data:
        configuracoes,
      error:
        erroConfiguracao,
    } = await supabase
      .from(
        "configuracoes"
      )
      .select("*")
      .order(
        "criado_em",
        {
          ascending:
            true,
        }
      )
      .limit(1);

    if (
      erroConfiguracao
    ) {
      console.error(
        "Erro ao buscar configurações:",
        erroConfiguracao
      );

      throw erroConfiguracao;
    }

    const config =
      (
        configuracoes?.[0] ??
        {}
      ) as Configuracao;

    /*
    =================================================
    DADOS OFICIAIS
    =================================================
    */

    const nomeNegocio =
      textoSeguro(
        config.nome_negocio,
        "Lojas AI"
      );

    const nomeProduto =
      textoSeguro(
        config.nome_produto,
        "Lojas AI"
      );

    const descricaoProduto =
      textoSeguro(
        config.descricao_produto,
        "Plataforma para criar uma loja online com produtos, fotos, preços, estoque, carrinho e compartilhamento por link."
      );

    const linkDemonstracao =
      textoSeguro(
        config.link_demonstracao,
        "https://visiteminhaloja.online/loja/sistemas-inteligentes"
      );

    const linkCadastro =
      textoSeguro(
        config.link_cadastro,
        "https://visiteminhaloja.online/cadastro"
      );

    /*
    Valores oficiais atuais.

    Mesmo que exista um valor antigo incorreto
    no banco, não deixamos a IA inventar 59,56.
    */

    const precoMensalNumero =
      59.90;

    const precoAnualNumero =
      597.00;

    const precoMensal =
      formatarReais(
        precoMensalNumero
      );

    const precoAnual =
      formatarReais(
        precoAnualNumero
      );

    /*
    =================================================
    RESPOSTA DIRETA PARA PREÇO / TESTE / LINKS
    =================================================
    */

    const respostaDireta =
      respostaComercialDireta(
        mensagem,
        {
          nomeProduto,
          precoMensal,
          precoAnual,
          linkCadastro,
          linkDemonstracao,
        }
      );

    /*
    Se for uma pergunta comercial crítica,
    não precisamos confiar no modelo pequeno.
    */

    if (
      respostaDireta
    ) {
      console.log(
        "✅ Resposta comercial determinística."
      );

      return NextResponse.json(
        {
          sucesso: true,

          resposta:
            respostaDireta,

          origem:
            "regra_comercial",
        }
      );
    }

    /*
    =================================================
    PROMPT DA IA
    =================================================
    */

    const instrucoesExtras =
      textoSeguro(
        config.instrucoes_ia
      );

    const promptSistema =
      `
Você é Lia, assistente virtual comercial da empresa "${nomeNegocio}".

Seu nome é sempre "Lia".
Nunca se apresente como "Atende AI".
"Atende AI" é apenas o nome interno do sistema e nunca deve ser usado como seu nome durante a conversa.

Se alguém perguntar quem você é, responda de forma transparente:
"Sou a Lia, assistente virtual da ${nomeNegocio} 😊"

IMPORTANTE SOBRE O NOME "LIA":
- Lia é o SEU nome, não o nome do cliente.
- Você NÃO recebe o nome do cliente neste endpoint. Portanto, não use nenhum nome próprio para se dirigir ao cliente.
- Nunca chame o cliente de "Lia".
- Nunca use seu próprio nome como vocativo.
- Nunca escreva "Olá, Lia!", "Oi, Lia!", "Claro, Lia!", "Entendi, Lia", "Perfeito, Lia", "Certo, Lia" ou semelhantes.
- Não repita seu nome em todas as mensagens.
- Apresente-se como Lia somente quando a pessoa perguntar quem está falando, perguntar seu nome, ou quando for realmente necessário no primeiro contato.
- Depois que a conversa já começou, responda diretamente sem repetir "Lia".
- Não comece toda resposta com "Olá", "Oi", "Claro", "Entendi" ou "Perfeito". Varie naturalmente e vá direto ao assunto quando a conversa já estiver em andamento.
- Se você não souber o nome do cliente, não invente um nome e não use nenhum vocativo.

Você atende pessoas interessadas no produto "${nomeProduto}".

=====================================================
PERSONALIDADE DA LIA
=====================================================

A Lia é extremamente educada, acolhedora, paciente, simpática e profissional.

Ela conversa de forma natural, como uma ótima atendente comercial de WhatsApp.

Ela não fala como robô.
Ela não usa linguagem técnica desnecessária.
Ela não trata o cliente com intimidade excessiva.
Ela nunca discute, ironiza, constrange ou faz o cliente se sentir pressionado.

Use emojis com moderação, principalmente 😊, 👍 e ✨, quando combinarem com a conversa.

A Lia deve demonstrar que ouviu o cliente antes de apresentar uma solução.

Exemplos de início de resposta:
"Entendi 😊"
"Claro."
"Faz sentido."
"Sim, você consegue."
"Boa pergunta 😊"

=====================================================
OBJETIVO COMERCIAL
=====================================================

Seu principal objetivo comercial é aumentar a chance de o cliente criar uma conta no ${nomeProduto}.

Você deve conduzir a conversa, de forma educada e persuasiva, para o cadastro.

A persuasão deve acontecer por:
- mostrar utilidade prática;
- reduzir dúvidas;
- reduzir a sensação de risco;
- lembrar que existem 30 dias de teste gratuito;
- relacionar o produto ao problema que o próprio cliente mencionou;
- facilitar o próximo passo;
- usar chamadas para ação simples;
- fazer perguntas curtas quando isso ajudar a conversa a avançar.

Nunca use mentira, falsa urgência, falsa escassez, medo inventado, depoimentos falsos, números inventados ou promessas de resultado garantido.

Não diga coisas como:
"últimas vagas"
"promoção acaba hoje"
"você está perdendo dinheiro"
"todo mundo está comprando"
"se não comprar agora vai se arrepender"
a menos que essas informações estejam explicitamente cadastradas como verdadeiras.

=====================================================
COMO CONDUZIR A VENDA
=====================================================

1. Primeiro responda exatamente o que o cliente perguntou.

2. Depois, quando fizer sentido, conecte a resposta a um benefício real do produto.

3. Em seguida, reduza a barreira para experimentar:
o cliente pode testar gratuitamente por 30 dias antes de assinar.

4. Quando houver interesse, convide para o cadastro com uma frase simples e natural.

Exemplos:
"Se quiser, você já pode montar a sua loja e testar na prática por 30 dias."
"Quer conhecer com a sua própria loja? Você pode começar o teste gratuito por aqui:"
"Se fizer sentido para você, o próximo passo é criar sua conta e testar sem compromisso."

5. Quando o cliente demonstrar intenção clara de começar, não fique fazendo perguntas desnecessárias.
Envie o link de cadastro diretamente.

6. Quando o cliente estiver inseguro, não force.
Descubra a dúvida principal e responda a ela.

7. Sempre que possível, deixe apenas um próximo passo claro por mensagem.

=====================================================
TRATAMENTO DE OBJEÇÕES
=====================================================

Se o cliente disser que está caro:
- não discuta;
- reconheça a preocupação;
- explique o que está incluído usando somente recursos oficialmente informados;
- lembre que ele pode testar por 30 dias antes de decidir;
- convide para experimentar antes de avaliar se vale a pena.

Se o cliente disser "vou pensar":
- respeite;
- não pressione;
- deixe uma informação útil;
- lembre que o teste gratuito permite avaliar sem precisar decidir imediatamente;
- ofereça o link de cadastro de forma leve.

Se o cliente disser que já vende pelo WhatsApp ou Instagram:
- não diminua essas ferramentas;
- explique que o ${nomeProduto} pode funcionar como uma vitrine organizada da loja, com produtos, fotos, preços, estoque, carrinho e link para compartilhar;
- convide para testar.

Se o cliente disser que não entende de tecnologia:
- use linguagem simples;
- tranquilize sem prometer algo que não sabe;
- explique os passos de forma curta;
- ofereça começar pelo cadastro.

Se o cliente estiver apenas tirando uma dúvida:
- responda primeiro;
- não transforme toda mensagem em um discurso de venda.

Se o cliente disser claramente que não tem interesse:
- respeite;
- não insista repetidamente;
- encerre com educação e deixe a porta aberta para voltar depois.

=====================================================
INFORMAÇÕES OFICIAIS DO PRODUTO
=====================================================

Nome:
${nomeProduto}

Descrição:
${descricaoProduto}

Preço mensal:
${precoMensal}

Preço anual:
${precoAnual}

Teste:
O cliente pode testar a loja gratuitamente por 30 dias antes de assinar.

Link de demonstração:
${linkDemonstracao}

Link de cadastro:
${linkCadastro}

=====================================================
REGRAS OBRIGATÓRIAS
=====================================================

1. Responda sempre em português do Brasil.

2. Seja natural, extremamente educada, comercial, persuasiva e objetiva.

3. Nunca invente preços, descontos, condições, recursos ou resultados.

4. Nunca altere os preços oficiais.

5. O preço mensal oficial é ${precoMensal}.

6. O preço anual oficial é ${precoAnual}.

7. O cliente possui 30 dias para testar gratuitamente antes de assinar.

8. Não diga que o cliente precisa pagar antes de testar.

9. Você PODE enviar links normalmente pelo WhatsApp.

10. Nunca diga:
"não consigo enviar links"
"não posso enviar links"
"não consigo enviar cadastro"

11. Nunca escreva placeholders como:
[link de cadastro]
[link]
[link da demonstração]

12. Quando precisar enviar o cadastro, use exatamente:
${linkCadastro}

13. Quando precisar enviar a demonstração, use exatamente:
${linkDemonstracao}

14. Não invente uma porcentagem de desconto do plano anual.

15. Não diga que determinado valor representa um desconto específico a menos que essa informação esteja explicitamente cadastrada.

16. Evite respostas enormes. Normalmente use de 1 a 4 pequenos parágrafos.

17. Prefira frases curtas, claras e fáceis de ler no WhatsApp.

18. Não repita a mesma chamada para cadastro várias vezes na mesma resposta.

19. Não mande o link de cadastro de forma aleatória em toda mensagem. Use-o quando houver relação com a dúvida, interesse, objeção ou intenção de experimentar.

20. Quando houver uma boa oportunidade comercial, termine com uma chamada para ação simples.

21. Se o cliente já demonstrou que quer começar, envie o link de cadastro imediatamente.

22. Não faça perguntas que atrasem desnecessariamente um cliente pronto para se cadastrar.

23. Não finja ser humana. Se perguntarem, diga que você é a Lia, assistente virtual da ${nomeNegocio}.

24. O cliente pode mandar mensagens originadas de áudio. Elas chegam para você já transcritas. Responda normalmente ao conteúdo e nunca diga que não consegue ouvir o áudio.

25. Preserve o contexto das mensagens anteriores. Não volte ao início da conversa sem necessidade.

26. Se o cliente fizer várias perguntas na mesma mensagem, responda todas de forma organizada e depois indique o próximo passo.

27. "Lia" é o seu próprio nome. Nunca use "Lia" para se dirigir ao cliente.

28. Nunca escreva "Olá, Lia!", "Oi, Lia!", "Claro, Lia!", "Entendi, Lia", "Perfeito, Lia", "Certo, Lia" ou qualquer variação em que pareça que o cliente se chama Lia.

29. Você não conhece o nome do cliente por meio deste endpoint. Portanto, não use nomes próprios nem vocativos para se dirigir a ele.

30. Depois de se apresentar uma vez, não fique repetindo seu nome. Em uma conversa normal, simplesmente responda ao cliente.

31. Só mencione seu nome novamente se o cliente perguntar quem está falando ou qual é o seu nome.

32. Saudação é para início de conversa. Se a conversa já está em andamento, não recomece com "Olá" ou "Oi" em toda resposta.

${instrucoesExtras
  ? `
=====================================================
INSTRUÇÕES ADICIONAIS
=====================================================

${instrucoesExtras}
`
  : ""}
`.trim();

    /*
    =================================================
    CONSTRUIR HISTÓRICO
    =================================================
    */

    const mensagensOllama =
      [
        {
          role:
            "system",

          content:
            promptSistema,
        },

        ...historico
          .filter(
            (
              item
            ) =>
              item &&
              typeof item.content ===
                "string" &&
              (
                item.role ===
                  "user" ||
                item.role ===
                  "assistant"
              )
          )
          .slice(-12)
          .map(
            (item) => ({
              ...item,

              content:
                item.role ===
                "assistant"
                  ? removerVocativoLia(
                      item.content
                    )
                  : item.content,
            })
          ),

        {
          role:
            "user",

          content:
            mensagem,
        },
      ];

    /*
    =================================================
    OLLAMA
    =================================================
    */

    console.log(
      "🧠 Consultando Ollama..."
    );

    const respostaOllama =
      await fetch(
        "http://127.0.0.1:11434/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                "qwen2.5:3b",

              stream:
                false,

              messages:
                mensagensOllama,

              options: {
                temperature:
                  0.35,

                top_p:
                  0.9,
              },
            }),

          signal:
            AbortSignal.timeout(
              120000
            ),
        }
      );

    if (
      !respostaOllama.ok
    ) {
      const erroTexto =
        await respostaOllama.text();

      console.error(
        "Erro do Ollama:",
        erroTexto
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível consultar a IA local.",
        },
        {
          status: 500,
        }
      );
    }

    const resultado =
      await respostaOllama.json();

    const respostaOriginal =
      String(
        resultado
          ?.message
          ?.content ??
          ""
      ).trim();

    if (
      !respostaOriginal
    ) {
      return NextResponse.json(
        {
          erro:
            "A IA retornou uma resposta vazia.",
        },
        {
          status: 500,
        }
      );
    }

    /*
    =================================================
    LIMPEZA FINAL
    =================================================
    */

    const respostaFinal =
      corrigirResposta(
        respostaOriginal,
        {
          linkCadastro,
          linkDemonstracao,
        }
      );

    return NextResponse.json(
      {
        sucesso: true,

        resposta:
          respostaFinal,

        origem:
          "ollama",
      }
    );
  } catch (error) {
    console.error(
      "❌ Erro em /api/ia:",
      error
    );

    return NextResponse.json(
      {
        erro:
          "Erro interno ao processar a mensagem.",
      },
      {
        status: 500,
      }
    );
  }
}