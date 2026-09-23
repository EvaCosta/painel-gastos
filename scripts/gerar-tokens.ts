/**
 * Gera um token de acesso para cada pessoa e grava-o no Firestore.
 * Corre uma vez, no início:  npm run tokens
 * Para rodar o link de alguém (se o link vazar):  npm run tokens -- mae
 */
import { randomBytes } from "node:crypto";
import { PESSOAS } from "../lib/config";
import { db } from "../lib/firestore";

async function principal() {
  const pedidas = process.argv.slice(2).map((s) => s.toLowerCase());
  const alvo = pedidas.length ? PESSOAS.filter((p) => pedidas.includes(p.slug)) : PESSOAS;

  if (!alvo.length) {
    console.error(`Pessoa desconhecida. Disponíveis: ${PESSOAS.map((p) => p.slug).join(", ")}`);
    process.exit(1);
  }

  const firestore = db();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://o-teu-dominio.vercel.app";

  for (const pessoa of alvo) {
    const doc = firestore.collection("pessoas").doc(pessoa.slug);
    const existente = await doc.get();
    const jaTem = existente.exists && existente.data()?.token;

    if (jaTem && !pedidas.length) {
      console.log(`${pessoa.nome.padEnd(10)} já tinha token  →  ${base}/p/${jaTem}`);
      continue;
    }

    const token = randomBytes(16).toString("hex");
    await doc.set(
      { slug: pessoa.slug, nome: pessoa.nome, saudacao: pessoa.saudacao, token },
      { merge: true },
    );
    console.log(`${pessoa.nome.padEnd(10)} ${jaTem ? "token NOVO" : "token criado"}  →  ${base}/p/${token}`);
  }

  console.log("\nEnvia a cada pessoa só o link dela.");
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
