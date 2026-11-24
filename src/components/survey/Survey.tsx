"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FEEDBACK_TAGS, OVERALL_LABELS, STAR_LABELS, isPositive } from "@/lib/constants";
import type { PublicConfig, QuestionKey } from "@/lib/types";

export interface SurveyOrigin {
  mesa?: string | null;
  origem?: "comanda" | "promo" | null;
  campanha?: string | null;
}

interface Props {
  config: PublicConfig;
  origin: SurveyOrigin;
}

type StarKey = "food" | "service" | "ambience" | "wait_time";

interface Answers {
  overall: number | null;
  food: number | null;
  service: number | null;
  ambience: number | null;
  wait_time: number | null;
  nps: number | null;
  tags: string[];
  comment: string;
  contact_name: string;
  contact_whatsapp: string;
  contact_consent: boolean;
}

const EMPTY: Answers = {
  overall: null,
  food: null,
  service: null,
  ambience: null,
  wait_time: null,
  nps: null,
  tags: [],
  comment: "",
  contact_name: "",
  contact_whatsapp: "",
  contact_consent: false,
};

const ADVANCE_DELAY = 420;
const EXIT_MS = 190;

type Screen = "welcome" | "form" | "thanks";

export default function Survey({ config, origin }: Props) {
  const steps = config.questions;
  const [screen, setScreen] = useState<Screen>("welcome");
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [leaving, setLeaving] = useState(false);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const startedAt = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const positive = answers.overall != null && isPositive(answers.overall);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  /** Troca de tela/etapa com uma saída curta antes da entrada da próxima. */
  const transition = useCallback((apply: () => void, direction: "fwd" | "back" = "fwd") => {
    if (timer.current) clearTimeout(timer.current);
    setDir(direction);
    setLeaving(true);
    timer.current = setTimeout(() => {
      apply();
      setLeaving(false);
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    }, EXIT_MS);
  }, []);

  const submit = useCallback(
    async (final: Answers) => {
      setSending(true);
      setError(null);
      try {
        const res = await fetch("/api/avaliacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...final,
            mesa: origin.mesa ?? null,
            origem: origin.origem ?? null,
            campanha: origin.campanha ?? null,
            website,
            elapsed_ms: Date.now() - startedAt.current,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Não foi possível enviar. Tente novamente.");
        }
        transition(() => setScreen("thanks"));
      } catch (e) {
        setError(
          e instanceof TypeError
            ? "Sem conexão. Verifique sua internet e tente novamente."
            : e instanceof Error
              ? e.message
              : "Não foi possível enviar. Tente novamente.",
        );
      } finally {
        setSending(false);
      }
    },
    [origin, transition, website],
  );

  const next = useCallback(
    (current: Answers) => {
      if (isLast) void submit(current);
      else transition(() => setIndex((i) => i + 1));
    },
    [isLast, submit, transition],
  );

  const back = () => {
    if (sending) return;
    setError(null);
    if (index === 0) transition(() => setScreen("welcome"), "back");
    else transition(() => setIndex((i) => i - 1), "back");
  };

  /** Resposta de toque único: marca, deixa o cliente ver a seleção e avança. */
  const pick = (patch: Partial<Answers>) => {
    const updated = { ...answers, ...patch };
    setAnswers(updated);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => next(updated), ADVANCE_DELAY);
  };

  const start = () => {
    startedAt.current = Date.now();
    transition(() => {
      setScreen("form");
      setIndex(0);
    });
  };

  const title = useMemo(() => {
    if (!step) return "";
    if (step.key === "feedback" && !positive && step.title_negative) return step.title_negative;
    return step.title;
  }, [step, positive]);

  const motion = `zf-stage ${leaving ? "is-leaving" : "is-entering"} ${dir === "back" ? "is-back" : ""}`;

  // ── Boas-vindas ──────────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <main className="zf zf--dark">
        <Sprig className="zf-deco zf-deco--a" />
        <Sprig className="zf-deco zf-deco--b" />
        <div className={`zf-hero ${motion}`}>
          <Logo config={config} variant="creme" className="zf-hero__logo" />
          {origin.mesa ? <p className="zf-chip">Mesa {origin.mesa}</p> : null}
          <h1 className="zf-hero__title" ref={headingRef} tabIndex={-1}>
            {config.welcome_title}
          </h1>
          <p className="zf-hero__body">{config.welcome_body}</p>
          <button type="button" className="zf-btn zf-btn--light" onClick={start}>
            Avaliar minha experiência
          </button>
          <p className="zf-hero__hint">Leva menos de 30 segundos · sem cadastro</p>
        </div>
      </main>
    );
  }

  // ── Agradecimento ────────────────────────────────────────────────────────
  if (screen === "thanks") {
    return (
      <main className="zf zf--dark">
        <Sprig className="zf-deco zf-deco--a" />
        <div className={`zf-hero ${motion}`}>
          <Logo config={config} variant="selo" className="zf-hero__seal" />
          <h1 className="zf-hero__title" ref={headingRef} tabIndex={-1}>
            {positive ? config.thanks_positive_title : config.thanks_negative_title}
          </h1>
          <p className="zf-hero__body">
            {positive ? config.thanks_positive_body : config.thanks_negative_body}
          </p>
          {config.google_review_url ? (
            <a
              className="zf-btn zf-btn--ghost"
              href={config.google_review_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Avaliar também no Google
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  // ── Formulário ───────────────────────────────────────────────────────────
  const progress = ((index + 1) / steps.length) * 100;

  return (
    <main className="zf">
      <header className="zf-top">
        <button type="button" className="zf-back" onClick={back} aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Logo config={config} variant="cor" className="zf-top__logo" />
        <span className="zf-count" aria-hidden="true">
          {index + 1}/{steps.length}
        </span>
      </header>
      <div
        className="zf-progress"
        role="progressbar"
        aria-label="Progresso da avaliação"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
      >
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      <section className={`zf-step ${motion}`} key={step.key} aria-live="polite">
        <h1 className="zf-q" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>

        {step.key === "overall" && (
          <OverallOptions value={answers.overall} onPick={(v) => pick({ overall: v })} />
        )}

        {isStarKey(step.key) && (
          <Stars
            label={title}
            value={answers[step.key]}
            onPick={(v) => pick({ [step.key]: v } as Partial<Answers>)}
          />
        )}

        {step.key === "nps" && <Nps value={answers.nps} onPick={(v) => pick({ nps: v })} />}

        {step.key === "feedback" && (
          <div className="zf-block">
            <div className="zf-tags" role="group" aria-label="Selecione quantos quiser">
              {FEEDBACK_TAGS.map((tag) => {
                const active = answers.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`zf-tag ${active ? "is-on" : ""}`}
                    aria-pressed={active}
                    onClick={() =>
                      setAnswers((a) => ({
                        ...a,
                        tags: active ? a.tags.filter((t) => t !== tag) : [...a.tags, tag],
                      }))
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <label className="zf-field">
              <span>Quer contar mais? <em>opcional</em></span>
              <textarea
                rows={3}
                maxLength={1000}
                value={answers.comment}
                onChange={(e) => setAnswers((a) => ({ ...a, comment: e.target.value }))}
                placeholder="Escreva aqui, se desejar"
              />
            </label>
          </div>
        )}

        {step.key === "contact" && (
          <div className="zf-block">
            <p className="zf-note">
              Totalmente opcional. Se preferir, envie sua avaliação sem se identificar.
            </p>
            <label className="zf-field">
              <span>Nome</span>
              <input
                type="text"
                autoComplete="given-name"
                maxLength={80}
                value={answers.contact_name}
                onChange={(e) => setAnswers((a) => ({ ...a, contact_name: e.target.value }))}
              />
            </label>
            <label className="zf-field">
              <span>WhatsApp</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(00) 00000-0000"
                value={answers.contact_whatsapp}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, contact_whatsapp: maskPhone(e.target.value) }))
                }
              />
            </label>
            <label className="zf-check">
              <input
                type="checkbox"
                checked={answers.contact_consent}
                onChange={(e) => setAnswers((a) => ({ ...a, contact_consent: e.target.checked }))}
              />
              <span className="zf-check__box" aria-hidden="true" />
              <span>Autorizo o Zaff a entrar em contato comigo sobre esta avaliação.</span>
            </label>
            <p className="zf-legal">
              Seus dados são usados apenas para responder a esta avaliação.{" "}
              <a href="/privacidade" target="_blank" rel="noopener">
                Saiba mais
              </a>
              .
            </p>
          </div>
        )}

        {/* Campo-isca para robôs: invisível e fora da navegação por teclado */}
        <div className="zf-hp" aria-hidden="true">
          <label>
            Não preencha este campo
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {error ? (
          <p className="zf-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="zf-actions">
          {step.key === "feedback" || step.key === "contact" || (isLast && error) ? (
            <button
              type="button"
              className="zf-btn zf-btn--solid"
              disabled={sending || !contactValid(step.key, answers)}
              onClick={() => next(answers)}
            >
              {sending ? "Enviando…" : isLast ? "Enviar avaliação" : "Continuar"}
            </button>
          ) : null}
          {step.key !== "overall" && step.key !== "feedback" && step.key !== "contact" && !sending ? (
            <button type="button" className="zf-skip" onClick={() => next(answers)}>
              Pular esta pergunta
            </button>
          ) : null}
          {sending && step.key !== "feedback" && step.key !== "contact" ? (
            <p className="zf-sending" role="status">Enviando sua avaliação…</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

const isStarKey = (k: QuestionKey): k is StarKey =>
  k === "food" || k === "service" || k === "ambience" || k === "wait_time";

/** O WhatsApp é opcional; se preenchido, precisa ter DDD + número. */
function contactValid(key: QuestionKey, a: Answers): boolean {
  if (key !== "contact") return true;
  const digits = a.contact_whatsapp.replace(/\D/g, "");
  return digits.length === 0 || digits.length >= 10;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Logo({
  config,
  variant,
  className,
}: {
  config: PublicConfig;
  variant: "cor" | "creme" | "selo";
  className?: string;
}) {
  const src =
    variant === "selo"
      ? "/brand/zaff-selo-creme.svg"
      : config.logo_url
        ? config.logo_url
        : variant === "creme"
          ? "/brand/zaff-logo-creme.svg"
          : "/brand/zaff-logo.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Zaff Gastronomia" className={className} draggable={false} />;
}

/** Ramo de folhas da marca, usado como ornamento e como medidor. */
function Sprig({ className }: { className?: string }) {
  return <span className={`zf-sprig ${className ?? ""}`} aria-hidden="true" />;
}

function OverallOptions({ value, onPick }: { value: number | null; onPick: (v: number) => void }) {
  return (
    <div className="zf-options" role="radiogroup" aria-label="Experiência geral">
      {[5, 4, 3, 2, 1].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`zf-option ${value === n ? "is-on" : ""}`}
          onClick={() => onPick(n)}
        >
          <span className="zf-option__label">{OVERALL_LABELS[n]}</span>
          <span className="zf-meter" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i <= n ? "is-full" : ""} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

function Stars({
  value,
  onPick,
  label,
}: {
  value: number | null;
  onPick: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="zf-stars-wrap">
      <div className="zf-stars" role="radiogroup" aria-label={label} onPointerLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"} — ${STAR_LABELS[n]}`}
            className={`zf-star ${n <= shown ? "is-on" : ""} ${value === n ? "is-picked" : ""}`}
            style={{ transitionDelay: `${(n - 1) * 28}ms` }}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHover(n)}
            onClick={() => onPick(n)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="zf-stars__label" aria-hidden="true">
        {shown ? STAR_LABELS[shown] : "Toque para avaliar"}
      </p>
    </div>
  );
}

function Nps({ value, onPick }: { value: number | null; onPick: (v: number) => void }) {
  return (
    <div className="zf-nps-wrap">
      <div className="zf-nps" role="radiogroup" aria-label="Nota de 0 a 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`zf-nps__n ${value === n ? "is-on" : ""}`}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="zf-nps__scale" aria-hidden="true">
        <span>0 · Não recomendaria</span>
        <span>10 · Com certeza</span>
      </div>
    </div>
  );
}
