import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente service_role: ignora RLS. Só pode ser importado no servidor
 * (o pacote `server-only` quebra o build se alguém importar no cliente).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
