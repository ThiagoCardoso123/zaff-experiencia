"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/feedbacks", label: "Central de feedbacks" },
  { href: "/admin/qrcodes", label: "QR Codes" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function Nav({ critical }: { critical: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Seções do painel">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
              active ? "bg-cream/15 font-medium text-cream" : "text-cream/75 hover:bg-cream/10 hover:text-cream"
            }`}
          >
            {item.label}
            {item.href === "/admin/feedbacks" && critical > 0 ? (
              <span
                className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-brand"
                title="Avaliações críticas aguardando atendimento"
              >
                {critical}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
