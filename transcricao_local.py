import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

HOST = "127.0.0.1"
PORT = 8765
MODEL_NAME = "small"

# Evita erro de codificacao no Windows quando o programa roda oculto
# e a saida e redirecionada para arquivos de log.
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def log(texto: str) -> None:
    try:
        print(texto, flush=True)
    except UnicodeEncodeError:
        texto_seguro = (
            texto.encode("ascii", errors="replace")
            .decode("ascii", errors="replace")
        )
        print(texto_seguro, flush=True)


log("=" * 50)
log("ATENDE AI - TRANSCRICAO LOCAL")
log("=" * 50)
log(f"Carregando modelo Whisper: {MODEL_NAME}")

modelo = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8",
)

log("Modelo carregado.")

bloqueio_transcricao = threading.Lock()


class AtendeAIHandler(BaseHTTPRequestHandler):
    server_version = "AtendeAIWhisper/1.0"

    def log_message(self, format, *args):
        # Evita o log padrao do servidor poluir o terminal.
        return

    def enviar_json(self, status: int, dados: dict) -> None:
        corpo = json.dumps(
            dados,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(corpo)),
        )
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if self.path in ("/", "/health"):
            self.enviar_json(
                200,
                {
                    "sucesso": True,
                    "servico": "Atende AI - Whisper local",
                    "modelo": MODEL_NAME,
                    "status": "online",
                },
            )
            return

        self.enviar_json(
            404,
            {
                "sucesso": False,
                "erro": "Rota nao encontrada.",
            },
        )

    def do_POST(self):
        if self.path != "/transcribe":
            self.enviar_json(
                404,
                {
                    "sucesso": False,
                    "erro": "Rota nao encontrada.",
                },
            )
            return

        try:
            tamanho = int(
                self.headers.get(
                    "Content-Length",
                    "0",
                )
            )

            if tamanho <= 0:
                self.enviar_json(
                    400,
                    {
                        "sucesso": False,
                        "erro": "Corpo da requisicao vazio.",
                    },
                )
                return

            corpo = self.rfile.read(tamanho)

            try:
                dados = json.loads(
                    corpo.decode("utf-8")
                )
            except Exception:
                self.enviar_json(
                    400,
                    {
                        "sucesso": False,
                        "erro": "JSON invalido.",
                    },
                )
                return

            caminho = str(
                dados.get("path", "")
            ).strip()

            if not caminho:
                self.enviar_json(
                    400,
                    {
                        "sucesso": False,
                        "erro": "Informe o caminho do arquivo em 'path'.",
                    },
                )
                return

            if not os.path.isfile(caminho):
                self.enviar_json(
                    404,
                    {
                        "sucesso": False,
                        "erro": "Arquivo de audio nao encontrado.",
                    },
                )
                return

            log("-" * 50)
            log(f"Transcrevendo: {caminho}")

            with bloqueio_transcricao:
                segmentos, info = modelo.transcribe(
                    caminho,
                    language="pt",
                    beam_size=3,
                    vad_filter=True,
                    condition_on_previous_text=False,
                )

                partes = []

                for segmento in segmentos:
                    texto = (
                        segmento.text or ""
                    ).strip()

                    if texto:
                        partes.append(texto)

                transcricao = " ".join(
                    partes
                ).strip()

            if not transcricao:
                self.enviar_json(
                    422,
                    {
                        "sucesso": False,
                        "erro": "Nenhuma fala foi identificada no audio.",
                    },
                )
                return

            log("TRANSCRICAO:")
            log(transcricao)
            log("-" * 50)

            probabilidade_idioma = getattr(
                info,
                "language_probability",
                None,
            )

            idioma = getattr(
                info,
                "language",
                "pt",
            )

            self.enviar_json(
                200,
                {
                    "sucesso": True,
                    "transcricao": transcricao,
                    "idioma": idioma,
                    "probabilidade_idioma": probabilidade_idioma,
                },
            )

        except Exception as erro:
            log(
                f"Erro na transcricao: {erro}"
            )

            self.enviar_json(
                500,
                {
                    "sucesso": False,
                    "erro": str(erro),
                },
            )


def iniciar_servidor():
    servidor = ThreadingHTTPServer(
        (HOST, PORT),
        AtendeAIHandler,
    )

    log(
        f"Servico disponivel em http://{HOST}:{PORT}"
    )
    log(
        "Deixe este processo em execucao enquanto usar o Atende AI."
    )

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        log("Encerrando servico...")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    iniciar_servidor()
