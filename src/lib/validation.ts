import { z } from "zod";
import { FEEDBACK_TAGS } from "./constants";

const star = z.number().int().min(1).max(5);

const cleanText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim())
    .transform((s) => (s.length ? s : null));

export const submissionSchema = z.object({
  overall: star,
  food: star.nullish(),
  service: star.nullish(),
  ambience: star.nullish(),
  wait_time: star.nullish(),
  nps: z.number().int().min(0).max(10).nullish(),
  tags: z.array(z.enum(FEEDBACK_TAGS)).max(FEEDBACK_TAGS.length).default([]),
  comment: cleanText(1000).nullish(),
  contact_name: cleanText(80).nullish(),
  contact_whatsapp: z
    .string()
    .max(30)
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length === 0 || (s.length >= 10 && s.length <= 13), "WhatsApp inválido")
    .transform((s) => (s.length ? s : null))
    .nullish(),
  contact_consent: z.boolean().default(false),

  // origem
  mesa: z.string().trim().max(20).nullish(),
  origem: z.enum(["comanda", "promo"]).nullish(),
  campanha: z
    .string()
    .trim()
    .max(60)
    .regex(/^[\p{L}\p{N} _.-]*$/u)
    .nullish(),

  // antispam
  website: z.string().max(200).optional(), // honeypot: humanos não preenchem
  elapsed_ms: z.number().int().min(0).max(86_400_000),
});

export type Submission = z.infer<typeof submissionSchema>;

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
