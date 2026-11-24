import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Encerra a sessão e volta ao login (usado quando a conta não é de administrador). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const login = new URL("/admin/login", request.url);
  if (request.nextUrl.searchParams.get("erro") === "sem-acesso") login.searchParams.set("erro", "sem-acesso");
  return NextResponse.redirect(login);
}
