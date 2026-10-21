import {
  after,
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  emitirEventoMonitor,
} from "@/lib/monitor";

import {
  randomUUID,
} from "crypto";

import {
  writeFile,
  unlink,
} from "fs/promises";

import {
  tmpdir,
} from "os";

import {
  join,
} from "path";

export const runtime = "nodejs";

export const maxDuration = 240;

/*
=====================================================
TIPOS
=====================================================
*/

type MensagemHistorico = {
  role: "user" | "assistant";
  content: string;
};

type WhatsAppMessage = {
  from?: string;
  id?: string;
  type?: string;

  text?: {
    body?: string;
  };

  audio?: {
    id?: string;
    mime_type?: string;
    voice?: boolean;
  };
};

type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messaging_product?: string;

        contacts?: Array<{
          profile?: {
            name?: string;
          };

          wa_id?: string;
        }>;

        messages?: WhatsAppMessage[];

        statuses?: unknown[];
      };
    }>;
  }>;
};

/*
=====================================================
SUPABASE
=====================================================
*/

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
VARIÁVEIS DE AMBIENTE
=====================================================
*/

function limparVariavel(
  valor: string | undefined
) {
  if (!valor) {
    return "";
  }

  return valor
    .trim()
    .replace(/^["']|["']$/g, "");
}

function getMetaConfig() {
  const token =
    limparVariavel(
      process.env.WHATSAPP_ACCESS_TOKEN
    );

  const phoneNumberId =
    limparVariavel(
      process.env.WHATSAPP_PHONE_NUMBER_ID
    ).replace(/\D/g, "");

  const versao =
    limparVariavel(
      process.env.WHATSAPP_GRAPH_VERSION
    ) || "v25.0";

  if (!token) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN não configurado."
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID não configurado."
    );
  }

  return {
    token,
    phoneNumberId,
    versao,
  };
}

/*
=====================================================
VERIFICAÇÃO DO WEBHOOK
=====================================================
*/

export async function GET(
  request: NextRequest
) {
  const mode =
    request.nextUrl.searchParams.get(
      "hub.mode"
    );

  const token =
    request.nextUrl.searchParams.get(
      "hub.verify_token"
    );

  const challenge =
    request.nextUrl.searchParams.get(
      "hub.challenge"
    );

  const tokenEsperado =
    process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    tokenEsperado &&
    token === tokenEsperado
  ) {
    console.log(
      "✅ Webhook do WhatsApp verificado."
    );

    return new NextResponse(
      challenge ?? "",
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain",
        },
      }
    );
  }

  return NextResponse.json(
    {
      erro:
        "Token de verificação inválido.",
    },
    {
      status: 403,
    }
  );
}

/*
=====================================================
ENVIAR MENSAGEM PARA O WHATSAPP
=====================================================
*/

async function enviarMensagemWhatsApp(
  telefone: string,
  mensagem: string
) {
  const {
    token,
    phoneNumberId,
    versao,
  } = getMetaConfig();

  console.log(
    "📤 Enviando resposta pelo WhatsApp..."
  );

  const resposta =
    await fetch(
      `https://graph.facebook.com/${versao}/${phoneNumberId}/messages`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          messaging_product:
            "whatsapp",

          recipient_type:
            "individual",

          to:
            telefone,

          type:
            "text",

          text: {
            preview_url: true,
            body: mensagem,
          },
        }),

        signal:
          AbortSignal.timeout(
            30000
          ),
      }
    );

  const resultado =
    await resposta.json();

  if (!resposta.ok) {
    console.error(
      "❌ Erro da Meta:",
      JSON.stringify(
        resultado,
        null,
        2
      )
    );

    throw new Error(
      resultado?.error?.message ||
        "Não foi possível enviar a mensagem pelo WhatsApp."
    );
  }

  console.log(
    "✅ Meta aceitou a mensagem."
  );

  return resultado;
}

/*
=====================================================
OBTER URL DA MÍDIA
=====================================================
*/

