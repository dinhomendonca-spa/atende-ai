import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type StatusLead =
  | "novo"
  | "conversando"
  | "demonstracao"
  | "negociacao"
  | "cliente"
  | "perdido";

function getSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

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
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/*
=====================================================
ORDEM DO FUNIL
=====================================================
*/

const ordemStatus: Record<StatusLead, number> = {
  novo: 0,
  conversando: 1,
  demonstracao: 2,
  negociacao: 3,
  cliente: 4,
  perdido: -1,
};

/*
=====================================================
NORMALIZAR TEXTO
=====================================================
*/

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/*
=====================================================
DETECÇÃO DIRETA DE INTENÇÃO

Essas regras têm prioridade sobre a IA.
=====================================================
*/

function detectarStatusDireto(
  mensagem: string
): StatusLead | null {
  const texto =
    normalizarTexto(mensagem);

  /*
  ===================================================
  CLIENTE
  A pessoa confirma que já contratou/pagou/assinou.
  ===================================================
  */

  const frasesCliente = [
    "ja assinei",
    "assinei o sistema",
    "ja contratei",
    "contratei o sistema",
    "ja paguei",
    "pagamento feito",
    "pagamento realizado",
    "ja fiz o pagamento",
    "acabei de pagar",
    "acabei de assinar",
    "cadastro concluido",
    "ja fiz meu cadastro e assinei",
    "ja estou usando",
    "ja sou cliente",
  ];

  if (
    frasesCliente.some((frase) =>
      texto.includes(frase)
    )
  ) {
    return "cliente";
  }

  /*
  ===================================================
  PERDIDO
  Recusa clara.
  ===================================================
  */

  const frasesPerdido = [
    "nao tenho interesse",
    "nao quero contratar",
    "nao quero assinar",
    "nao quero o sistema",
    "nao me interessa",
    "nao tenho interesse agora",
    "pare de me chamar",
    "nao quero receber mensagens",
    "pode encerrar",
  ];

  if (
    frasesPerdido.some((frase) =>
      texto.includes(frase)
    )
  ) {
    return "perdido";
  }

  /*
  ===================================================
  NEGOCIAÇÃO
  Intenção clara de contratar ou entender pagamento.
  ===================================================
  */

  const frasesNegociacao = [
    "quero contratar",
    "como faco para contratar",
    "como faço para contratar",
    "quero assinar",
    "como faco para assinar",
    "como faço para assinar",
    "onde eu pago",
    "como faco o pagamento",
    "como faço o pagamento",
    "forma de pagamento",
    "formas de pagamento",
    "aceita pix",
    "aceita cartao",
    "aceita cartão",
    "quero comecar",
    "quero começar",
    "como faco para comecar",
    "como faço para começar",
    "quero criar minha loja",
    "manda o link de cadastro",
    "me manda o link de cadastro",
    "link para contratar",
    "link para assinar",
    "link para pagamento",
  ];

  if (
    frasesNegociacao.some((frase) =>
      texto.includes(
        normalizarTexto(frase)
      )
    )
  ) {
    return "negociacao";
  }

  /*
  Uma mensagem contendo preço + intenção de contratação
  também é negociação.
  */

  const mencionaPreco =
    texto.includes("quanto custa") ||
    texto.includes("qual o valor") ||
    texto.includes("preco") ||
    texto.includes("mensalidade") ||
    texto.includes("plano");

  const mencionaContratacao =
    texto.includes("contratar") ||
    texto.includes("assinar") ||
    texto.includes("comecar") ||
    texto.includes("cadastro") ||
    texto.includes("pagamento");

  if (
    mencionaPreco &&
    mencionaContratacao
  ) {
    return "negociacao";
  }

  /*
  ===================================================
  DEMONSTRAÇÃO
  ===================================================
  */

  const frasesDemonstracao = [
    "quero ver uma demonstracao",
    "posso ver uma demonstracao",
    "ver demonstracao",
    "quero ver a demo",
    "posso ver a demo",
    "manda a demo",
    "quero conhecer o sistema",
    "posso conhecer o sistema",
    "quero ver o sistema",
    "ver como funciona",
    "mostrar como funciona",
    "me mostra o sistema",
  ];

  if (
    frasesDemonstracao.some((frase) =>
      texto.includes(
        normalizarTexto(frase)
      )
    )
  ) {
    return "demonstracao";
  }

  return null;
}

