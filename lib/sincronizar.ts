import { PESSOAS } from "./config";
import { gravarPessoa } from "./firestore";
import { extrairLancamentos, lerPlanilha } from "./planilha";
import type { ResultadoSync } from "./tipos";

/**
 * Relê a planilha e reescreve os lançamentos de cada pessoa.
 *
 * Usada pelo cron diário e pelo botão do painel de admin — o mesmo caminho nos
 * dois casos, para não haver uma versão que funciona e outra que não.
 */
export async function sincronizar(): Promise<ResultadoSync> {
  const abas = await lerPlanilha();
  const { porPessoa, lidas, ignoradas, avisos } = await extrairLancamentos(abas);

  const resultado: ResultadoSync = { lidas, ignoradas, porPessoa: {}, avisos };

  for (const pessoa of PESSOAS) {
    resultado.porPessoa[pessoa.slug] = await gravarPessoa(
      pessoa.slug,
      porPessoa.get(pessoa.slug) ?? [],
    );
  }

  return resultado;
}