async function obterUrlMidia(
  mediaId: string
) {
  const {
    token,
    phoneNumberId,
    versao,
  } = getMetaConfig();

  console.log(
    "🔎 Localizando áudio na Meta..."
  );

  const url =
    new URL(
      `https://graph.facebook.com/${versao}/${mediaId}`
    );

  url.searchParams.set(
    "phone_number_id",
    phoneNumberId
  );

  const resposta =
    await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        signal:
          AbortSignal.timeout(
            30000
          ),
      }
    );

  const resultado =
    await resposta.json();

  if (!resposta.ok) {
    console.error(
      "❌ Erro ao localizar áudio:",
      JSON.stringify(
        resultado,
        null,
        2
      )
    );

    throw new Error(
      resultado?.error?.message ||
        "Não foi possível localizar o áudio na Meta."
    );
  }

  const mediaUrl =
    typeof resultado?.url ===
    "string"
      ? resultado.url
      : "";

  if (!mediaUrl) {
    throw new Error(
      "A Meta não retornou a URL do áudio."
    );
  }

  return {
    url: mediaUrl,

    mimeType:
      typeof resultado?.mime_type ===
      "string"
        ? resultado.mime_type
        : "audio/ogg",
  };
}

/*
=====================================================
EXTENSÃO DO ÁUDIO
=====================================================
*/

function obterExtensaoAudio(
  mimeType: string
) {
  const mime =
    mimeType.toLowerCase();

  if (
    mime.includes("ogg")
  ) {
    return ".ogg";
  }

  if (
    mime.includes("mpeg")
  ) {
    return ".mp3";
  }

  if (
    mime.includes("mp4")
  ) {
    return ".m4a";
  }

  if (
    mime.includes("aac")
  ) {
    return ".aac";
  }

  if (
    mime.includes("amr")
  ) {
    return ".amr";
  }

  if (
    mime.includes("wav")
  ) {
    return ".wav";
  }

  return ".ogg";
}

/*
=====================================================
BAIXAR ÁUDIO DA META
=====================================================
*/

async function baixarAudio(
  mediaId: string
) {
  const {
    token,
  } = getMetaConfig();

  const dadosMidia =
    await obterUrlMidia(
      mediaId
    );

  console.log(
    "⬇️ Baixando áudio da Meta..."
  );

  const resposta =
    await fetch(
      dadosMidia.url,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        signal:
          AbortSignal.timeout(
            60000
          ),
      }
    );

  if (!resposta.ok) {
    const texto =
      await resposta.text();

    console.error(
      "❌ Erro no download do áudio:",
      texto
    );

    throw new Error(
      "Não foi possível baixar o áudio do WhatsApp."
    );
  }

  const buffer =
    Buffer.from(
      await resposta.arrayBuffer()
    );

  const extensao =
    obterExtensaoAudio(
      dadosMidia.mimeType
    );

  const caminho =
    join(
      tmpdir(),
      `atende-ai-${randomUUID()}${extensao}`
    );

  await writeFile(
    caminho,
    buffer
  );

  console.log(
    `✅ Áudio baixado: ${buffer.length} bytes`
  );

  return caminho;
}

/*
=====================================================
TRANSCRIÇÃO LOCAL COM FASTER-WHISPER
=====================================================
*/

async function transcreverAudio(
  mediaId: string
) {
  let caminhoAudio = "";

  try {
    caminhoAudio =
      await baixarAudio(
        mediaId
      );

    console.log(
      "🎙️ Enviando áudio para o Whisper..."
    );

    const resposta =
      await fetch(
        "http://127.0.0.1:8765/transcribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            path:
              caminhoAudio,
          }),

          signal:
            AbortSignal.timeout(
              180000
            ),
        }
      );

    let resultado: {
      sucesso?: boolean;
      transcricao?: string;
      erro?: string;
    };

    try {
      resultado =
        await resposta.json();
    } catch {
      throw new Error(
        "O serviço de transcrição retornou uma resposta inválida."
      );
    }

    if (!resposta.ok) {
      console.error(
        "❌ Erro do Whisper:",
        resultado
      );

      throw new Error(
        resultado.erro ||
          "Não foi possível transcrever o áudio."
      );
    }

    const transcricao =
      String(
        resultado.transcricao ??
          ""
      ).trim();

    if (!transcricao) {
      throw new Error(
        "O Whisper não encontrou fala no áudio."
      );
    }

    console.log(
      "========================================"
    );

    console.log(
      "📝 TRANSCRIÇÃO DO ÁUDIO:"
    );

    console.log(
      transcricao
    );

    console.log(
      "========================================"
    );

    return transcricao;
  } finally {
    if (caminhoAudio) {
      try {
        await unlink(
          caminhoAudio
        );
      } catch {
        // O arquivo temporário pode já ter sido removido.
      }
    }
  }
}

/*
=====================================================
ENVIAR TEXTO PARA O ATENDE AI
=====================================================
*/