/*
=====================================================
CLASSIFICAÇÃO COM IA

Usada apenas quando as regras acima não conseguem
identificar claramente a etapa.
=====================================================
*/

async function classificarLeadComIA(
  mensagens: {
    autor: string;
    conteudo: string;
  }[],
  mensagemAtual: string
): Promise<StatusLead | null> {
  try {
    const historico = mensagens
      .map((mensagem) => {
        const autor =
          mensagem.autor === "cliente"
            ? "CLIENTE"
            : "ATENDENTE";

        return `${autor}: ${mensagem.conteudo}`;
      })
      .join("\n");

    const resposta = await fetch(
      "http://127.0.0.1:11434/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: "qwen2.5:3b",

          stream: false,

          messages: [
            {
              role: "system",

              content: `
Você classifica leads comerciais do SaaS Lojas AI.

Você deve identificar a ETAPA ATUAL do cliente.

Dê prioridade máxima à MENSAGEM MAIS RECENTE DO CLIENTE.

Responda SOMENTE com uma destas palavras:

novo
conversando
demonstracao
negociacao
cliente
perdido

DEFINIÇÕES:

novo:
Ainda não houve conversa comercial relevante.

conversando:
O cliente está conhecendo o sistema, explicando seu negócio ou fazendo perguntas gerais.

demonstracao:
O cliente pediu para ver, testar, conhecer ou receber uma demonstração do sistema.

negociacao:
O cliente demonstra intenção de comprar ou contratar.
Inclui perguntas sobre como contratar, como assinar, pagamento, cadastro para começar ou condições de contratação.

cliente:
Somente quando a pessoa confirma claramente que já assinou, contratou, pagou ou concluiu a contratação.

perdido:
Somente quando há recusa clara ou pedido para não continuar o contato.

REGRAS IMPORTANTES:

- A conversa pode avançar de etapa.
- Não fique preso a uma etapa antiga.
- Se anteriormente pediu demonstração, mas agora pergunta como contratar, use negociacao.
- Se agora informa que já pagou ou assinou, use cliente.
- Uma pergunta simples de preço sem intenção de contratação pode continuar como conversando.
- Responda somente com a palavra do status.
`,
            },

            {
              role: "user",

              content: `
HISTÓRICO DA CONVERSA:

${historico}

MENSAGEM MAIS RECENTE DO CLIENTE:

${mensagemAtual}

Qual é a etapa atual?
`,
            },
          ],

          options: {
            temperature: 0,
          },
        }),
      }
    );

    if (!resposta.ok) {
      console.error(
        "Erro ao classificar lead no Ollama."
      );

      return null;
    }

    const resultado =
      await resposta.json();

    const texto =
      normalizarTexto(
        resultado?.message?.content ?? ""
      );

    const candidatos: StatusLead[] = [
      "cliente",
      "negociacao",
      "demonstracao",
      "conversando",
      "perdido",
      "novo",
    ];

    for (const candidato of candidatos) {
      if (
        texto.includes(candidato)
      ) {
        return candidato;
      }
    }

    return null;
  } catch (error) {
    console.error(
      "Erro durante classificação:",
      error
    );

    return null;
  }
}

/*
=====================================================
ATUALIZAR STATUS DO LEAD
=====================================================
*/

