import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("configuracoes")
      .select("*")
      .order("criado_em", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Erro ao buscar configurações:",
        error
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível buscar as configurações.",
          detalhes: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      sucesso: true,
      configuracao: data,
    });
  } catch (error) {
    console.error(
      "Erro interno ao buscar configurações:",
      error
    );

    return NextResponse.json(
      {
        erro: "Erro interno do servidor.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request: Request
) {
  try {
    const body = await request.json();

    const supabase = getSupabase();

    const { data: configuracaoAtual, error: erroBusca } =
      await supabase
        .from("configuracoes")
        .select("id")
        .order("criado_em", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

    if (erroBusca) {
      console.error(
        "Erro ao localizar configuração:",
        erroBusca
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível localizar as configurações.",
        },
        {
          status: 500,
        }
      );
    }

    if (!configuracaoAtual) {
      return NextResponse.json(
        {
          erro:
            "Nenhuma configuração foi encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const nomeNegocio =
      typeof body.nome_negocio === "string"
        ? body.nome_negocio.trim()
        : "";

    const nomeProduto =
      typeof body.nome_produto === "string"
        ? body.nome_produto.trim()
        : "";

    const descricaoProduto =
      typeof body.descricao_produto === "string"
        ? body.descricao_produto.trim()
        : "";

    const linkDemonstracao =
      typeof body.link_demonstracao === "string"
        ? body.link_demonstracao.trim()
        : "";

    const linkCadastro =
      typeof body.link_cadastro === "string"
        ? body.link_cadastro.trim()
        : "";

    const mensagemInicial =
      typeof body.mensagem_inicial === "string"
        ? body.mensagem_inicial.trim()
        : "";

    const instrucoesIa =
      typeof body.instrucoes_ia === "string"
        ? body.instrucoes_ia.trim()
        : "";

    const precoMensal =
      body.preco_mensal === "" ||
      body.preco_mensal === null ||
      body.preco_mensal === undefined
        ? null
        : Number(body.preco_mensal);

    const precoAnual =
      body.preco_anual === "" ||
      body.preco_anual === null ||
      body.preco_anual === undefined
        ? null
        : Number(body.preco_anual);

    if (!nomeNegocio) {
      return NextResponse.json(
        {
          erro:
            "O nome do negócio é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!nomeProduto) {
      return NextResponse.json(
        {
          erro:
            "O nome do produto é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      precoMensal !== null &&
      (
        Number.isNaN(precoMensal) ||
        precoMensal < 0
      )
    ) {
      return NextResponse.json(
        {
          erro:
            "O preço mensal é inválido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      precoAnual !== null &&
      (
        Number.isNaN(precoAnual) ||
        precoAnual < 0
      )
    ) {
      return NextResponse.json(
        {
          erro:
            "O preço anual é inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("configuracoes")
      .update({
        nome_negocio: nomeNegocio,
        nome_produto: nomeProduto,
        descricao_produto:
          descricaoProduto || null,
        link_demonstracao:
          linkDemonstracao || null,
        link_cadastro:
          linkCadastro || null,
        preco_mensal: precoMensal,
        preco_anual: precoAnual,
        mensagem_inicial:
          mensagemInicial || null,
        instrucoes_ia:
          instrucoesIa || null,
      })
      .eq(
        "id",
        configuracaoAtual.id
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Erro ao atualizar configurações:",
        error
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível salvar as configurações.",
          detalhes: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      sucesso: true,
      configuracao: data,
    });
  } catch (error) {
    console.error(
      "Erro interno ao atualizar configurações:",
      error
    );

    return NextResponse.json(
      {
        erro: "Erro interno do servidor.",
      },
      {
        status: 500,
      }
    );
  }
}