async function gerarRespostaIA(
  mensagem: string,
  historico: MensagemHistorico[]
) {
  const origem =
    limparVariavel(
      process.env.INTERNAL_APP_URL
    ) ||
    "http://127.0.0.1:3000";

  console.log(
    "🧠 Atende AI pensando..."
  );

  console.log(
    "💬 Mensagem interpretada:",
    mensagem
  );

  const resposta =
    await fetch(
      `${origem}/api/ia`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          mensagem,
          historico,
        }),

        signal:
          AbortSignal.timeout(
            120000
          ),
      }
    );

  const resultado =
    await resposta.json();

  if (!resposta.ok) {
    console.error(
      "❌ Erro da IA:",
      resultado
    );

    throw new Error(
      resultado?.erro ||
        "A IA não conseguiu responder."
    );
  }

  const texto =
    String(
      resultado?.resposta ??
        ""
    ).trim();

  if (!texto) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  console.log(
    "🤖 Resposta da IA:",
    texto
  );

  return texto;
}

/*
=====================================================
SALVAR RESPOSTA
=====================================================
*/

async function salvarResposta(
  conversaId: string,
  conteudo: string,
  whatsappMessageId:
    | string
    | null
) {
  const supabase =
    getSupabase();

  const {
    error,
  } = await supabase
    .from("mensagens")
    .insert({
      conversa_id:
        conversaId,

      direcao:
        "saida",

      autor:
        "ia",

      conteudo,

      whatsapp_message_id:
        whatsappMessageId,
    });

  if (error) {
    console.error(
      "⚠️ Erro ao salvar resposta:",
      error
    );
  }
}

/*
=====================================================
ATUALIZAR CONVERSA
=====================================================
*/

async function atualizarConversa(
  conversaId: string
) {
  const supabase =
    getSupabase();

  await supabase
    .from("conversas")
    .update({
      ultima_mensagem_em:
        new Date().toISOString(),

      status:
        "aguardando_cliente",
    })
    .eq(
      "id",
      conversaId
    );
}

/*
=====================================================
PROCESSAR MENSAGEM
=====================================================
*/

