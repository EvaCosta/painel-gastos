import { notFound } from "next/navigation";
import Painel from "@/app/Painel";
import { carregarPainel, pessoaPorToken } from "@/lib/firestore";

/** Nunca em cache: um painel em cache podia ser servido à pessoa errada. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PainelPessoa({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const slug = await pessoaPorToken(token);
  if (!slug) notFound();

  const dados = await carregarPainel(slug);
  if (!dados) notFound();

  return <Painel dados={dados} comoAcertar={process.env.INSTRUCOES_PAGAMENTO} />;
}
