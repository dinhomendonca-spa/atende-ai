import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  }

  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY não configurada.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/*
=====================================================
GET /api/leads
Lista todos os leads
=====================================================
*/

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("criado_em", {
        ascending: false,
      });

    if (error) {
      console.error("Erro ao buscar leads:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível buscar os leads.",
          detalhes: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      sucesso: true,
      leads: data ?? [],
    });
  } catch (error) {
    console.error("Erro interno ao buscar leads:", error);

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

/*
=====================================================
POST /api/leads
Cria um novo lead
=====================================================
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nome =
      typeof body.nome === "string"
        ? body.nome.trim()
        : "";

    const empresa =
      typeof body.empresa === "string"
        ? body.empresa.trim()
        : "";

    const telefone =
      typeof body.telefone === "string"
        ? body.telefone.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const instagram =
      typeof body.instagram === "string"
        ? body.instagram.trim()
        : "";

    const interesse =
      typeof body.interesse === "string"
        ? body.interesse.trim()
        : "";

    const observacoes =
      typeof body.observacoes === "string"
        ? body.observacoes.trim()
        : "";

    if (!nome) {
      return NextResponse.json(
        {
          erro: "O nome do lead é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("leads")
      .insert({
        nome,
        empresa: empresa || null,
        telefone: telefone || null,
        email: email || null,
        instagram: instagram || null,
        interesse: interesse || null,
        observacoes: observacoes || null,
        origem: "manual",
        status: "novo",
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao cadastrar lead:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível cadastrar o lead.",
          detalhes: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        lead: data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Erro interno ao cadastrar lead:", error);

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