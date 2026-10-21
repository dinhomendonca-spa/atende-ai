import {
  assinarMonitor,
  obterEventosMonitor,
} from "@/lib/monitor";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  const encoder =
    new TextEncoder();

  let cancelarAssinatura:
    (() => void) | null =
    null;

  let ping:
    ReturnType<
      typeof setInterval
    > | null =
    null;

  let fechado =
    false;

  let controllerAtual:
    ReadableStreamDefaultController<
      Uint8Array
    > | null =
    null;

  const enviar = (
    texto: string
  ) => {
    if (
      fechado ||
      !controllerAtual
    ) {
      return;
    }

    try {
      controllerAtual.enqueue(
        encoder.encode(
          texto
        )
      );
    } catch {
      fechado =
        true;
    }
  };

  const encerrar = () => {
    if (fechado) {
      return;
    }

    fechado =
      true;

    if (
      ping
    ) {
      clearInterval(
        ping
      );

      ping =
        null;
    }

    if (
      cancelarAssinatura
    ) {
      cancelarAssinatura();

      cancelarAssinatura =
        null;
    }

    try {
      controllerAtual?.close();
    } catch {
      // Conexão já encerrada.
    }

    controllerAtual =
      null;
  };

  const stream =
    new ReadableStream<
      Uint8Array
    >({
      start(
        controller
      ) {
        controllerAtual =
          controller;

        /*
        Instrui o navegador a tentar
        reconectar após 2 segundos.
        */
        enviar(
          "retry: 2000\n\n"
        );

        /*
        Ao abrir o painel, mostramos
        também os eventos mais recentes
        ainda guardados em memória.
        */
        const recentes =
          obterEventosMonitor(
            30
          );

        for (
          const evento of
          recentes
        ) {
          enviar(
            `data: ${JSON.stringify(
              evento
            )}\n\n`
          );
        }

        cancelarAssinatura =
          assinarMonitor(
            (
              evento
            ) => {
              enviar(
                `data: ${JSON.stringify(
                  evento
                )}\n\n`
              );
            }
          );

        /*
        Mantém a conexão SSE viva
        mesmo quando não há atendimento.
        */
        ping =
          setInterval(
            () => {
              enviar(
                `: ping ${Date.now()}\n\n`
              );
            },
            15000
          );

        request.signal
          .addEventListener(
            "abort",
            encerrar,
            {
              once: true,
            }
          );
      },

      cancel() {
        encerrar();
      },
    });

  return new Response(
    stream,
    {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        Connection:
          "keep-alive",

        "X-Accel-Buffering":
          "no",
      },
    }
  );
}
