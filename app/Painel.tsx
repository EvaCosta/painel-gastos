import { fmtDia, fmtDiaCurto, fmtDinheiro, fmtMes, fmtMomento } from "@/lib/formato";
import type { Lancamento, Painel as DadosPainel } from "@/lib/tipos";

const SEM_DATA = "1970-01-01";

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
      <span>{pago ? "Você pagou" : "Em aberto"}</span>
    </span>
  );
}

function Linha({ lancamento }: { lancamento: Lancamento }) {
  const abatimento = lancamento.valor < 0;
  return (
    <li className={`item${abatimento ? " paid" : ""}`}>
      <span className="desc">{lancamento.descricao}</span>
      <span className="val">{fmtDinheiro(lancamento.valor)}</span>
      <span className="meta">
        {[lancamento.mes, lancamento.data === SEM_DATA ? null : fmtDia(lancamento.data), lancamento.nota]
          .filter(Boolean).join(" · ")}
      </span>
      <span className="pillwrap"><Pastilha pago={lancamento.valor < 0} /></span>
    </li>
  );
}

export default function Painel({ dados, comoAcertar }: { dados: DadosPainel; comoAcertar?: string }) {
  const lancamentos = [...dados.lancamentos].sort((a, b) => b.data.localeCompare(a.data));
  const abertos = lancamentos.filter((l) => l.valor > 0);

  const maisAntigo = abertos.length ? abertos[abertos.length - 1].data : null;

  // Agrupar por mês, mantendo a ordem decrescente.
  const meses: Array<{ chave: string; itens: Lancamento[] }> = [];
  for (const l of lancamentos) {
    const chave = l.data === SEM_DATA ? "sem-data" : l.data.slice(0, 7);
    const ultimo = meses[meses.length - 1];
    if (ultimo?.chave === chave) ultimo.itens.push(l);
    else meses.push({ chave, itens: [l] });
  }

  return (
    <main className="wrap">
      <header className="hero">
        <span className="eyebrow">Painel pessoal</span>
        <h1>{dados.saudacao}</h1>
        <p>Isto é o que ficou em aberto das compras e contas que passei por você.</p>
      </header>

      <section className="total">
        <span className="eyebrow">Total em aberto</span>
        <span className={`amount${dados.totalAberto === 0 ? " settled" : ""}`}>
          {fmtDinheiro(dados.totalAberto)}
        </span>
        <p className="note">
          {dados.totalAberto === 0
            ? "Está tudo acertado — nada em aberto por aqui."
            : `Somando ${abertos.length} ${abertos.length === 1 ? "lançamento" : "lançamentos"} ainda não pagos.`}
        </p>
        <dl className="stats">
          <div><dt>Já pago por você</dt><dd>{fmtDinheiro(dados.totalPago)}</dd></div>
          <div><dt>Itens</dt><dd>{abertos.length}</dd></div>
          <div><dt>Mais antigo</dt><dd>{maisAntigo && maisAntigo !== SEM_DATA ? fmtDiaCurto(maisAntigo) : "—"}</dd></div>
        </dl>
      </section>

      {lancamentos.length > 0 ? (
        <section className="ledger" aria-label="Lançamentos">
          {meses.map(({ chave, itens }) => (
            <div key={chave}>
              <h2 className="month">{chave === "sem-data" ? "Sem data" : fmtMes(`${chave}-01`)}</h2>
              <ul className="items">
                {itens.map((l) => <Linha key={l.id} lancamento={l} />)}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <p className="note">Ainda não há lançamentos registados.</p>
      )}

      {comoAcertar && (
        <section className="card">
          <h2>Como acertar</h2>
          <p>Pode pagar tudo de uma vez ou item a item — é só avisar quais, que dou baixa aqui no painel.</p>
          <p><code>{comoAcertar}</code></p>
        </section>
      )}

      <footer>
        {dados.atualizadoEm
          ? <>Atualizado em <strong>{fmtMomento(dados.atualizadoEm)}</strong>. </>
          : null}
        Este painel mostra <strong>apenas os seus lançamentos</strong> — cada pessoa tem o seu próprio
        link, e ninguém vê o do outro.
      </footer>
    </main>
  );
}
