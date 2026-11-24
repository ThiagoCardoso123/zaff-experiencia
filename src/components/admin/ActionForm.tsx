"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const INITIAL: ActionState = { ok: true, message: "" };

/** Formulário ligado a uma Server Action, com retorno visível de sucesso ou erro. */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** pergunta exibida antes de enviar (ações destrutivas) */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 text-sm ${state.ok ? "text-leaf" : "text-brand"}`}
        >
          {state.ok ? "✓ " : ""}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel = "Salvando…",
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
