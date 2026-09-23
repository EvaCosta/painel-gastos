import { fmtDinheiro, fmtMomento } from "@/lib/formato";
import type { Lancamento, Painel as DadosPainel } from "@/lib/tipos";

function Pastilha({ abatimento }: { abatimento: boolean }) {
  return (
    <span className={`pill ${abatimento ? "done" : "open"}`}>
      {abatimento ? (
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
      <span>{abatimento ? "Você pagou" : "Em aberto"}</span>
    </span>
  );
}

function Linha({ lancamento }: { lancamento: Lancamento }) {
  const abatimento = lancamento.valor < 0;
  const meta = [lancamento.parcela, lancamento.nota].filter(Boolean).join(" · ");

  return (
    <li className={`item${abatimento ? " paid" : ""}`}>
      <span className="desc">{lancamento.descricao}</span>
      <span className="val">{fmtDinheiro(lancamento.valor)}</span>
      {meta && <span className="meta">{meta}</span>}
      <span className="pillwrap"><Pastilha abatimento={abatimento} /></span>
    </li>
  );
}

export default function Painel({ dados, comoAcertar }: { dados: DadosPainel; comoAcertar?: string }) {
  // Mês mais recente primeiro — a ordem vem da posição da aba na planilha.
  const meses = [...dados.meses].sort((a, b) => b.ordem - a.ordem);
  const totalItens = meses.reduce((s, m) => s + m.lancamentos.filter((l) => l.valor > 0).length, 0);

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
        </dl>
      </section>

      {meses.length > 0 ? (
        meses.map((mes) => (
          <section className="ledger" key={mes.nome} aria-label={`Lançamentos de ${mes.nome}`}>
            <h2 className="month">
              {mes.nome}
              <span className="month-total">{fmtDinheiro(mes.total)}</span>
            </h2>
            <ul className="items">
              {mes.lancamentos.map((l) => <Linha key={l.id} lancamento={l} />)}
            </ul>
          </section>
        ))
      ) : (
        <p className="note">Ainda não há lançamentos registados.</p>
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
