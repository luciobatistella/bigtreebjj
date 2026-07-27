"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reason = new URL(window.location.href).searchParams.get("error");
    if (reason === "configuration") {
      setMessage("O Supabase Auth ainda não foi configurado neste ambiente.");
    } else if (reason === "forbidden") {
      setMessage("A conta autenticada não possui acesso editorial.");
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou senha inválidos.");

      const permission = await fetch("/api/admin/session", { cache: "no-store" });
      if (!permission.ok) {
        await supabase.auth.signOut();
        throw new Error(
          permission.status === 403
            ? "Este usuário não possui permissão editorial."
            : "Não foi possível validar sua sessão."
        );
      }

      const requestedNext =
        new URL(window.location.href).searchParams.get("next") ?? "/admin";
      const nextPath =
        requestedNext.startsWith("/admin") && requestedNext !== "/admin/login"
          ? requestedNext
          : "/admin";
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  };

  return (
    <main className="admin-login-card">
      <Link className="tbt-admin-brand admin-login-brand" href="/">
        <span className="tbt-admin-seal"><span>TBT</span></span>
        <span>
          <strong>The Big Tree</strong>
          <small>Núcleo editorial</small>
        </span>
      </Link>

      <header className="admin-login-title">
        <div className="admin-eyebrow" style={{ justifyContent: "center" }}>Acesso protegido</div>
        <h1>Área de curadoria</h1>
        <p>
          Revise linhagens, documentos e solicitações com uma conta editorial autorizada.
        </p>
      </header>

      <form className="admin-login-form" onSubmit={submit}>
        <label className="admin-field">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="admin-field">
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {message ? <p className="admin-form-error" role="alert">{message}</p> : null}
        <button className="admin-button" type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Validando…" : "Entrar no acervo"}
        </button>
      </form>
      <p className="admin-login-note">
        Sessão gerenciada pelo Supabase Auth. Nenhuma credencial é armazenada neste navegador.
      </p>
    </main>
  );
}
