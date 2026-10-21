export type MonitorStatus =
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

export type MonitorEvento = {
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

type NovoMonitorEvento =
  Omit<
    MonitorEvento,
    "id" | "criado_em"
  >;

type Listener =
  (
    evento: MonitorEvento
  ) => void;

type MonitorStore = {
  eventos: MonitorEvento[];
  listeners: Set<Listener>;
};

const globalMonitor =
  globalThis as typeof globalThis & {
    __ATENDE_AI_MONITOR__?:
      MonitorStore;
  };

function getStore(): MonitorStore {
  if (
    !globalMonitor
      .__ATENDE_AI_MONITOR__
  ) {
    globalMonitor
      .__ATENDE_AI_MONITOR__ = {
        eventos: [],
        listeners:
          new Set<Listener>(),
      };
  }

  return globalMonitor
    .__ATENDE_AI_MONITOR__;
}

function criarId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function emitirEventoMonitor(
  dados: NovoMonitorEvento
) {
  const store =
    getStore();

  const evento:
    MonitorEvento = {
      ...dados,

      id:
        criarId(),

      criado_em:
        new Date().toISOString(),
    };

  store.eventos.push(
    evento
  );

  /*
  Mantemos um histórico pequeno em memória.
  O monitor é operacional, não substitui
  as tabelas de leads/conversas do Supabase.
  */
  if (
    store.eventos.length >
    100
  ) {
    store.eventos =
      store.eventos.slice(-100);

    globalMonitor
      .__ATENDE_AI_MONITOR__ =
      store;
  }

  for (
    const listener of
    store.listeners
  ) {
    try {
      listener(
        evento
      );
    } catch (
      error
    ) {
      console.error(
        "Erro em listener do monitor:",
        error
      );
    }
  }

  return evento;
}

export function obterEventosMonitor(
  limite = 30
) {
  const store =
    getStore();

  const quantidade =
    Math.max(
      1,
      Math.min(
        limite,
        100
      )
    );

  return store.eventos
    .slice(-quantidade);
}

export function assinarMonitor(
  listener: Listener
) {
  const store =
    getStore();

  store.listeners.add(
    listener
  );

  return () => {
    store.listeners.delete(
      listener
    );
  };
}
