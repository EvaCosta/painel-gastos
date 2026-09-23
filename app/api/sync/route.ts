import { NextResponse } from "next/server";
import { PESSOAS } from "@/lib/config";
import { gravarPessoa } from "@/lib/firestore";
import { extrairLancamentos, lerPlanilha } from "@/lib/planilha";
import type { ResultadoSync } from "@/lib/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Comparação em tempo constante do segredo do cron. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

function autorizado(pedido: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;

  const cabecalho = pedido.headers.get("authorization") ?? "";
  const prefixo = "Bearer ";
  if (!cabecalho.startsWith(prefixo)) return false;
  return igual(cabecalho.slice(prefixo.length), segredo);
}

/**
 * Relê a planilha e reescreve os lançamentos de cada pessoa.
 * Chamado pelo Vercel Cron (ver vercel.json) e à mão quando se quer forçar.
 */
export async function GET(pedido: Request) {
  if (!autorizado(pedido)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  try {
    const abas = await lerPlanilha();
    const { porPessoa, lidas, ignoradas, avisos } = await extrairLancamentos(abas);

    const resultado: ResultadoSync = { lidas, ignoradas, porPessoa: {}, avisos };

    for (const pessoa of PESSOAS) {
      const lancamentos = porPessoa.get(pessoa.slug) ?? [];
      resultado.porPessoa[pessoa.slug] = await gravarPessoa(pessoa.slug, lancamentos);
    }

    return NextResponse.json({ ok: true, em: new Date().toISOString(), ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[sync] falhou:", mensagem);
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}
