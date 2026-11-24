import type { Metadata } from "next";
import { getConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Privacidade · Zaff Gastronomia" };
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  let contact = "";
  try {
    contact = (await getConfig()).settings.privacy_contact;
  } catch {
    /* página continua legível mesmo sem banco */
  }

  return (
    <main className="min-h-dvh bg-cream px-6 py-12 text-ink">
      <article className="mx-auto max-w-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zaff-logo.svg" alt="Zaff Gastronomia" className="mb-10 h-20 w-auto" />
        <h1 className="mb-6 font-display text-4xl text-brand">Privacidade da sua avaliação</h1>
        <div className="space-y-5 text-[15px] leading-relaxed">
          <p>
            Esta página explica, de forma direta, o que o Zaff Gastronomia faz com as informações
            enviadas no formulário de avaliação, em conformidade com a Lei Geral de Proteção de
            Dados (Lei nº 13.709/2018).
          </p>
          <h2 className="pt-2 font-display text-2xl text-brand">O que coletamos</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Suas notas e comentários sobre a visita.</li>
            <li>A mesa ou a origem do QR Code utilizado, quando houver.</li>
            <li>
              Nome e WhatsApp, <strong>somente se você decidir informá-los</strong>. O WhatsApp só é
              guardado quando você autoriza o contato.
            </li>
          </ul>
          <p>
            Não usamos cookies de rastreamento nem exigimos cadastro. Para evitar envios
            automatizados, guardamos apenas um código irreversível derivado do endereço de conexão,
            que não permite identificar você.
          </p>
          <h2 className="pt-2 font-display text-2xl text-brand">Para que usamos</h2>
          <p>
            Exclusivamente para avaliar e melhorar nossa comida, nosso atendimento e nosso ambiente
            e, quando autorizado, para falar com você sobre a sua avaliação. Não compartilhamos seus
            dados com terceiros para fins de marketing.
          </p>
          <h2 className="pt-2 font-display text-2xl text-brand">Seus direitos</h2>
          <p>
            Você pode pedir, a qualquer momento, a confirmação, a correção ou a exclusão dos seus
            dados pessoais.
            {contact ? (
              <>
                {" "}
                Basta falar com a gente: <strong>{contact}</strong>.
              </>
            ) : (
              <> Basta falar com a nossa equipe no restaurante.</>
            )}
          </p>
        </div>
      </article>
    </main>
  );
}
