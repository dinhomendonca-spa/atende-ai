"use client";

import { FormEvent, useEffect, useState } from "react";

type Lead = {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  origem: string;
  status:
    | "novo"
    | "conversando"
    | "demonstracao"
    | "negociacao"
    | "cliente"
    | "perdido";
  interesse: string | null;
  observacoes: string | null;
  criado_em: string;
};

type FormularioLead = {
  nome: string;
  empresa: string;
  telefone: string;
  email: string;
  instagram: string;
  interesse: string;
  observacoes: string;
};

type MonitorStatus =
  | "recebido"
  | "identificando"
  | "historico"
  | "transcrevendo"
  | "transcrito"
  | "pensando"
  | "escrevendo"
  | "enviando"
  | "enviado"
  | "ignorado"
  | "erro";

type MonitorEvento = {
  id: string;
  criado_em: string;
  status: MonitorStatus;
  titulo: string;
  detalhe?: string | null;
  nome_contato?: string | null;
  telefone?: string | null;
  tipo_mensagem?: string | null;
  conversa_id?: string | null;
};

const formularioInicial: FormularioLead = {
  nome: "",
  empresa: "",
  telefone: "",
  email: "",
  instagram: "",
  interesse: "",
  observacoes: "",
};

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [formulario, setFormulario] =
    useState<FormularioLead>(formularioInicial);

  const [
    eventosMonitor,
    setEventosMonitor,
  ] = useState<MonitorEvento[]>([]);

  const [
    monitorConectado,
    setMonitorConectado,
  ] = useState(false);

  async function carregarLeads() {
    try {
      setCarregando(true);

      const resposta = await fetch("/api/leads", {
        cache: "no-store",
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível carregar os leads."
        );
      }

      setLeads(resultado.leads ?? []);
    } catch (error) {
      console.error(error);
      setErro("Não foi possível carregar os leads.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarLeads();
  }, []);

  /*
  =====================================================
  MONITOR DA LIA EM TEMPO REAL
  =====================================================
  */

  useEffect(() => {
    const fonte =
      new EventSource(
        "/api/monitor"
      );

    fonte.onopen =
      () => {
        setMonitorConectado(
          true
        );
      };

    fonte.onmessage =
      (evento) => {
        try {
          const dados =
            JSON.parse(
              evento.data
            ) as MonitorEvento;

          if (
            !dados?.id
          ) {
            return;
          }

          setEventosMonitor(
            (
              anteriores
            ) => {
              const semDuplicar =
                anteriores.filter(
                  (
                    item
                  ) =>
                    item.id !==
                    dados.id
                );

              return [
                dados,
                ...semDuplicar,
              ].slice(
                0,
                30
              );
            }
          );

          /*
          Quando chega uma nova mensagem ou um atendimento
          termina, atualizamos também os cards de leads.
          */
          if (
            dados.status ===
              "recebido" ||
            dados.status ===
              "enviado"
          ) {
            carregarLeads();
          }
        } catch (
          error
        ) {
          console.error(
            "Evento inválido do monitor:",
            error
          );
        }
      };

    fonte.onerror =
      () => {
        setMonitorConectado(
          false
        );
      };

    return () => {
      fonte.close();
    };
  }, []);

  function alterarCampo(
    campo: keyof FormularioLead,
    valor: string
  ) {
    setFormulario((estadoAnterior) => ({
      ...estadoAnterior,
      [campo]: valor,
    }));
  }

  async function cadastrarLead(evento: FormEvent) {
    evento.preventDefault();

    setErro("");

    if (!formulario.nome.trim()) {
      setErro("Digite o nome do lead.");
      return;
    }

    try {
      setSalvando(true);

      const resposta = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formulario),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível cadastrar o lead."
        );
      }

      setFormulario(formularioInicial);
      setModalAberto(false);

      await carregarLeads();
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Não foi possível cadastrar o lead.");
      }
    } finally {
      setSalvando(false);
    }
  }

  const novos = leads.filter(
    (lead) => lead.status === "novo"
  ).length;

  const conversas = leads.filter(
    (lead) =>
      lead.status === "conversando" ||
      lead.status === "demonstracao" ||
      lead.status === "negociacao"
  ).length;

  const vendas = leads.filter(
    (lead) => lead.status === "cliente"
  ).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-800 bg-zinc-900 p-6 md:block">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">
              Atende{" "}
              <span className="text-emerald-400">
                AI
              </span>
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Agente comercial
            </p>
          </div>

          <nav className="space-y-2">
            <a
              href="/"
              className="block w-full rounded-xl bg-emerald-500 px-4 py-3 text-left font-medium text-black"
            >
              📊 Visão geral
            </a>

            <a
              href="#leads"
              className="block w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              👥 Leads
            </a>

            <a
              href="/conversas"
              className="block w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              💬 Conversas
            </a>

            <a
              href="#followups"
              className="block w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              ⏰ Follow-ups
            </a>

            <a
              href="#lia-tempo-real"
              className="block w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              🤖 Inteligência artificial
            </a>

            <a
              href="/configuracoes"
              className="block w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              ⚙️ Configurações
            </a>
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-8">
          <header className="mb-8">
            <p className="text-sm text-zinc-500">
              Central comercial
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Olá 👋
            </h2>

            <p className="mt-2 text-zinc-400">
              Aqui você acompanha seus leads e suas
              oportunidades de venda.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              titulo="Novos leads"
              valor={novos.toString()}
              descricao="Aguardando contato"
              icone="👥"
            />

            <Card
              titulo="Conversas"
              valor={conversas.toString()}
              descricao="Em andamento"
              icone="💬"
            />

            <Card
              titulo="Follow-ups"
              valor="0"
              descricao="Precisam de atenção"
              icone="⏰"
            />

            <Card
              titulo="Vendas"
              valor={vendas.toString()}
              descricao="Convertidas"
              icone="💰"
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            <div id="leads" className="scroll-mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 xl:col-span-2">
              <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Leads recentes
                  </h3>

                  <p className="text-sm text-zinc-500">
                    Pessoas interessadas no seu SaaS
                  </p>
                </div>

                <button
                  onClick={() => {
                    setErro("");
                    setModalAberto(true);
                  }}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                >
                  + Novo lead
                </button>
              </div>

              {carregando ? (
                <div className="flex min-h-72 items-center justify-center p-8">
                  <p className="text-zinc-500">
                    Carregando leads...
                  </p>
                </div>
              ) : leads.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 text-5xl">
                    👥
                  </div>

                  <h4 className="font-semibold">
                    Nenhum lead ainda
                  </h4>

                  <p className="mt-2 max-w-sm text-sm text-zinc-500">
                    Cadastre seu primeiro potencial
                    cliente para começar a acompanhar a
                    prospecção.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex flex-col gap-3 p-5 transition hover:bg-zinc-800/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                            {lead.nome
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {lead.nome}
                            </p>

                            <p className="truncate text-sm text-zinc-500">
                              {lead.empresa ||
                                lead.instagram ||
                                lead.telefone ||
                                "Sem empresa informada"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Status status={lead.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div id="lia-tempo-real" className="scroll-mt-6">
                <MonitorTempoReal
                eventos={
                  eventosMonitor
                }
                conectado={
                  monitorConectado
                }
                />
              </div>

              <div
                id="followups"
                className="scroll-mt-6 rounded-2xl border border-zinc-800 bg-zinc-900"
              >
                <div className="border-b border-zinc-800 p-5">
                  <h3 className="text-lg font-semibold">
                    Follow-ups
                  </h3>

                  <p className="text-sm text-zinc-500">
                    Clientes que precisam de retorno
                  </p>
                </div>

                <div className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
                  <div className="mb-3 text-4xl">
                    ⏰
                  </div>

                  <h4 className="font-semibold">
                    Tudo em dia
                  </h4>

                  <p className="mt-2 text-sm text-zinc-500">
                    Nenhum cliente aguardando
                    acompanhamento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-lg font-semibold">
              Funil comercial
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Acompanhamento dos seus potenciais clientes
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Etapa
                nome="Novo"
                quantidade={
                  leads.filter(
                    (lead) => lead.status === "novo"
                  ).length
                }
              />

              <Etapa
                nome="Conversando"
                quantidade={
                  leads.filter(
                    (lead) =>
                      lead.status === "conversando"
                  ).length
                }
              />

              <Etapa
                nome="Demonstração"
                quantidade={
                  leads.filter(
                    (lead) =>
                      lead.status === "demonstracao"
                  ).length
                }
              />

              <Etapa
                nome="Negociação"
                quantidade={
                  leads.filter(
                    (lead) =>
                      lead.status === "negociacao"
                  ).length
                }
              />

              <Etapa
                nome="Cliente"
                quantidade={
                  leads.filter(
                    (lead) =>
                      lead.status === "cliente"
                  ).length
                }
              />
            </div>
          </div>
        </section>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-5">
              <div>
                <h2 className="text-xl font-bold">
                  Novo lead
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Cadastre uma pessoa ou empresa que você
                  está prospectando.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalAberto(false);
                  setErro("");
                }}
                className="rounded-lg px-3 py-2 text-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={cadastrarLead}
              className="space-y-5 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  titulo="Nome *"
                  valor={formulario.nome}
                  placeholder="Ex.: João"
                  onChange={(valor) =>
                    alterarCampo("nome", valor)
                  }
                />

                <Campo
                  titulo="Empresa"
                  valor={formulario.empresa}
                  placeholder="Ex.: Loja do João"
                  onChange={(valor) =>
                    alterarCampo("empresa", valor)
                  }
                />

                <Campo
                  titulo="Telefone / WhatsApp"
                  valor={formulario.telefone}
                  placeholder="Ex.: 22999999999"
                  onChange={(valor) =>
                    alterarCampo("telefone", valor)
                  }
                />

                <Campo
                  titulo="E-mail"
                  valor={formulario.email}
                  placeholder="cliente@email.com"
                  tipo="email"
                  onChange={(valor) =>
                    alterarCampo("email", valor)
                  }
                />

                <Campo
                  titulo="Instagram"
                  valor={formulario.instagram}
                  placeholder="@nomedaloja"
                  onChange={(valor) =>
                    alterarCampo("instagram", valor)
                  }
                />

                <Campo
                  titulo="Interesse"
                  valor={formulario.interesse}
                  placeholder="Ex.: Loja online"
                  onChange={(valor) =>
                    alterarCampo("interesse", valor)
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Observações
                </label>

                <textarea
                  value={formulario.observacoes}
                  onChange={(evento) =>
                    alterarCampo(
                      "observacoes",
                      evento.target.value
                    )
                  }
                  placeholder="Ex.: Encontrado pelo Instagram. Atualmente vende pelo WhatsApp."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
                />
              </div>

              {erro && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {erro}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto(false);
                    setErro("");
                  }}
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : "Cadastrar lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}


function MonitorTempoReal({
  eventos,
  conectado,
}: {
  eventos: MonitorEvento[];
  conectado: boolean;
}) {
  const atual =
    eventos[0] ?? null;

  const recentes =
    eventos.slice(0, 7);

  const aparência =
    atual
      ? aparenciaMonitor(
          atual.status
        )
      : aparenciaMonitor(
          "recebido"
        );

  const processando =
    atual
      ? [
          "recebido",
          "identificando",
          "historico",
          "transcrevendo",
          "transcrito",
          "pensando",
          "escrevendo",
          "enviando",
        ].includes(
          atual.status
        )
      : false;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
        <div>
          <h3 className="text-lg font-semibold">
            Lia em tempo real
          </h3>

          <p className="text-sm text-zinc-500">
            Processamento dos atendimentos
          </p>
        </div>

        <span
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            conectado
              ? "border-emerald-900 bg-emerald-950 text-emerald-400"
              : "border-amber-900 bg-amber-950/60 text-amber-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              conectado
                ? "bg-emerald-400"
                : "bg-amber-300"
            }`}
          />

          {conectado
            ? "Ao vivo"
            : "Reconectando"}
        </span>
      </div>

      <div className="p-5">
        {!atual ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <div className="mb-3 text-4xl">
              🤖
            </div>

            <p className="font-semibold">
              Lia aguardando contatos
            </p>

            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              Quando alguém falar pelo WhatsApp,
              as etapas do atendimento aparecerão
              aqui automaticamente.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`rounded-2xl border p-4 ${aparência.caixa}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">
                  {aparência.icone}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {atual.titulo}
                    </p>

                    {processando && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        processando
                      </span>
                    )}
                  </div>

                  {atual.nome_contato && (
                    <p className="mt-1 truncate text-sm text-zinc-300">
                      {atual.nome_contato}
                    </p>
                  )}

                  {atual.detalhe && (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {atual.detalhe}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-zinc-600">
                    {formatarHorarioMonitor(
                      atual.criado_em
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Atividade recente
                </p>

                <span className="text-xs text-zinc-600">
                  {eventos.length} eventos
                </span>
              </div>

              <div className="space-y-3">
                {recentes.map(
                  (
                    evento
                  ) => {
                    const visual =
                      aparenciaMonitor(
                        evento.status
                      );

                    return (
                      <div
                        key={
                          evento.id
                        }
                        className="flex gap-3 border-l border-zinc-800 pl-3"
                      >
                        <div className="mt-0.5 text-sm">
                          {visual.icone}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-300">
                            {evento.titulo}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600">
                            {evento.nome_contato && (
                              <span className="truncate">
                                {evento.nome_contato}
                              </span>
                            )}

                            <span>
                              {formatarHorarioMonitor(
                                evento.criado_em
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function aparenciaMonitor(
  status: MonitorStatus
) {
  const mapa:
    Record<
      MonitorStatus,
      {
        icone: string;
        caixa: string;
      }
    > = {
      recebido: {
        icone: "📲",
        caixa:
          "border-sky-900/70 bg-sky-950/30",
      },

      identificando: {
        icone: "🔎",
        caixa:
          "border-cyan-900/70 bg-cyan-950/30",
      },

      historico: {
        icone: "🗂️",
        caixa:
          "border-violet-900/70 bg-violet-950/30",
      },

      transcrevendo: {
        icone: "🎤",
        caixa:
          "border-fuchsia-900/70 bg-fuchsia-950/30",
      },

      transcrito: {
        icone: "📝",
        caixa:
          "border-indigo-900/70 bg-indigo-950/30",
      },

      pensando: {
        icone: "🧠",
        caixa:
          "border-amber-900/70 bg-amber-950/30",
      },

      escrevendo: {
        icone: "✍️",
        caixa:
          "border-yellow-900/70 bg-yellow-950/30",
      },

      enviando: {
        icone: "📤",
        caixa:
          "border-blue-900/70 bg-blue-950/30",
      },

      enviado: {
        icone: "✅",
        caixa:
          "border-emerald-900/70 bg-emerald-950/30",
      },

      ignorado: {
        icone: "ℹ️",
        caixa:
          "border-zinc-700 bg-zinc-950/50",
      },

      erro: {
        icone: "❌",
        caixa:
          "border-red-900/70 bg-red-950/30",
      },
    };

  return mapa[
    status
  ];
}

function formatarHorarioMonitor(
  data: string
) {
  try {
    return new Intl
      .DateTimeFormat(
        "pt-BR",
        {
          hour:
            "2-digit",
          minute:
            "2-digit",
          second:
            "2-digit",
        }
      )
      .format(
        new Date(
          data
        )
      );
  } catch {
    return "";
  }
}

function Campo({
  titulo,
  valor,
  placeholder,
  tipo = "text",
  onChange,
}: {
  titulo: string;
  valor: string;
  placeholder: string;
  tipo?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {titulo}
      </label>

      <input
        type={tipo}
        value={valor}
        onChange={(evento) =>
          onChange(evento.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
      />
    </div>
  );
}

function Card({
  titulo,
  valor,
  descricao,
  icone,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            {titulo}
          </p>

          <p className="mt-2 text-3xl font-bold">
            {valor}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {descricao}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-800 p-3 text-xl">
          {icone}
        </div>
      </div>
    </div>
  );
}

function Etapa({
  nome,
  quantidade,
}: {
  nome: string;
  quantidade: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-sm text-zinc-500">
        {nome}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {quantidade}
      </p>
    </div>
  );
}

function Status({
  status,
}: {
  status: Lead["status"];
}) {
  const nomes = {
    novo: "Novo",
    conversando: "Conversando",
    demonstracao: "Demonstração",
    negociacao: "Negociação",
    cliente: "Cliente",
    perdido: "Perdido",
  };

  return (
    <span className="w-fit rounded-full border border-emerald-900 bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
      {nomes[status]}
    </span>
  );
}