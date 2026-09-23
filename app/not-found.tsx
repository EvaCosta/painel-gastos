export default function NaoEncontrado() {
  return (
    <main className="wrap">
      <div className="center">
        <h1>Link inválido</h1>
        <p style={{ color: "var(--ink-2)", margin: 0 }}>
          Este link não existe ou já não é válido. Pede um novo a quem to enviou.
        </p>
      </div>
    </main>
  );
}
