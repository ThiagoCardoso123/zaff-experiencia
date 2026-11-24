"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type Kind = "geral" | "mesa" | "comanda" | "promo";

const KINDS: { key: Kind; label: string; help: string }[] = [
  { key: "geral", label: "Geral", help: "Um único código para o restaurante inteiro. A avaliação é registrada sem mesa." },
  { key: "mesa", label: "Por mesa", help: "Um código para cada mesa. A avaliação já chega identificada com a mesa." },
  { key: "comanda", label: "Comandas", help: "Para imprimir em comandas e cupons. Registrado com a origem “Comanda”." },
  { key: "promo", label: "Materiais promocionais", help: "Para flyers, embalagens e redes sociais. Informe um nome para acompanhar cada material." },
];

const COLORS = [
  { key: "marca", label: "Cor da marca", dark: "#882214" },
  { key: "preto", label: "Preto", dark: "#000000" },
];

function buildUrl(base: string, kind: Kind, value: string): string {
  const url = new URL("/avaliar", base);
  if (kind === "mesa" && value) url.searchParams.set("mesa", value);
  if (kind === "comanda") url.searchParams.set("origem", "comanda");
  if (kind === "promo") {
    url.searchParams.set("origem", "promo");
    if (value) url.searchParams.set("campanha", value);
  }
  return url.toString();
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 2 };

async function downloadPng(url: string, dark: string, filename: string) {
  const data = await QRCode.toDataURL(url, { ...OPTIONS, width: 1200, color: { dark, light: "#ffffff" } });
  download(`${filename}.png`, data);
}

async function downloadSvg(url: string, dark: string, filename: string) {
  const svg = await QRCode.toString(url, { ...OPTIONS, type: "svg", color: { dark, light: "#ffffff" } });
  const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  download(`${filename}.svg`, href);
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

function QrCard({ url, dark, title, filename }: { url: string; dark: string; title: string; filename: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    QRCode.toString(url, { ...OPTIONS, type: "svg", color: { dark, light: "#ffffff" } })
      .then((svg) => alive && setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url, dark]);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-white">
        {failed ? (
          <p className="grid h-full place-items-center text-center text-sm text-brand">Não foi possível gerar este código.</p>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR Code: ${title}`} className="h-full w-full" />
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 break-all text-xs text-muted">{url}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary h-9 flex-1 px-3" onClick={() => downloadPng(url, dark, filename)}>
          PNG
        </button>
        <button type="button" className="btn btn-outline h-9 flex-1 px-3" onClick={() => downloadSvg(url, dark, filename)}>
          SVG
        </button>
      </div>
    </div>
  );
}

export function QrGenerator({ tables, siteUrl }: { tables: string[]; siteUrl: string }) {
  const [kind, setKind] = useState<Kind>("geral");
  const [campaign, setCampaign] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [origin, setOrigin] = useState(siteUrl);

  // Sem NEXT_PUBLIC_SITE_URL, usa o endereço em que o painel está aberto.
  useEffect(() => {
    if (!siteUrl) setOrigin(window.location.origin);
  }, [siteUrl]);

  const cleanCampaign = campaign.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 60).trim();
  const current = KINDS.find((k) => k.key === kind)!;

  const cards = useMemo(() => {
    if (!origin) return [];
    if (kind === "mesa") {
      return tables.map((t) => ({
        url: buildUrl(origin, "mesa", t),
        title: `Mesa ${t}`,
        filename: `zaff-qr-mesa-${slug(t)}`,
      }));
    }
    if (kind === "promo") {
      return [
        {
          url: buildUrl(origin, "promo", cleanCampaign),
          title: cleanCampaign ? `Promocional · ${cleanCampaign}` : "Promocional",
          filename: `zaff-qr-promo${cleanCampaign ? `-${slug(cleanCampaign)}` : ""}`,
        },
      ];
    }
    return [
      {
        url: buildUrl(origin, kind, ""),
        title: kind === "geral" ? "Avaliação geral" : "Comandas",
        filename: `zaff-qr-${kind}`,
      },
    ];
  }, [origin, kind, tables, cleanCampaign]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1" role="tablist" aria-label="Tipo de QR Code">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => setKind(k.key)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px] transition ${
                kind === k.key ? "bg-brand text-cream" : "text-ink hover:bg-cream"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Cor do código
          <select
            className="input h-9 w-auto"
            value={color.key}
            onChange={(e) => setColor(COLORS.find((c) => c.key === e.target.value) ?? COLORS[0])}
          >
            {COLORS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="max-w-2xl text-sm text-muted">{current.help}</p>

      {kind === "promo" ? (
        <div className="max-w-sm">
          <label className="label" htmlFor="campanha">Nome do material</label>
          <input
            id="campanha"
            className="input"
            placeholder="Ex.: Flyer dia das mães"
            value={campaign}
            maxLength={60}
            onChange={(e) => setCampaign(e.target.value)}
          />
          <p className="hint">Aparece na origem da avaliação. Opcional.</p>
        </div>
      ) : null}

      {kind === "mesa" && tables.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="font-display text-2xl">Nenhuma mesa cadastrada.</p>
          <p className="mt-2 text-sm text-muted">Cadastre as mesas em Configurações para gerar um código para cada uma.</p>
          <a href="/admin/configuracoes#mesas" className="btn btn-primary mt-5">Cadastrar mesas</a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => (
            <QrCard key={c.url} url={c.url} dark={color.dark} title={c.title} filename={c.filename} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted">
        PNG em 1200 px para uso digital e impressões pequenas; SVG vetorial para gráfica, em qualquer
        tamanho. Imprima sobre fundo claro e teste a leitura antes de produzir em quantidade.
      </p>
    </div>
  );
}
