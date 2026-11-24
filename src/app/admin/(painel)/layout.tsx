import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "../actions";
import { Nav } from "@/components/admin/Nav";
import { requireAdmin } from "@/lib/auth";
import { countCriticalOpen } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel · Zaff Gastronomia" };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const critical = await countCriticalOpen(await createClient());

  return (
    <div className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 bg-brand px-4 py-5 text-cream lg:sticky lg:top-0 lg:h-dvh lg:py-7">
        <Link href="/admin" className="px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zaff-logo-creme.svg" alt="Zaff Gastronomia" className="h-14 w-auto lg:h-20" />
        </Link>
        <Nav critical={critical} />
        <div className="mt-auto hidden border-t border-cream/15 px-2 pt-4 text-xs text-cream/70 lg:block">
          <p className="truncate" title={admin.email}>{admin.email}</p>
          <form action={signOut}>
            <button type="submit" className="mt-2 cursor-pointer underline underline-offset-4 hover:text-cream">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 px-5 py-7 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1180px]">{children}</div>
        <form action={signOut} className="mt-10 text-center lg:hidden">
          <button type="submit" className="text-sm text-muted underline">Sair</button>
        </form>
      </div>
    </div>
  );
}
