"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { HOUR_BANDS, WEEKDAY_LABELS } from "@/lib/constants";

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Mês atual" },
  { key: "custom", label: "Personalizado" },
];

export function Filters({
  tables,
  period,
  from,
  to,
}: {
  tables: string[];
  period: string;
  /** datas efetivas do período (AAAA-MM-DD), usadas para preencher o personalizado */
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const select = "input h-9 w-auto min-w-[150px] pr-8";
  const hasExtra = params.get("dia") || params.get("horario") || params.get("mesa");

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}
      aria-busy={pending}
    >
      <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() =>
              update(
                p.key === "custom"
                  ? { periodo: "custom", de: from, ate: to }
                  : { periodo: p.key, de: null, ate: null },
              )
            }
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] transition ${
              period === p.key ? "bg-brand text-cream" : "text-ink hover:bg-cream"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "custom" ? (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <input
            type="date"
            aria-label="Data inicial"
            className="input h-9 w-auto"
            defaultValue={from}
            max={to}
            onChange={(e) => e.target.value && update({ de: e.target.value })}
          />
          até
          <input
            type="date"
            aria-label="Data final"
            className="input h-9 w-auto"
            defaultValue={to}
            min={from}
            onChange={(e) => e.target.value && update({ ate: e.target.value })}
          />
        </div>
      ) : null}

      <select
        aria-label="Dia da semana"
        className={select}
        value={params.get("dia") ?? ""}
        onChange={(e) => update({ dia: e.target.value || null })}
      >
        <option value="">Todos os dias</option>
        {WEEKDAY_LABELS.map((label, i) => (
          <option key={label} value={i}>{label}</option>
        ))}
      </select>

      <select
        aria-label="Horário"
        className={select}
        value={params.get("horario") ?? ""}
        onChange={(e) => update({ horario: e.target.value || null })}
      >
        <option value="">Todos os horários</option>
        {HOUR_BANDS.map((b) => (
          <option key={b.key} value={b.key}>{b.label}</option>
        ))}
      </select>

      <select
        aria-label="Mesa"
        className={select}
        value={params.get("mesa") ?? ""}
        onChange={(e) => update({ mesa: e.target.value || null })}
      >
        <option value="">Todas as mesas</option>
        {tables.map((t) => (
          <option key={t} value={t}>Mesa {t}</option>
        ))}
      </select>

      {hasExtra ? (
        <button
          type="button"
          className="cursor-pointer text-[13px] text-muted underline underline-offset-4 hover:text-brand"
          onClick={() => update({ dia: null, horario: null, mesa: null })}
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
