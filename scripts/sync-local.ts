/**
 * Corre o sync a partir da máquina, sem passar pelo endpoint.
 * Útil para o primeiro carregamento e para depurar o mapeamento de colunas:
 *   npm run sync
 */
import { PESSOAS } from "../lib/config";
import { gravarPessoa } from "../lib/firestore";
import { extrairLancamentos, lerPlanilha, mapearColunas } from "../lib/planilha";

async function principal() {
  const linhas = await lerPlanilha();
  console.log(`Li ${linhas.length} linhas da planilha.`);

  const encontrado = mapearColunas(linhas);
  if (encontrado) {
    console.log(`Cabeçalho na linha ${encontrado.cabecalho + 1}:`, encontrado.mapa);
  }

  const { porPessoa, lidas, ignoradas, avisos } = await extrairLancamentos(linhas);
  console.log(`\n${lidas} lançamentos reconhecidos, ${ignoradas} linhas ignoradas.`);
  for (const aviso of avisos) console.warn("  aviso:", aviso);

  console.log("");
  for (const pessoa of PESSOAS) {
    const lancamentos = porPessoa.get(pessoa.slug) ?? [];
    const aberto = lancamentos.filter((l) => !l.pago).reduce((s, l) => s + l.valor, 0);
    const { escritos, removidos } = await gravarPessoa(pessoa.slug, lancamentos);
    console.log(
      `${pessoa.nome.padEnd(10)} ${String(escritos).padStart(4)} lançamentos` +
      `${removidos ? ` (${removidos} removidos)` : ""}  ·  em aberto ${aberto.toFixed(2)}`,
    );
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
