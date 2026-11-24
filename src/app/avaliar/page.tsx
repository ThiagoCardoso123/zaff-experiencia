import Survey, { type SurveyOrigin } from "@/components/survey/Survey";
import "@/components/survey/survey.css";
import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function AvaliarPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;

  let loaded: Awaited<ReturnType<typeof getPublicConfig>>;
  try {
    loaded = await getPublicConfig();
  } catch {
    return <Unavailable />;
  }

  // A mesa só é exibida/registrada se estiver cadastrada e ativa.
  const mesa = one(sp.mesa).slice(0, 20);
  const origemRaw = one(sp.origem);
  const origin: SurveyOrigin = {
    mesa: mesa && loaded.tables.includes(mesa) ? mesa : null,
    origem: origemRaw === "comanda" || origemRaw === "promo" ? origemRaw : null,
    campanha: one(sp.campanha).slice(0, 60) || null,
  };

  return <Survey config={loaded.config} origin={origin} />;
}

function Unavailable() {
  return (
    <main className="zf zf--dark">
      <div className="zf-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zaff-logo-creme.svg" alt="Zaff Gastronomia" className="zf-hero__logo" />
        <h1 className="zf-hero__title">Voltamos em instantes.</h1>
        <p className="zf-hero__body">
          Não foi possível carregar a avaliação agora. Por favor, tente novamente em alguns minutos.
        </p>
      </div>
    </main>
  );
}
