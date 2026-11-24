import type { Metadata } from "next";
import { signIn } from "../actions";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";

export const metadata: Metadata = { title: "Entrar · Painel Zaff" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden items-center justify-center overflow-hidden bg-brand lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zaff-selo-creme.svg" alt="" className="w-72" />
      </section>
      <section className="flex items-center justify-center bg-cream px-6 py-16">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zaff-logo.svg" alt="Zaff Gastronomia" className="mb-10 h-20 w-auto lg:hidden" />
          <p className="eyebrow mb-2">Painel de experiência</p>
          <h1 className="mb-8 font-display text-4xl text-brand">Bem-vindo de volta.</h1>
          {erro === "sem-acesso" ? (
            <p role="alert" className="mb-5 rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">
              Esta conta não tem acesso ao painel. Fale com o proprietário.
            </p>
          ) : null}
          <ActionForm action={signIn} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input h-12" />
            </div>
            <div>
              <label className="label" htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className="input h-12" />
            </div>
            <SubmitButton className="btn btn-primary h-12 w-full" pendingLabel="Entrando…">
              Entrar
            </SubmitButton>
          </ActionForm>
        </div>
      </section>
    </main>
  );
}
