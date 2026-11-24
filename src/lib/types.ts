export type QuestionKey =
  | "overall"
  | "food"
  | "service"
  | "ambience"
  | "wait_time"
  | "nps"
  | "feedback"
  | "contact";

export type CategoryKey = "food" | "service" | "ambience" | "wait_time";

export type ReviewSource = "geral" | "mesa" | "comanda" | "promo";
export type ReviewStatus = "pendente" | "em_analise" | "resolvido";
export type EmailStatus = "pending" | "sent" | "failed" | "skipped";

export interface Question {
  key: QuestionKey;
  title: string;
  title_negative: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface BrandSettings {
  primary?: string;
  background?: string;
  accent?: string;
  logo_url?: string;
}

export interface Settings {
  recipient_emails: string[];
  negative_alerts_enabled: boolean;
  alert_emails: string[];
  google_review_url: string;
  welcome_title: string;
  welcome_body: string;
  thanks_positive_title: string;
  thanks_positive_body: string;
  thanks_negative_title: string;
  thanks_negative_body: string;
  privacy_contact: string;
  brand: BrandSettings;
}

export interface Review {
  id: string;
  created_at: string;
  source: ReviewSource;
  table_label: string | null;
  campaign: string | null;
  overall: number;
  food: number | null;
  service: number | null;
  ambience: number | null;
  wait_time: number | null;
  nps: number | null;
  tags: string[];
  comment: string | null;
  contact_name: string | null;
  contact_whatsapp: string | null;
  contact_consent: boolean;
  status: ReviewStatus;
  email_status: EmailStatus;
  email_attempts: number;
  email_last_error: string | null;
  email_sent_at: string | null;
}

export interface ReviewNote {
  id: string;
  review_id: string;
  author_email: string;
  body: string;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  label: string;
  active: boolean;
}

export interface AdminUser {
  user_id: string;
  email: string;
  role: "owner" | "admin";
  created_at: string;
}

/** O que o formulário público precisa conhecer — nada além disso sai do servidor. */
export interface PublicConfig {
  questions: Pick<Question, "key" | "title" | "title_negative">[];
  welcome_title: string;
  welcome_body: string;
  thanks_positive_title: string;
  thanks_positive_body: string;
  thanks_negative_title: string;
  thanks_negative_body: string;
  google_review_url: string;
  logo_url: string | null;
}