async function processarMensagem(
  body: WhatsAppWebhookBody
) {
  let monitorNomeContato =
    "Contato do WhatsApp";

  let monitorTelefone =
    "";

  let monitorTipo =
    "";

  try {
    const value =
      body?.entry?.[0]
        ?.changes?.[0]
        ?.value;

    const mensagemWhatsApp =
      value?.messages?.[0];

    if (!mensagemWhatsApp) {
      return;
    }

    const telefone =
      typeof mensagemWhatsApp.from ===
      "string"
        ? mensagemWhatsApp.from.trim()
        : "";

    const whatsappMessageId =
      typeof mensagemWhatsApp.id ===
      "string"
        ? mensagemWhatsApp.id.trim()
        : "";

    const tipo =
      typeof mensagemWhatsApp.type ===
      "string"
        ? mensagemWhatsApp.type
        : "";

    const nomeContato =
      value?.contacts?.[0]
        ?.profile?.name?.trim() ||
      `WhatsApp +${telefone}`;

    if (!telefone) {
      return;
    }

    monitorNomeContato =
      nomeContato;

    monitorTelefone =
      telefone;

    monitorTipo =
      tipo;

    emitirEventoMonitor({
      status:
        "recebido",

      titulo:
        `${nomeContato} entrou em contato`,

      detalhe:
        tipo === "audio"
          ? "Áudio recebido pelo WhatsApp."
          : "Nova mensagem recebida pelo WhatsApp.",

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,
    });

    const ehTexto =
      tipo === "text";

    const ehAudio =
      tipo === "audio";

    console.log(
      "========================================"
    );

    console.log(
      `📲 WhatsApp recebido de ${nomeContato}`
    );

    console.log(
      `📦 Tipo da mensagem: ${tipo}`
    );

    console.log(
      "========================================"
    );

    /*
    =================================================
    TIPOS AINDA NÃO SUPORTADOS
    =================================================
    */

    if (
      !ehTexto &&
      !ehAudio
    ) {
      console.log(
        `ℹ️ Tipo "${tipo}" ainda não suportado.`
      );

      emitirEventoMonitor({
        status:
          "ignorado",

        titulo:
          "Mensagem não suportada",

        detalhe:
          `Tipo recebido: ${tipo || "desconhecido"}.`,

        nome_contato:
          nomeContato,

        telefone,

        tipo_mensagem:
          tipo,
      });

      return;
    }

    const supabase =
      getSupabase();

    /*
    =================================================
    EVITAR DUPLICIDADE
    =================================================
    */

    if (
      whatsappMessageId
    ) {
      const {
        data:
          mensagemExistente,
      } = await supabase
        .from("mensagens")
        .select("id")
        .eq(
          "whatsapp_message_id",
          whatsappMessageId
        )
        .limit(1)
        .maybeSingle();

      if (
        mensagemExistente
      ) {
        console.log(
          "ℹ️ Webhook duplicado ignorado."
        );

        return;
      }
    }

    /*
    =================================================
    LOCALIZAR LEAD
    =================================================
    */

    emitirEventoMonitor({
      status:
        "identificando",

      titulo:
        "Identificando contato",

      detalhe:
        `Localizando ${nomeContato} no CRM.`,

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,
    });

    const {
      data: leads,
      error:
        erroBuscaLead,
    } = await supabase
      .from("leads")
      .select("*")
      .eq(
        "telefone",
        telefone
      )
      .order(
        "criado_em",
        {
          ascending: true,
        }
      )
      .limit(1);

    if (
      erroBuscaLead
    ) {
      throw erroBuscaLead;
    }

    let lead =
      leads?.[0];

    /*
    =================================================
    CRIAR LEAD
    =================================================
    */

    if (!lead) {
      const {
        data: novoLead,
        error:
          erroNovoLead,
      } = await supabase
        .from("leads")
        .insert({
          nome:
            nomeContato,

          telefone,

          origem:
            "whatsapp",

          status:
            "novo",

          ultimo_contato_em:
            new Date().toISOString(),
        })
        .select()
        .single();

      if (
        erroNovoLead
      ) {
        throw erroNovoLead;
      }

      lead =
        novoLead;

      console.log(
        `👤 Novo lead criado: ${lead.nome}`
      );
    }

    /*
    =================================================
    ATUALIZAR LEAD
    =================================================
    */

    await supabase
      .from("leads")
      .update({
        ultimo_contato_em:
          new Date().toISOString(),
      })
      .eq(
        "id",
        lead.id
      );

    /*
    =================================================
    LOCALIZAR CONVERSA
    =================================================
    */

    const {
      data: conversas,
      error:
        erroBuscaConversa,
    } = await supabase
      .from("conversas")
      .select("*")
      .eq(
        "lead_id",
        lead.id
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
      .limit(1);

    if (
      erroBuscaConversa
    ) {
      throw erroBuscaConversa;
    }

    let conversa =
      conversas?.[0];

    /*
    =================================================
    CRIAR CONVERSA
    =================================================
    */

    if (!conversa) {
      const {
        data:
          novaConversa,

        error:
          erroNovaConversa,
      } = await supabase
        .from("conversas")
        .insert({
          lead_id:
            lead.id,

          canal:
            "whatsapp",

          status:
            "aberta",

          ultima_mensagem_em:
            new Date().toISOString(),
        })
        .select()
        .single();

      if (
        erroNovaConversa
      ) {
        throw erroNovaConversa;
      }

      conversa =
        novaConversa;
    }

    /*
    =================================================
    HISTÓRICO
    =================================================
    */

    emitirEventoMonitor({
      status:
        "historico",

      titulo:
        "Carregando histórico",

      detalhe:
        "Preparando o contexto da conversa para a Lia.",

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,

      conversa_id:
        conversa.id,
    });

    const {
      data:
        mensagensAnteriores,

      error:
        erroHistorico,
    } = await supabase
      .from("mensagens")
      .select(
        "autor, conteudo, criada_em"
      )
      .eq(
        "conversa_id",
        conversa.id
      )
      .order(
        "criada_em",
        {
          ascending: false,
        }
      )
      .limit(12);

    if (
      erroHistorico
    ) {
      throw erroHistorico;
    }

    const historico:
      MensagemHistorico[] =
      [
        ...(mensagensAnteriores ??
          []),
      ]
        .reverse()
        .map((item) => ({
          role:
            item.autor ===
            "cliente"
              ? "user"
              : "assistant",

          content:
            item.conteudo,
        }));

    let mensagemParaIA =
      "";

    /*
    =================================================
    MENSAGEM DE TEXTO
    =================================================
    */

    if (ehTexto) {
      mensagemParaIA =
        mensagemWhatsApp
          ?.text
          ?.body
          ?.trim() ||
        "";

      if (!mensagemParaIA) {
        return;
      }

      const {
        error:
          erroMensagem,
      } = await supabase
        .from("mensagens")
        .insert({
          conversa_id:
            conversa.id,

          direcao:
            "entrada",

          autor:
            "cliente",

          conteudo:
            mensagemParaIA,

          whatsapp_message_id:
            whatsappMessageId ||
            null,
        });

      if (
        erroMensagem
      ) {
        if (
          erroMensagem.code ===
          "23505"
        ) {
          console.log(
            "ℹ️ Mensagem duplicada ignorada."
          );

          return;
        }

        throw erroMensagem;
      }
    }

    /*
    =================================================
    MENSAGEM DE ÁUDIO
    =================================================
    */

    if (ehAudio) {
      console.log(
        "🎤 Áudio detectado."
      );

      const mediaId =
        mensagemWhatsApp
          ?.audio
          ?.id
          ?.trim() ||
        "";

      if (!mediaId) {
        throw new Error(
          "A Meta não informou o ID do áudio."
        );
      }

      /*
      Criamos primeiro uma mensagem temporária.

      Isso impede que o mesmo webhook seja processado
      mais de uma vez enquanto o Whisper trabalha.
      */

      const {
        data:
          mensagemReservada,

        error:
          erroReserva,
      } = await supabase
        .from("mensagens")
        .insert({
          conversa_id:
            conversa.id,

          direcao:
            "entrada",

          autor:
            "cliente",

          conteudo:
            "🎤 Áudio recebido - transcrevendo...",

          whatsapp_message_id:
            whatsappMessageId ||
            null,
        })
        .select("id")
        .single();

      if (
        erroReserva
      ) {
        if (
          erroReserva.code ===
          "23505"
        ) {
          console.log(
            "ℹ️ Áudio duplicado ignorado."
          );

          return;
        }

        throw erroReserva;
      }

      try {
        /*
        =============================================
        TRANSCRIÇÃO
        =============================================
        */

        emitirEventoMonitor({
          status:
            "transcrevendo",

          titulo:
            "Transcrevendo áudio",

          detalhe:
            `${nomeContato} enviou um áudio. O Whisper está convertendo em texto.`,

          nome_contato:
            nomeContato,

          telefone,

          tipo_mensagem:
            tipo,

          conversa_id:
            conversa.id,
        });

        const transcricao =
          await transcreverAudio(
            mediaId
          );

        mensagemParaIA =
          transcricao;

        emitirEventoMonitor({
          status:
            "transcrito",

          titulo:
            "Áudio transcrito",

          detalhe:
            "Transcrição concluída. A mensagem será enviada para a Lia.",

          nome_contato:
            nomeContato,

          telefone,

          tipo_mensagem:
            tipo,

          conversa_id:
            conversa.id,
        });

        /*
        No CRM salvamos a transcrição.
        */

        await supabase
          .from("mensagens")
          .update({
            conteudo:
              `🎤 Áudio transcrito:\n${transcricao}`,
          })
          .eq(
            "id",
            mensagemReservada.id
          );

        console.log(
          "✅ Transcrição salva no CRM."
        );
      } catch (
        erroTranscricao
      ) {
        console.error(
          "❌ Falha na transcrição:",
          erroTranscricao
        );

        await supabase
          .from("mensagens")
          .update({
            conteudo:
              "🎤 Áudio recebido - erro na transcrição.",
          })
          .eq(
            "id",
            mensagemReservada.id
          );

        /*
        Só usamos esta mensagem se REALMENTE
        houver erro técnico na transcrição.
        */

        const mensagemErro =
          "Recebi seu áudio 😊, mas ocorreu um erro ao transcrevê-lo. Pode tentar enviar o áudio novamente?";

        emitirEventoMonitor({
          status:
            "enviando",

          titulo:
            "Enviando aviso ao cliente",

          detalhe:
            "A transcrição falhou e a Lia está avisando o cliente.",

          nome_contato:
            nomeContato,

          telefone,

          tipo_mensagem:
            tipo,

          conversa_id:
            conversa.id,
        });

        const resultadoEnvio =
          await enviarMensagemWhatsApp(
            telefone,
            mensagemErro
          );

        emitirEventoMonitor({
          status:
            "enviado",

          titulo:
            "Aviso enviado",

          detalhe:
            "O cliente foi avisado sobre a falha na transcrição.",

          nome_contato:
            nomeContato,

          telefone,

          tipo_mensagem:
            tipo,

          conversa_id:
            conversa.id,
        });

        const idResposta =
          resultadoEnvio
            ?.messages?.[0]
            ?.id ??
          null;

        await salvarResposta(
          conversa.id,
          mensagemErro,
          idResposta
        );

        await atualizarConversa(
          conversa.id
        );

        return;
      }
    }

    /*
    =================================================
    GARANTIA
    =================================================
    */

    if (!mensagemParaIA) {
      throw new Error(
        "Nenhum conteúdo foi produzido para a IA."
      );
    }

    /*
    =================================================
    STATUS DO LEAD
    =================================================
    */

    if (
      lead.status ===
      "novo"
    ) {
      await supabase
        .from("leads")
        .update({
          status:
            "conversando",
        })
        .eq(
          "id",
          lead.id
        );
    }

    /*
    =================================================
    GERAR RESPOSTA
    =================================================
    */

    emitirEventoMonitor({
      status:
        "pensando",

      titulo:
        "Lia está pensando",

      detalhe:
        "Analisando a mensagem e o histórico para preparar a melhor resposta.",

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,

      conversa_id:
        conversa.id,
    });

    const respostaIA =
      await gerarRespostaIA(
        mensagemParaIA,
        historico
      );

    emitirEventoMonitor({
      status:
        "escrevendo",

      titulo:
        "Lia está escrevendo",

      detalhe:
        "Resposta preparada. Fazendo os últimos ajustes antes do envio.",

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,

      conversa_id:
        conversa.id,
    });

    /*
    =================================================
    ENVIAR RESPOSTA
    =================================================
    */

    emitirEventoMonitor({
      status:
        "enviando",

      titulo:
        "Enviando pelo WhatsApp",

      detalhe:
        `Enviando a resposta da Lia para ${nomeContato}.`,

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,

      conversa_id:
        conversa.id,
    });

    const resultadoEnvio =
      await enviarMensagemWhatsApp(
        telefone,
        respostaIA
      );

    emitirEventoMonitor({
      status:
        "enviado",

      titulo:
        "Mensagem enviada",

      detalhe:
        `Resposta entregue à Meta para envio a ${nomeContato}.`,

      nome_contato:
        nomeContato,

      telefone,

      tipo_mensagem:
        tipo,

      conversa_id:
        conversa.id,
    });

    const whatsappIdResposta =
      resultadoEnvio
        ?.messages?.[0]
        ?.id ??
      null;

    /*
    =================================================
    SALVAR RESPOSTA
    =================================================
    */

    await salvarResposta(
      conversa.id,
      respostaIA,
      whatsappIdResposta
    );

    /*
    =================================================
    ATUALIZAR CONVERSA
    =================================================
    */

    await atualizarConversa(
      conversa.id
    );

    console.log(
      "✅ Atendimento concluído com sucesso."
    );
  } catch (error) {
    console.error(
      "❌ Falha no processamento do WhatsApp:",
      error
    );

    emitirEventoMonitor({
      status:
        "erro",

      titulo:
        "Erro no atendimento",

      detalhe:
        error instanceof Error
          ? error.message
          : "Ocorreu um erro durante o processamento da mensagem.",

      nome_contato:
        monitorNomeContato,

      telefone:
        monitorTelefone || null,

      tipo_mensagem:
        monitorTipo || null,
    });
  }
}

/*
=====================================================
POST DO WEBHOOK
=====================================================
*/

export async function POST(
  request: Request
) {
  try {
    const body =
      (
        await request.json()
      ) as WhatsAppWebhookBody;

    const mensagem =
      body?.entry?.[0]
        ?.changes?.[0]
        ?.value
        ?.messages?.[0];

    /*
    Status como:
    sent
    delivered
    read

    são confirmados sem processamento.
    */

    if (!mensagem) {
      return NextResponse.json(
        {
          recebido: true,
          tipo:
            "evento_sem_mensagem",
        },
        {
          status: 200,
        }
      );
    }

    /*
    Respondemos à Meta imediatamente.
    */

    after(async () => {
      await processarMensagem(
        body
      );
    });

    return NextResponse.json(
      {
        recebido: true,
        processamento:
          "agendado",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "❌ Erro ao receber webhook:",
      error
    );

    return NextResponse.json(
      {
        recebido: true,
      },
      {
        status: 200,
      }
    );
  }
}