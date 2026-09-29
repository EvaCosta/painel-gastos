"use client";

import { useState, useTransition } from "react";

type Estado = { ok: boolean; mensagem: string } | null;

/**
 * Botão que relê a planilha agora, sem esperar pelo sync diário.
 *
 * A acção corre no servidor — o segredo do cron nunca chega ao browser.
 */
export default function Atualizar({
  acao,
}: {
  acao: () => Promise<{ ok: boolean; mensagem: string }>;
}) {
  const [aPensar, comecar] = useTransition();
  const [estado, setEstado] = useState<Estado>(null);

  return (
    <div className="atualizar">
      <button
        type="button"
        className="botao"
        disabled={aPensar}
        onClick={() => comecar(async () => setEstado(await acao()))}
      >
        {aPensar ? "A reler a planilha…" : "Atualizar agora"}
      </button>

      {estado && (
        <p className={`resultado ${estado.ok ? "ok" : "erro"}`}>{estado.mensagem}</p>
      )}
    </div>
  );
}
