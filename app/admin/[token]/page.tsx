import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { carregarResumo } from "@/lib/firestore";
import { fmtDinheiro, fmtMomento } from "@/lib/formato";
import { diagnosticoDaConfiguracao } from "@/lib/diagnostico";
import { sincronizar } from "@/lib/sincronizar";
import Atualizar from "./Atualizar";

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

  // Corre no servidor. O browser só recebe o resultado em texto.
  async function relerAgora() {
    "use server";

    const { token: pedido } = await params;
    const segredo = process.env.ADMIN_TOKEN;
    if (!segredo || !igual(pedido, segredo)) {
      return { ok: false, mensagem: "Não autorizado." };
    }

    try {
      const r = await sincronizar();
      revalidatePath(`/admin/${pedido}`);

      const aviso = r.avisos.length
        ? ` ${r.avisos.length} ${r.avisos.length === 1 ? "aviso" : "avisos"}.`
        : "";
      return {
        ok: true,
        mensagem: `Pronto: ${r.lidas} lançamentos lidos da planilha.${aviso} ` +
          "Recarrega a página para ver os números novos.",
      };
    } catch (erro) {
      return {
        ok: false,
        mensagem: erro instanceof Error ? erro.message : "Falhou a leitura da planilha.",
      };
    }
  }

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
        <h2>Configuração</h2>
        <p>O que a app está a usar agora. Serve para não ires às definições da Vercel.</p>
        <dl className="config">
          {diagnosticoDaConfiguracao().map((l) => (
            <div key={l.rotulo}>
              <dt>{l.rotulo}</dt>
              <dd>
                {l.ok === null ? null : <span className={l.ok ? "sinal ok" : "sinal mau"}>{l.ok ? "✓" : "✗"}</span>}
                <code>{l.valor}</code>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2>Atualizar</h2>
        <p>
          A planilha é relida todos os dias às 6h da manhã. Carrega aqui para
          não esperares — depois de mexeres nela, por exemplo.
        </p>
        <Atualizar acao={relerAgora} />
      </section>

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
