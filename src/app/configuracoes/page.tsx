"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type Configuracao = {
  id?: string;
  nome_negocio: string;
  nome_produto: string;
  descricao_produto: string;
  link_demonstracao: string;
  link_cadastro: string;
  preco_mensal: string;
  preco_anual: string;
  mensagem_inicial: string;
  instrucoes_ia: string;
};

const configuracaoInicial: Configuracao = {
  nome_negocio: "",
  nome_produto: "",
  descricao_produto: "",
  link_demonstracao: "",
  link_cadastro: "",
  preco_mensal: "",
  preco_anual: "",
  mensagem_inicial: "",
  instrucoes_ia: "",
};

export default function ConfiguracoesPage() {
  const [configuracao, setConfiguracao] =
    useState<Configuracao>(
      configuracaoInicial
    );

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  async function carregarConfiguracoes() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(
        "/api/configuracoes",
        {
          cache: "no-store",
        }
      );

      const resultado =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível carregar as configurações."
        );
      }

      const dados =
        resultado.configuracao;

      if (!dados) {
        throw new Error(
          "Nenhuma configuração foi encontrada."
        );
      }

      setConfiguracao({
        id: dados.id,
        nome_negocio:
          dados.nome_negocio ?? "",
        nome_produto:
          dados.nome_produto ?? "",
        descricao_produto:
          dados.descricao_produto ?? "",
        link_demonstracao:
          dados.link_demonstracao ?? "",
        link_cadastro:
          dados.link_cadastro ?? "",
        preco_mensal:
          dados.preco_mensal !== null &&
          dados.preco_mensal !== undefined
            ? String(dados.preco_mensal)
            : "",
        preco_anual:
          dados.preco_anual !== null &&
          dados.preco_anual !== undefined
            ? String(dados.preco_anual)
            : "",
        mensagem_inicial:
          dados.mensagem_inicial ?? "",
        instrucoes_ia:
          dados.instrucoes_ia ?? "",
      });
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar as configurações."
      );
    } finally {
      setCarregando(false);
    }
  }

  function alterarCampo(
    campo: keyof Configuracao,
    valor: string
  ) {
    setConfiguracao(
      (estadoAnterior) => ({
        ...estadoAnterior,
        [campo]: valor,
      })
    );

    setSucesso("");
    setErro("");
  }

  async function salvarConfiguracoes(
    evento: FormEvent
  ) {
    evento.preventDefault();

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      if (
        !configuracao.nome_negocio.trim()
      ) {
        throw new Error(
          "Informe o nome do negócio."
        );
      }

      if (
        !configuracao.nome_produto.trim()
      ) {
        throw new Error(
          "Informe o nome do produto."
        );
      }

      const resposta = await fetch(
        "/api/configuracoes",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            nome_negocio:
              configuracao.nome_negocio,

            nome_produto:
              configuracao.nome_produto,

            descricao_produto:
              configuracao.descricao_produto,

            link_demonstracao:
              configuracao.link_demonstracao,

            link_cadastro:
              configuracao.link_cadastro,

            preco_mensal:
              configuracao.preco_mensal,

            preco_anual:
              configuracao.preco_anual,

            mensagem_inicial:
              configuracao.mensagem_inicial,

            instrucoes_ia:
              configuracao.instrucoes_ia,
          }),
        }
      );

      const resultado =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível salvar."
        );
      }

      setSucesso(
        "Configurações salvas com sucesso."
      );
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">
            🤖
          </div>

          <p className="text-zinc-400">
            Carregando configurações...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {/* CABEÇALHO */}

        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Atende AI
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Configurações da IA
            </h1>

            <p className="mt-2 max-w-2xl text-zinc-400">
              Defina as informações comerciais
              que o agente usará durante o
              atendimento.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              ← Painel
            </a>

            <a
              href="/conversas"
              className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-950"
            >
              💬 Testar IA
            </a>
          </div>
        </header>

        <form
          onSubmit={
            salvarConfiguracoes
          }
          className="space-y-6"
        >
          {/* NEGÓCIO */}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-6">
            <CabecalhoSecao
              icone="🏢"
              titulo="Negócio e produto"
              descricao="Informações básicas que identificam sua empresa e o produto vendido."
            />

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Campo
                titulo="Nome do negócio"
                valor={
                  configuracao.nome_negocio
                }
                placeholder="Ex.: Lojas AI"
                onChange={(valor) =>
                  alterarCampo(
                    "nome_negocio",
                    valor
                  )
                }
              />

              <Campo
                titulo="Nome do produto"
                valor={
                  configuracao.nome_produto
                }
                placeholder="Ex.: Lojas AI"
                onChange={(valor) =>
                  alterarCampo(
                    "nome_produto",
                    valor
                  )
                }
              />
            </div>

            <div className="mt-5">
              <AreaTexto
                titulo="Descrição do produto"
                valor={
                  configuracao.descricao_produto
                }
                placeholder="Explique para a IA o que seu produto faz..."
                linhas={5}
                onChange={(valor) =>
                  alterarCampo(
                    "descricao_produto",
                    valor
                  )
                }
              />
            </div>
          </section>

          {/* PREÇOS */}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-6">
            <CabecalhoSecao
              icone="💰"
              titulo="Preços"
              descricao="Valores oficiais que a IA poderá informar aos potenciais clientes."
            />

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Campo
                titulo="Preço mensal"
                valor={
                  configuracao.preco_mensal
                }
                placeholder="59.90"
                tipo="number"
                step="0.01"
                onChange={(valor) =>
                  alterarCampo(
                    "preco_mensal",
                    valor
                  )
                }
              />

              <Campo
                titulo="Preço anual"
                valor={
                  configuracao.preco_anual
                }
                placeholder="597.00"
                tipo="number"
                step="0.01"
                onChange={(valor) =>
                  alterarCampo(
                    "preco_anual",
                    valor
                  )
                }
              />
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Digite somente o valor. Exemplo:
              59.90
            </p>
          </section>

          {/* LINKS */}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-6">
            <CabecalhoSecao
              icone="🔗"
              titulo="Links comerciais"
              descricao="Links que o agente poderá enviar durante a conversa."
            />

            <div className="mt-6 space-y-5">
              <Campo
                titulo="Link da demonstração"
                valor={
                  configuracao.link_demonstracao
                }
                placeholder="https://..."
                tipo="url"
                onChange={(valor) =>
                  alterarCampo(
                    "link_demonstracao",
                    valor
                  )
                }
              />

              <Campo
                titulo="Link de cadastro"
                valor={
                  configuracao.link_cadastro
                }
                placeholder="https://..."
                tipo="url"
                onChange={(valor) =>
                  alterarCampo(
                    "link_cadastro",
                    valor
                  )
                }
              />
            </div>
          </section>

          {/* ATENDIMENTO */}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-6">
            <CabecalhoSecao
              icone="💬"
              titulo="Atendimento"
              descricao="Defina como o agente deve iniciar e conduzir as conversas."
            />

            <div className="mt-6">
              <AreaTexto
                titulo="Mensagem inicial"
                valor={
                  configuracao.mensagem_inicial
                }
                placeholder="Olá! Posso te mostrar como funciona..."
                linhas={4}
                onChange={(valor) =>
                  alterarCampo(
                    "mensagem_inicial",
                    valor
                  )
                }
              />
            </div>

            <div className="mt-5">
              <AreaTexto
                titulo="Instruções adicionais para a IA"
                valor={
                  configuracao.instrucoes_ia
                }
                placeholder="Ex.: seja natural, não pressione o cliente, faça uma pergunta por vez..."
                linhas={8}
                onChange={(valor) =>
                  alterarCampo(
                    "instrucoes_ia",
                    valor
                  )
                }
              />

              <p className="mt-2 text-xs text-zinc-500">
                Essas instruções complementam
                as regras de segurança e
                atendimento que já existem no
                sistema.
              </p>
            </div>
          </section>

          {/* STATUS */}

          {erro && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
              ✅ {sucesso}
            </div>
          )}

          {/* SALVAR */}

          <div className="sticky bottom-4 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Cérebro comercial
                </p>

                <p className="text-sm text-zinc-500">
                  As alterações passam a ser
                  usadas nas próximas conversas.
                </p>
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando
                  ? "Salvando..."
                  : "Salvar configurações"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function CabecalhoSecao({
  icone,
  titulo,
  descricao,
}: {
  icone: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-xl">
        {icone}
      </div>

      <div>
        <h2 className="text-lg font-semibold">
          {titulo}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {descricao}
        </p>
      </div>
    </div>
  );
}

function Campo({
  titulo,
  valor,
  placeholder,
  tipo = "text",
  step,
  onChange,
}: {
  titulo: string;
  valor: string;
  placeholder: string;
  tipo?: string;
  step?: string;
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
        step={step}
        placeholder={placeholder}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
      />
    </div>
  );
}

function AreaTexto({
  titulo,
  valor,
  placeholder,
  linhas,
  onChange,
}: {
  titulo: string;
  valor: string;
  placeholder: string;
  linhas: number;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {titulo}
      </label>

      <textarea
        value={valor}
        rows={linhas}
        placeholder={placeholder}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 leading-relaxed text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
      />
    </div>
  );
}