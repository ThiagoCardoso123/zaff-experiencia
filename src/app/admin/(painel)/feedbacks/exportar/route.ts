import { NextResponse, type NextRequest } from "next/server";
import { CATEGORY_KEYS, CATEGORY_LABELS, OVERALL_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, localParts } from "@/lib/dates";
import { originLabel } from "@/lib/email";
import { applyFeedbackFilters, fetchAll, parseFeedbackFilters } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Protege contra fórmulas maliciosas ao abrir no Excel e escapa o separador. */
function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });

  const filters = parseFeedbackFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows } = await fetchAll<Review>(() =>
    applyFeedbackFilters(supabase.from("reviews").select("*"), filters)
      .order("created_at", { ascending: false })
      .order("id"),
  );

  const header = [
    "Data e horário",
    "Origem",
    "Mesa",
    "Nota geral",
    "Classificação",
    ...CATEGORY_KEYS.map((k) => CATEGORY_LABELS[k]),
    "NPS (0-10)",
    "Pontos assinalados",
    "Comentário",
    "Nome",
    "WhatsApp",
    "Autorizou contato",
    "Status",
  ];

  const lines = rows.map((r) =>
    [
      formatDateTime(r.created_at),
      originLabel(r),
      r.table_label,
      r.overall,
      OVERALL_LABELS[r.overall],
      ...CATEGORY_KEYS.map((k) => r[k]),
      r.nps,
      r.tags.join(", "),
      r.comment,
      r.contact_name,
      // contato só é exportado quando o cliente autorizou
      r.contact_consent ? r.contact_whatsapp : "",
      r.contact_consent ? "Sim" : "Não",
      STATUS_LABELS[r.status],
    ]
      .map(cell)
      .join(";"),
  );

  // BOM + ponto e vírgula: abre corretamente no Excel em português.
  const csv = `﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}`;
  const stamp = localParts(new Date()).ymd;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zaff-avaliacoes-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