async function atualizarStatusLead(
  conversaId: string,
  mensagemAtual: string
) {
  const supabase =
    getSupabase();

  /*
  Descobre o lead da conversa.
  */

  const {
    data: conversa,
    error: erroConversa,
  } = await supabase
    .from("conversas")
    .select("lead_id")
    .eq(
      "id",
      conversaId
    )
    .single();

  if (
    erroConversa ||
    !conversa
  ) {
    console.error(
      "Não foi possível localizar o lead:",
      erroConversa
    );

    return null;
  }

  /*
  Busca status atual.
  */

  const {
    data: lead,
    error: erroLead,
  } = await supabase
    .from("leads")
    .select("id, status")
    .eq(
      "id",
      conversa.lead_id
    )
    .single();

  if (
    erroLead ||
    !lead
  ) {
    console.error(
      "Não foi possível buscar o lead:",
      erroLead
    );

    return null;
  }

  const statusAtual =
    lead.status as StatusLead;

  /*
  Cliente confirmado não deve regredir.
  */

  if (
    statusAtual === "cliente"
  ) {
    return "cliente";
  }

  /*
  PRIMEIRO:
  tenta identificar diretamente pela mensagem atual.
  */

  let statusSugerido =
    detectarStatusDireto(
      mensagemAtual
    );

  /*
  SEGUNDO:
  se não encontrou uma intenção clara,
  pede ajuda à IA.
  */

  if (!statusSugerido) {
    const {
      data: mensagens,
      error: erroMensagens,
    } = await supabase
      .from("mensagens")
      .select(
        "autor, conteudo, criada_em"
      )
      .eq(
        "conversa_id",
        conversaId
      )
      .order(
        "criada_em",
        {
          ascending: false,
        }
      )
      .limit(12);

    if (erroMensagens) {
      console.error(
        "Erro ao buscar histórico:",
        erroMensagens
      );

      return statusAtual;
    }

    const historico =
      [...(mensagens ?? [])]
        .reverse()
        .map((mensagem) => ({
          autor:
            mensagem.autor,

          conteudo:
            mensagem.conteudo,
        }));

    statusSugerido =
      await classificarLeadComIA(
        historico,
        mensagemAtual
      );
  }

  /*
  Se houve mensagem de cliente e ainda assim
  a classificação for novo/nula, vira conversando.
  */

  if (
    !statusSugerido ||
    statusSugerido === "novo"
  ) {
    statusSugerido =
      "conversando";
  }

 let novoStatus: StatusLead =
  statusAtual;

  /*
  Recusa explícita.
  */

  if (
    statusSugerido === "perdido"
  ) {
    novoStatus =
      "perdido";
  } else if (
    statusAtual === "perdido"
  ) {
    /*
    Lead perdido pode voltar ao funil
    se iniciar nova conversa.
    */

    novoStatus =
      statusSugerido;
  } else {
    /*
    Normalmente o funil só avança.
    */

    const posicaoAtual =
      ordemStatus[
        statusAtual
      ] ?? 0;

    const posicaoNova =
      ordemStatus[
        statusSugerido
      ] ?? 0;

    if (
      posicaoNova >
      posicaoAtual
    ) {
      novoStatus =
        statusSugerido;
    }
  }

  /*
  Salva no banco.
  */

  const {
    error: erroAtualizacao,
  } = await supabase
    .from("leads")
    .update({
      status:
        novoStatus,

      ultimo_contato_em:
        new Date().toISOString(),
    })
    .eq(
      "id",
      lead.id
    );

  if (erroAtualizacao) {
    console.error(
      "Erro ao atualizar status:",
      erroAtualizacao
    );

    return statusAtual;
  }

  console.log(
    `Lead ${lead.id}: ${statusAtual} -> ${novoStatus}`
  );

  return novoStatus;
}

/*
=====================================================
GET /api/conversas?lead_id=UUID
=====================================================
*/

