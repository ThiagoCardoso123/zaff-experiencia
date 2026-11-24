import "server-only";
import { unstable_cache } from "next/cache";
import { resolveBrand } from "./brand";
import { createServiceClient } from "./supabase/service";
import type { BrandSettings, PublicConfig, Question, Settings } from "./types";

export const CONFIG_TAG = "zaff-config";

const loadRaw = unstable_cache(
  async () => {
    const db = createServiceClient();
    const [settings, questions, tables] = await Promise.all([
      db.from("settings").select("*").eq("id", 1).single(),
      db.from("questions").select("*").order("sort_order"),
      db.from("restaurant_tables").select("label").eq("active", true),
    ]);
    if (settings.error) throw new Error(settings.error.message);
    if (questions.error) throw new Error(questions.error.message);
    return {
      settings: settings.data as Settings,
      questions: (questions.data ?? []) as Question[],
      tables: (tables.data ?? []).map((t) => t.label as string),
    };
  },
  ["zaff-config"],
  { tags: [CONFIG_TAG], revalidate: 300 },
);

export async function getConfig() {
  return loadRaw();
}

export async function getBrand(): Promise<BrandSettings> {
  try {
    return (await loadRaw()).settings.brand ?? {};
  } catch {
    return {};
  }
}

export async function getPublicConfig(): Promise<{ config: PublicConfig; tables: string[] }> {
  const { settings, questions, tables } = await loadRaw();
  return {
    tables,
    config: {
      // "overall" é sempre exibida: é ela que define o tom do restante do fluxo.
      questions: questions
        .filter((q) => q.enabled || q.key === "overall")
        .map(({ key, title, title_negative }) => ({ key, title, title_negative })),
      welcome_title: settings.welcome_title,
      welcome_body: settings.welcome_body,
      thanks_positive_title: settings.thanks_positive_title,
      thanks_positive_body: settings.thanks_positive_body,
      thanks_negative_title: settings.thanks_negative_title,
      thanks_negative_body: settings.thanks_negative_body,
      google_review_url: /^https:\/\//.test(settings.google_review_url) ? settings.google_review_url : "",
      logo_url: resolveBrand(settings.brand).logoUrl,
    },
  };
}
