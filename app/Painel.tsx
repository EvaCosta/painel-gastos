import { fmtDinheiro, fmtAba, fmtMomento } from "@/lib/formato";
import type { Lancamento, Mes, Painel as DadosPainel } from "@/lib/tipos";

function Pastilha({ pago }: { pago: boolean }) {
  return (
    <span className={`pill ${pago ? "done" : "open"}`}>
      {pago ? (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6.4 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 3.5v2.8l1.8 1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
      <span>{pago ? "Pago" : "Em aberto"}</span>
    </span>
  );
}

function Linha({ lancamento }: { lancamento: Lancamento }) {
  // Uma linha de valor negativo é um acerto já lançado; uma marcada como paga
  // na planilha é a mesma coisa dita de outra maneira. Nenhuma conta para o total.
  const saldado = lancamento.pago || lancamento.valor < 0;

  const meta = [
    lancamento.parcela,
    lancamento.pagoEm && `pago em ${lancamento.pagoEm}`,
  ].filter(Boolean).join(" · ");

  return (
    <li className={`item${saldado ? " paid" : ""}`}>
      <span className="desc">{lancamento.descricao}</span>
      <span className="val">{fmtDinheiro(lancamento.valor)}</span>
      {meta && <span className="meta">{meta}</span>}
      <span className="pillwrap"><Pastilha pago={saldado} /></span>
    </li>
  );
}

/** Um mês: o que está a pagar e, à parte, o que já foi acertado. */
function BlocoMes({ mes, rotuloAberto }: { mes: Mes; rotuloAberto: string }) {
  return (
    <div>
      {mes.abertos.length > 0 && (
        <section className="ledger" aria-label={`${rotuloAberto} — ${fmtAba(mes.nome)}`}>
          <h2 className="month">
            <span>{fmtAba(mes.nome)} · {rotuloAberto.toLowerCase()}</span>
            <span className="month-total">{fmtDinheiro(mes.total)}</span>
          </h2>
          <ul className="items">
            {mes.abertos.map((l) => <Linha key={l.id} lancamento={l} />)}
          </ul>
        </section>
      )}

      {mes.pagos.length > 0 && (
        <section className="ledger" aria-label={`Já acertado — ${fmtAba(mes.nome)}`}>
          <h2 className="month settled">
            <span>{fmtAba(mes.nome)} · já acertado</span>
            <span className="month-total">{fmtDinheiro(mes.totalPago)}</span>
          </h2>
          <ul className="items">
            {mes.pagos.map((l) => <Linha key={l.id} lancamento={l} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Painel({ dados, comoAcertar }: { dados: DadosPainel; comoAcertar?: string }) {
  // Mês mais recente primeiro — a ordem vem da posição da aba na planilha.
  const meses = [...dados.meses].sort((a, b) => b.ordem - a.ordem);
  const totalItens = meses.reduce((s, m) => s + m.abertos.filter((l) => l.valor > 0).length, 0);
  const temPagos = meses.some((m) => m.pagos.length > 0);
  // Painéis gravados antes de haver meses seguintes não trazem o campo.
  const proximos = (dados.proximos ?? []).filter((m) => m.abertos.length || m.pagos.length);

  return (
    <main className="wrap">
      <header className="hero">
        <span className="eyebrow">Painel pessoal</span>
        <h1>{dados.saudacao}</h1>
        <p>Isto é o que ficou em aberto das compras e contas que passei por você.</p>
      </header>

      <section className="total">
        <span className="eyebrow">Total em aberto</span>
        <span className={`amount${dados.total <= 0 ? " settled" : ""}`}>
          {fmtDinheiro(dados.total)}
        </span>
        <p className="note">
          {dados.total <= 0
            ? "Está tudo acertado — nada em aberto por aqui."
            : `Somando ${totalItens} ${totalItens === 1 ? "item" : "itens"} em ${meses.length} ${meses.length === 1 ? "mês" : "meses"}.`}
        </p>
        <dl className="stats">
          {meses.map((m) => (
            <div key={m.nome}>
              <dt>{m.nome}</dt>
              <dd>{fmtDinheiro(m.total)}</dd>
            </div>
          ))}
          {temPagos && (
            <div>
              <dt>Já acertado</dt>
              <dd className="ok">{fmtDinheiro(dados.totalPago)}</dd>
            </div>
          )}
        </dl>
      </section>

      {meses.length > 0 ? (
        meses.map((mes) => <BlocoMes key={mes.nome} mes={mes} rotuloAberto="A pagar" />)
      ) : (
        <p className="note">Ainda não há lançamentos registados.</p>
      )}

      {proximos.length > 0 && (
        // <details> abre e fecha sem JavaScript: a página continua a ser só
        // HTML vindo do servidor, como o resto do painel.
        <details className="proximos">
          <summary>
            <span className="proximos-titulo">
              <span>Ver os próximos meses</span>
              <span className="proximos-sub">
                {proximos.map((m) => fmtAba(m.nome)).join(", ")} · ainda não venceram
              </span>
            </span>
            <span className="month-total">{fmtDinheiro(dados.totalProximos)}</span>
          </summary>
          <p className="note">
            Parcelas que já estão lançadas para as próximas faturas. Não entram no
            total de cima — cada uma passa para lá quando chegar a fatura dela.
          </p>
          {proximos.map((mes) => <BlocoMes key={mes.nome} mes={mes} rotuloAberto="Vai cair" />)}
        </details>
      )}

      {comoAcertar && (
        <section className="card">
          <h2>Como acertar</h2>
          <p>Pode pagar tudo de uma vez ou mês a mês — é só avisar, que dou baixa aqui no painel.</p>
          <p><code>{comoAcertar}</code></p>
        </section>
      )}

      <footer>
        {dados.atualizadoEm ? <>Atualizado em <strong>{fmtMomento(dados.atualizadoEm)}</strong>. </> : null}
        Este painel mostra <strong>apenas os seus lançamentos</strong> — cada pessoa tem o seu próprio
        link, e ninguém vê o do outro.
      </footer>
    </main>
  );
}