export async function GET(
  request: NextRequest
) {
  try {
    const leadId =
      request.nextUrl.searchParams.get(
        "lead_id"
      );

    if (!leadId) {
      return NextResponse.json(
        {
          erro:
            "lead_id é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getSupabase();

    const {
      data: lead,
      error: erroLead,
    } = await supabase
      .from("leads")
      .select("*")
      .eq(
        "id",
        leadId
      )
      .maybeSingle();

    if (erroLead) {
      console.error(
        "Erro ao buscar lead:",
        erroLead
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível buscar o lead.",
        },
        {
          status: 500,
        }
      );
    }

    if (!lead) {
      return NextResponse.json(
        {
          erro:
            "Lead não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: conversaExistente,
      error: erroConversa,
    } = await supabase
      .from("conversas")
      .select("*")
      .eq(
        "lead_id",
        leadId
      )
      .neq(
        "status",
        "finalizada"
      )
      .order(
        "criado_em",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (erroConversa) {
      console.error(
        "Erro ao buscar conversa:",
        erroConversa
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível buscar a conversa.",
        },
        {
          status: 500,
        }
      );
    }

    let conversa =
      conversaExistente;

    if (!conversa) {
      const {
        data: novaConversa,
        error: erroCriacao,
      } = await supabase
        .from("conversas")
        .insert({
          lead_id:
            leadId,

          canal:
            "manual",

          status:
            "aberta",
        })
        .select()
        .single();

      if (erroCriacao) {
        console.error(
          "Erro ao criar conversa:",
          erroCriacao
        );

        return NextResponse.json(
          {
            erro:
              "Não foi possível criar a conversa.",
          },
          {
            status: 500,
          }
        );
      }

      conversa =
        novaConversa;
    }

    const {
      data: mensagens,
      error: erroMensagens,
    } = await supabase
      .from("mensagens")
      .select("*")
      .eq(
        "conversa_id",
        conversa.id
      )
      .order(
        "criada_em",
        {
          ascending: true,
        }
      );

    if (erroMensagens) {
      console.error(
        "Erro ao buscar mensagens:",
        erroMensagens
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível carregar as mensagens.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      sucesso: true,
      lead,
      conversa,
      mensagens:
        mensagens ?? [],
    });
  } catch (error) {
    console.error(
      "Erro interno:",
      error
    );

    return NextResponse.json(
      {
        erro:
          "Erro interno do servidor.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
=====================================================
POST /api/conversas
=====================================================
*/

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const conversaId =
      typeof body.conversa_id === "string"
        ? body.conversa_id.trim()
        : "";

    const conteudo =
      typeof body.conteudo === "string"
        ? body.conteudo.trim()
        : "";

    const autor =
      body.autor === "cliente" ||
      body.autor === "atendente" ||
      body.autor === "ia"
        ? body.autor
        : null;

    if (!conversaId) {
      return NextResponse.json(
        {
          erro:
            "conversa_id é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!conteudo) {
      return NextResponse.json(
        {
          erro:
            "A mensagem está vazia.",
        },
        {
          status: 400,
        }
      );
    }

    if (!autor) {
      return NextResponse.json(
        {
          erro:
            "Autor inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const direcao =
      autor === "cliente"
        ? "entrada"
        : "saida";

    const supabase =
      getSupabase();

    const {
      data: mensagem,
      error,
    } = await supabase
      .from("mensagens")
      .insert({
        conversa_id:
          conversaId,

        direcao,

        autor,

        conteudo,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Erro ao salvar mensagem:",
        error
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível salvar a mensagem.",
        },
        {
          status: 500,
        }
      );
    }

    await supabase
      .from("conversas")
      .update({
        ultima_mensagem_em:
          new Date().toISOString(),
      })
      .eq(
        "id",
        conversaId
      );

    let statusLead:
      | string
      | null = null;

    /*
    Classificamos apenas mensagens do cliente.
    */

    if (
      autor === "cliente"
    ) {
      statusLead =
        await atualizarStatusLead(
          conversaId,
          conteudo
        );
    }

    return NextResponse.json(
      {
        sucesso: true,
        mensagem,
        status_lead:
          statusLead,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Erro interno:",
      error
    );

    return NextResponse.json(
      {
        erro:
          "Erro interno do servidor.",
      },
      {
        status: 500,
      }
    );
  }
}