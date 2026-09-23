import { notFound } from "next/navigation";
import { carregarResumo } from "@/lib/firestore";
import { fmtDinheiro, fmtMomento } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Comparação em tempo constante — o token do admin abre tudo. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export default async function Admin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado || !igual(token, esperado)) notFound();

  const pessoas = await carregarResumo();
  const total = pessoas.reduce((s, p) => s + p.totalAberto, 0);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  return (
    <main className="wrap">
      <header className="hero">
        <span className="eyebrow">Visão geral — só tua</span>
        <h1>Quem está devendo o quê</h1>
      </header>

      <section className="total">
        <span className="eyebrow">Total a receber</span>
        <span className="amount">{fmtDinheiro(total)}</span>
        <p className="note">Somando as {pessoas.length} pessoas com painel.</p>
      </section>

      <div className="scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Pessoa</th><th>Em aberto</th><th>Itens</th><th>Já pago</th><th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.slug}>
                <td>{p.nome}</td>
                <td className="num">{fmtDinheiro(p.totalAberto)}</td>
                <td className="num">{p.emAberto}</td>
                <td className="num">{fmtDinheiro(p.totalPago)}</td>
                <td>{p.atualizadoEm ? fmtMomento(p.atualizadoEm) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card">
        <h2>Links para enviar</h2>
        <p>Um por pessoa. Envia só o dela — cada link abre apenas o painel do próprio.</p>
        {pessoas.map((p) => (
          <p key={p.slug}>
            {p.nome}: <code>{base}/p/{p.token}</code>
          </p>
        ))}
      </section>
    </main>
  );
}
