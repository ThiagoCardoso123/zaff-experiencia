import { NextResponse, type NextRequest } from "next/server";
import { retryPendingEmails } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reenvio automático. A Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const result = await retryPendingEmails(50);
  return NextResponse.json(result);
}
