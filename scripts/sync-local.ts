/**
 * Corre o sync a partir da máquina, sem passar pelo endpoint.
 * É por aqui que se confere o que a planilha deu antes de pôr no ar:
 *   npm run sync
 */
import { ABAS, PESSOAS } from "../lib/config";
import { gravarPessoa } from "../lib/firestore";
import { encontrarBlocos, extrairLancamentos, lerPlanilha, mapearColunas } from "../lib/planilha";

async function principal() {
  const gravar = !process.argv.includes("--seco");

  console.log(`Abas: ${ABAS.join(", ")}\n`);
  const abas = await lerPlanilha();

  for (const aba of abas) {
    const mapa = mapearColunas(aba);
    if (!mapa) { console.warn(`  ${aba.nome}: sem cabeçalho reconhecido`); continue; }
    const blocos = encontrarBlocos(aba, mapa);
    console.log(`  ${aba.nome}: cabeçalho na linha ${mapa.cabecalho + 1}, ${blocos.length} blocos`);
    for (const b of blocos) {
      console.log(`      ${b.rotulo.padEnd(10)} linhas ${b.linhaIni + 1}-${b.linhaFim}`);
    }
  }

  const { porPessoa, lidas, ignoradas, avisos } = await extrairLancamentos(abas);
  console.log(`\n${lidas} lançamentos reconhecidos, ${ignoradas} linhas ignoradas.`);
  for (const aviso of avisos) console.warn("  aviso:", aviso);

  console.log("");
  for (const pessoa of PESSOAS) {
    const lancamentos = porPessoa.get(pessoa.slug) ?? [];
    const abertos = lancamentos.filter((l) => !l.pago);
    const saldo = abertos.reduce((s, l) => s + l.valor, 0);
    const pagos = lancamentos.length - abertos.length;

    // Por mês, na ordem das abas.
    const porMes = new Map<string, number>();
    for (const l of abertos) porMes.set(l.mes, (porMes.get(l.mes) ?? 0) + l.valor);
    const meses = [...porMes.entries()]
      .map(([m, v]) => `${m} ${v.toFixed(2)}`)
      .join("  ·  ");

    const linha =
      `${pessoa.nome.padEnd(10)} ${String(lancamentos.length).padStart(3)} lanç.` +
      `   saldo ${saldo.toFixed(2).padStart(9)}` +
      `${pagos ? `  (${pagos} pagos)` : ""}   ${meses}`;

    if (!gravar) { console.log(linha, " (seco)"); continue; }
    const { escritos, removidos } = await gravarPessoa(pessoa.slug, lancamentos);
    console.log(linha + (removidos ? `   (${removidos} removidos)` : ""), `[${escritos} gravados]`);
  }
}

principal().catch((erro) => { console.error(erro); process.exit(1); });
