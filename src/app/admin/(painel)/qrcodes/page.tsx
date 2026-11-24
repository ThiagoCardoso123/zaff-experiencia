import { QrGenerator } from "@/components/admin/QrGenerator";
import { createClient } from "@/lib/supabase/server";

export default async function QrCodesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurant_tables").select("label").eq("active", true);
  const tables = (data ?? [])
    .map((t) => t.label as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">QR Codes inteligentes</p>
        <h1 className="mt-1 font-display text-4xl text-brand">Códigos de avaliação</h1>
        <p className="mt-1 text-sm text-muted">
          Cada código leva ao formulário e registra automaticamente de onde veio a avaliação.
        </p>
      </header>
      {!siteUrl ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">
          A variável NEXT_PUBLIC_SITE_URL não está definida. Os códigos abaixo usam o endereço atual
          do painel; defina o domínio definitivo antes de imprimir.
        </p>
      ) : null}
      <QrGenerator tables={tables} siteUrl={siteUrl} />
    </div>
  );
}
