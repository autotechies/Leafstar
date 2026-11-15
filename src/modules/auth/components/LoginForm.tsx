"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordInput, TextInput } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Feedback";
import { idleForm } from "@/lib/form-state";
import { signIn } from "../actions";
import { ActionForm } from "@/components/ui/ActionForm";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(signIn, idleForm);
  const next = state.values?.next ?? params.get("next") ?? "";

  useEffect(() => {
    if (params.get("signed-out") && typeof window !== "undefined") {
      window.history.replaceState(null, "", "/admin/login?signed-out=1");
    }
  }, [params]);

  return (
    <ActionForm action={action} className="flex flex-col gap-4" noValidate>
      {params.get("signed-out") && state.status === "idle" ? <FormMessage tone="info">You have signed out.</FormMessage> : null}
      <input type="hidden" name="next" value={next} />
      <TextInput
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      {state.status === "error" && state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Sign in
      </Button>
      <Link href="/admin/forgot-password" className="self-center rounded-sm type-small font-semibold text-fg underline underline-offset-4 focus-ring">
        Forgot your password?
      </Link>
    </ActionForm>
  );
}
