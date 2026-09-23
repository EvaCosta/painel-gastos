export const dynamic = "force-dynamic";

/** A raiz não revela nada: quem não tem link não tem nada para ver aqui. */
export default function Home() {
  return (
    <main className="wrap">
      <div className="center">
        <h1>Nada por aqui</h1>
        <p style={{ color: "var(--ink-2)", margin: 0 }}>
          Este endereço só funciona com o link pessoal que te foi enviado.
        </p>
      </div>
    </main>
  );
}
