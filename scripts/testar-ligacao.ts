/**
 * Confere que as credenciais chegam ao Firestore e à planilha, sem gravar nada
 * de permanente:  npm run testar
 */
import { db } from "../lib/firestore";
import { lerPlanilha, mapearColunas, encontrarBlocos } from "../lib/planilha";

async function principal() {
  console.log("Firestore");
  const firestore = db();
  const doc = firestore.collection("_teste").doc("ligacao");
  await doc.set({ quando: new Date().toISOString() });
  await doc.get();
  await doc.delete();
  const pessoas = await firestore.collection("pessoas").get();
  console.log(`  ✓ escrita, leitura e apagar OK · colecção "pessoas": ${pessoas.size} documentos\n`);

  console.log("Google Sheets");
  const abas = await lerPlanilha();
  for (const aba of abas) {
    const mapa = mapearColunas(aba);
    if (!mapa) { console.log(`  ✗ ${aba.nome}: sem cabeçalho reconhecido`); continue; }
    const blocos = encontrarBlocos(aba, mapa);
    console.log(`  ✓ ${aba.nome}: ${aba.celulas.length} linhas, ${blocos.length} blocos ` +
      `(${blocos.map((b) => b.rotulo).join(", ")})`);
  }
}

principal().catch((e) => { console.error("\n✗", e instanceof Error ? e.message : e); process.exit(1); });
