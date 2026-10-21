"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Lead = {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  status:
    | "novo"
    | "conversando"
    | "demonstracao"
    | "negociacao"
    | "cliente"
    | "perdido";
};

type Conversa = {
  id: string;
  lead_id: string;
  canal: string;
  status: string;
};

type Mensagem = {
  id: string;
  conversa_id: string;
  direcao: "entrada" | "saida";
  autor: "cliente" | "atendente" | "ia";
  conteudo: string;
  criada_em: string;
};

export default function ConversasPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSelecionadoId, setLeadSelecionadoId] =
    useState<string>("");

  const [conversa, setConversa] =
    useState<Conversa | null>(null);

  const [mensagens, setMensagens] =
    useState<Mensagem[]>([]);

  const [texto, setTexto] = useState("");

  const [carregandoLeads, setCarregandoLeads] =
    useState(true);

  const [carregandoConversa, setCarregandoConversa] =
    useState(false);

  const [enviando, setEnviando] =
    useState(false);

  const [erro, setErro] = useState("");

  const fimDaConversaRef =
    useRef<HTMLDivElement | null>(null);

  const leadSelecionado =
    leads.find(
      (lead) =>
        lead.id === leadSelecionadoId
    ) ?? null;

  /*
  =====================================================
  CARREGAR LEADS
  =====================================================
  */

  useEffect(() => {
    carregarLeads();
  }, []);

  async function carregarLeads() {
    try {
      setCarregandoLeads(true);
      setErro("");

      const resposta = await fetch(
        "/api/leads",
        {
          cache: "no-store",
        }
      );

      const resultado =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível carregar os leads."
        );
      }

      const lista: Lead[] =
        resultado.leads ?? [];

      setLeads(lista);

      if (
        lista.length > 0 &&
        !leadSelecionadoId
      ) {
        setLeadSelecionadoId(
          lista[0].id
        );
      }
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar leads."
      );
    } finally {
      setCarregandoLeads(false);
    }
  }

  /*
  =====================================================
  CARREGAR CONVERSA DO LEAD
  =====================================================
  */

  useEffect(() => {
    if (!leadSelecionadoId) {
      setConversa(null);
      setMensagens([]);
      return;
    }

    carregarConversa(
      leadSelecionadoId
    );
  }, [leadSelecionadoId]);

  async function carregarConversa(
    leadId: string
  ) {
    try {
      setCarregandoConversa(true);
      setErro("");
      setConversa(null);
      setMensagens([]);

      const resposta = await fetch(
        `/api/conversas?lead_id=${encodeURIComponent(
          leadId
        )}`,
        {
          cache: "no-store",
        }
      );

      const resultado =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível carregar a conversa."
        );
      }

      setConversa(
        resultado.conversa
      );

      setMensagens(
        resultado.mensagens ?? []
      );
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar conversa."
      );
    } finally {
      setCarregandoConversa(false);
    }
  }

  /*
  =====================================================
  ROLAR PARA A ÚLTIMA MENSAGEM
  =====================================================
  */

  useEffect(() => {
    fimDaConversaRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [mensagens, enviando]);

  /*
  =====================================================
  SALVAR MENSAGEM NO SUPABASE
  =====================================================
  */

  async function salvarMensagem(
    autor: "cliente" | "ia" | "atendente",
    conteudo: string
  ): Promise<Mensagem> {
    if (!conversa) {
      throw new Error(
        "Nenhuma conversa selecionada."
      );
    }

    const resposta = await fetch(
      "/api/conversas",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          conversa_id:
            conversa.id,

          autor,

          conteudo,
        }),
      }
    );

    const resultado =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        resultado.erro ||
          "Não foi possível salvar a mensagem."
      );
    }

    return resultado.mensagem;
  }

  /*
  =====================================================
  ENVIAR MENSAGEM
  =====================================================
  */

  async function enviarMensagem(
    evento?: FormEvent
  ) {
    evento?.preventDefault();

    const mensagem =
      texto.trim();

    if (
      !mensagem ||
      enviando ||
      !conversa
    ) {
      return;
    }

    setErro("");
    setTexto("");

    /*
    Histórico ANTES da nova mensagem.
    A mensagem atual será enviada separadamente
    para /api/ia.
    */

    const historico =
      mensagens.map((item) => ({
        role:
          item.autor === "cliente"
            ? ("user" as const)
            : ("assistant" as const),

        content:
          item.conteudo,
      }));

    try {
      setEnviando(true);

      /*
      1. Salva a mensagem do cliente
      */

      const mensagemCliente =
        await salvarMensagem(
          "cliente",
          mensagem
        );

      setMensagens(
        (estadoAnterior) => [
          ...estadoAnterior,
          mensagemCliente,
        ]
      );

      /*
      2. Envia para a IA
      */

      const respostaIA =
        await fetch(
          "/api/ia",
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
          }
        );

      const resultadoIA =
        await respostaIA.json();

      if (!respostaIA.ok) {
        throw new Error(
          resultadoIA.erro ||
            "A IA não conseguiu responder."
        );
      }

      const textoResposta =
        resultadoIA.resposta;

      /*
      3. Salva a resposta da IA
      */

      const mensagemIA =
        await salvarMensagem(
          "ia",
          textoResposta
        );

      setMensagens(
        (estadoAnterior) => [
          ...estadoAnterior,
          mensagemIA,
        ]
      );
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao enviar mensagem."
      );
    } finally {
      setEnviando(false);
    }
  }

  /*
  =====================================================
  ENTER ENVIA
  SHIFT + ENTER QUEBRA LINHA
  =====================================================
  */

  function controlarTeclado(
    evento: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      evento.key === "Enter" &&
      !evento.shiftKey
    ) {
      evento.preventDefault();

      if (
        texto.trim() &&
        !enviando
      ) {
        enviarMensagem();
      }
    }
  }

  /*
  =====================================================
  FORMATAR HORÁRIO
  =====================================================
  */

  function formatarHorario(
    data: string
  ) {
    try {
      return new Intl.DateTimeFormat(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ).format(
        new Date(data)
      );
    } catch {
      return "";
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex h-screen overflow-hidden">
        {/* =================================================
            LISTA DE LEADS
        ================================================= */}

        <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                  Atende AI
                </p>

                <h1 className="mt-1 text-xl font-bold">
                  Conversas
                </h1>
              </div>

              <a
                href="/"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                ← Painel
              </a>
            </div>
          </div>

          <div className="border-b border-zinc-800 p-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              👥 {leads.length} lead
              {leads.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {carregandoLeads ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                Carregando leads...
              </div>
            ) : leads.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mb-3 text-4xl">
                  👥
                </div>

                <p className="font-medium">
                  Nenhum lead
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Cadastre um lead no
                  painel primeiro.
                </p>
              </div>
            ) : (
              leads.map((lead) => {
                const ativo =
                  lead.id ===
                  leadSelecionadoId;

                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() =>
                      setLeadSelecionadoId(
                        lead.id
                      )
                    }
                    className={`w-full border-b border-zinc-800 p-4 text-left transition ${
                      ativo
                        ? "bg-emerald-950/40"
                        : "hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold ${
                          ativo
                            ? "bg-emerald-500 text-black"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {lead.nome
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {lead.nome}
                        </p>

                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {lead.empresa ||
                            lead.instagram ||
                            lead.telefone ||
                            "Lead"}
                        </p>
                      </div>

                      <span className="text-xs text-zinc-600">
                        ›
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* =================================================
            ÁREA DA CONVERSA
        ================================================= */}

        <section className="flex min-w-0 flex-1 flex-col">
          {!leadSelecionado ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 text-6xl">
                💬
              </div>

              <h2 className="text-2xl font-bold">
                Selecione um lead
              </h2>

              <p className="mt-2 max-w-md text-zinc-500">
                Escolha um potencial
                cliente para abrir a
                conversa.
              </p>
            </div>
          ) : (
            <>
              {/* CABEÇALHO */}

              <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                    {leadSelecionado.nome
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      {
                        leadSelecionado.nome
                      }
                    </h2>

                    <p className="text-xs text-zinc-500">
                      {leadSelecionado.empresa ||
                        leadSelecionado.instagram ||
                        leadSelecionado.telefone ||
                        "Potencial cliente"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1 text-xs text-emerald-400">
                    ● IA ativa
                  </span>

                  <a
                    href="/configuracoes"
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
                  >
                    ⚙️ IA
                  </a>
                </div>
              </header>

              {/* MENSAGENS */}

              <div className="flex-1 overflow-y-auto bg-zinc-950 p-5 md:p-8">
                {carregandoConversa ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-zinc-500">
                      Carregando conversa...
                    </p>
                  </div>
                ) : mensagens.length ===
                  0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 text-5xl">
                      👋
                    </div>

                    <h3 className="text-xl font-semibold">
                      Inicie a conversa
                    </h3>

                    <p className="mt-2 max-w-md text-sm text-zinc-500">
                      Escreva abaixo como se
                      fosse uma mensagem
                      recebida deste cliente.
                    </p>

                    <p className="mt-4 max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-500">
                      Neste momento estamos
                      simulando o cliente.
                      Depois o WhatsApp vai
                      colocar as mensagens aqui
                      automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-4">
                    {mensagens.map(
                      (mensagem) => {
                        const cliente =
                          mensagem.autor ===
                          "cliente";

                        return (
                          <div
                            key={
                              mensagem.id
                            }
                            className={`flex ${
                              cliente
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[70%] ${
                                cliente
                                  ? "rounded-br-sm bg-emerald-500 text-black"
                                  : "rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100"
                              }`}
                            >
                              {!cliente && (
                                <p className="mb-1 text-xs font-semibold text-emerald-400">
                                  Atende AI
                                </p>
                              )}

                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {
                                  mensagem.conteudo
                                }
                              </p>

                              <p
                                className={`mt-2 text-right text-[10px] ${
                                  cliente
                                    ? "text-black/60"
                                    : "text-zinc-600"
                                }`}
                              >
                                {formatarHorario(
                                  mensagem.criada_em
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}

                    {enviando && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900 px-4 py-3">
                          <p className="mb-1 text-xs font-semibold text-emerald-400">
                            Atende AI
                          </p>

                          <p className="text-sm text-zinc-400">
                            Digitando...
                          </p>
                        </div>
                      </div>
                    )}

                    <div
                      ref={
                        fimDaConversaRef
                      }
                    />
                  </div>
                )}
              </div>

              {/* ERRO */}

              {erro && (
                <div className="border-t border-red-900 bg-red-950/50 px-5 py-3 text-sm text-red-300">
                  ⚠️ {erro}
                </div>
              )}

              {/* CAMPO DE MENSAGEM */}

              <form
                onSubmit={
                  enviarMensagem
                }
                className="border-t border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="mx-auto flex max-w-4xl items-end gap-3">
                  <textarea
                    value={texto}
                    onChange={(evento) =>
                      setTexto(
                        evento.target
                          .value
                      )
                    }
                    onKeyDown={
                      controlarTeclado
                    }
                    disabled={
                      enviando ||
                      carregandoConversa ||
                      !conversa
                    }
                    placeholder={`Simule uma mensagem de ${leadSelecionado.nome}...`}
                    rows={2}
                    className="min-h-[58px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={
                      enviando ||
                      carregandoConversa ||
                      !conversa ||
                      !texto.trim()
                    }
                    className="h-[58px] rounded-xl bg-emerald-500 px-6 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enviando
                      ? "..."
                      : "Enviar"}
                  </button>
                </div>

                <div className="mx-auto mt-2 flex max-w-4xl justify-between text-[11px] text-zinc-600">
                  <span>
                    Enter envia • Shift +
                    Enter quebra linha
                  </span>

                  <span>
                    💾 Conversa salva no
                    Supabase
                  </span>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}