import type { BrandSettings } from "./types";

/** Cores oficiais do Zaff, extraídas do manual de identidade visual. */
export const BRAND_DEFAULTS = {
  primary: "#882214", // vermelho tijolo
  background: "#EBE7DC", // creme
  accent: "#58A112", // verde folha
  caramel: "#B48E69", // caramelo (apoio)
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

export function resolveBrand(brand: BrandSettings | null | undefined) {
  return {
    primary: isHex(brand?.primary) ? brand!.primary! : BRAND_DEFAULTS.primary,
    background: isHex(brand?.background) ? brand!.background! : BRAND_DEFAULTS.background,
    accent: isHex(brand?.accent) ? brand!.accent! : BRAND_DEFAULTS.accent,
    logoUrl: safeLogoUrl(brand?.logo_url),
  };
}

/** Só aceita logotipo servido por https (ou um caminho local do próprio site). */
export function safeLogoUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Variáveis CSS aplicadas no <html>; os valores já foram validados como hex. */
export function brandCssVars(brand: BrandSettings | null | undefined): Record<string, string> {
  const b = resolveBrand(brand);
  return {
    "--zf-primary": b.primary,
    "--zf-bg": b.background,
    "--zf-accent": b.accent,
  };
}
