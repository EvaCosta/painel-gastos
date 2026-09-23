/** Utilitários de parsing — tolerantes, porque uma planilha real é irregular. */

/** minúsculas, sem acentos, sem espaços a mais. */
export function chave(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lê um valor monetário escrito à brasileira ou à inglesa.
 * "R$ 1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "(50)" → -50
 */
export function lerValor(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;

  let texto = String(bruto ?? "").trim();
  if (!texto) return null;

  const negativo = /^\(.*\)$/.test(texto) || texto.includes("-");
  texto = texto.replace(/[()]/g, "").replace(/[^\d.,]/g, "");
  if (!texto) return null;

  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Os dois presentes: o último é o decimal, o outro é o milhar.
    if (ultimaVirgula > ultimoPonto) texto = texto.replace(/\./g, "").replace(",", ".");
    else texto = texto.replace(/,/g, "");
  } else if (ultimaVirgula >= 0 || ultimoPonto >= 0) {
    // Só um separador: ambíguo. "1.500" é mil e quinhentos numa planilha
    // brasileira, mas "186.40" é cento e oitenta e seis e quarenta.
    // Três dígitos a seguir ao separador só fazem sentido como milhar.
    const [inteiro, resto] = texto.split(/[.,]/);
    texto = resto.length === 3 ? inteiro + resto : `${inteiro}.${resto}`;
  }

  const n = Number.parseFloat(texto);
  if (!Number.isFinite(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/**
 * Lê uma data em qualquer dos formatos que aparecem numa planilha e devolve
 * `YYYY-MM-DD`. Devolve null se não conseguir — a linha é então ignorada com aviso.
 */
export function lerData(bruto: unknown, anoPadrao = new Date().getUTCFullYear()): string | null {
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) {
    return bruto.toISOString().slice(0, 10);
  }

  const texto = String(bruto ?? "").trim();
  if (!texto) return null;

  // Número de série do Sheets/Excel (dias desde 1899-12-30)
  if (/^\d{5}$/.test(texto)) {
    const ms = (Number(texto) - 25569) * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // 2026-09-19
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 19/09/2026 · 19-09-26 · 19.09.2026  (dia primeiro, convenção pt)
  const numerica = texto.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (numerica) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let ano = numerica[3] ? Number(numerica[3]) : anoPadrao;
    if (ano < 100) ano += 2000;
    return montar(ano, mes, dia);
  }

  // "19 de setembro", "5 de mar de 2026", "12 set 2026"
  const porExtenso = texto.match(/(\d{1,2})\s*(?:de\s+)?([a-zç]{3,})\.?(?:\s*(?:de\s+)?(\d{4}))?/i);
  if (porExtenso) {
    const dia = Number(porExtenso[1]);
    const mes = MESES[porExtenso[2]
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().slice(0, 3)];
    if (mes) return montar(porExtenso[3] ? Number(porExtenso[3]) : anoPadrao, mes, dia);
  }

  return null;
}

function montar(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

/** Id determinístico de uma linha, para o sync poder reescrever sem duplicar. */
export async function idDaLinha(
  slug: string, data: string, descricao: string, valor: number, ordem: number,
): Promise<string> {
  const material = `${slug}|${data}|${chave(descricao)}|${valor.toFixed(2)}|${ordem}`;
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
