import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export interface AdminSession {
  userId: string;
  email: string;
  role: "owner" | "admin";
}

/**
 * Garante que quem chama é um administrador cadastrado.
 * Estar logado no Supabase não basta: é preciso constar em admin_users.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    // Cookies só podem ser apagados em uma rota; ela encerra a sessão e volta ao login.
    redirect("/admin/sair?erro=sem-acesso");
  }
  return { userId: user.id, email: user.email ?? "", role: data.role };
}
