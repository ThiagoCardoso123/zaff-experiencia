import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import type { CSSProperties } from "react";
import { brandCssVars, resolveBrand } from "@/lib/brand";
import { getBrand } from "@/lib/config";
import "./globals.css";

// A fonte do logotipo foi entregue em curvas no manual da marca; estas duas
// famílias acompanham o seu desenho (serifada leve de alto contraste + sem serifa geométrica).
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zaff Gastronomia · Sua experiência",
  description: "Conte como foi sua experiência no Zaff.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/zaff-selo.svg" },
};

export async function generateViewport(): Promise<Viewport> {
  const brand = resolveBrand(await getBrand());
  return { themeColor: brand.primary, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = brandCssVars(await getBrand()) as CSSProperties;
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`} style={vars}>
      <body>{children}</body>
    </html>
  );
}
