"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();
      if (!response.ok || !payload.token) throw new Error("Credenciais inválidas.");
      window.localStorage.setItem("tbt_admin_token", payload.token);
      const requestedNext = new URL(window.location.href).searchParams.get("next") ?? "/admin/review";
      const nextPath = requestedNext.startsWith("/admin/") ? requestedNext : "/admin/review";
      router.replace(nextPath);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <Link className="text-sm text-emerald-400" href="/">← The Big Tree BJJ</Link>
        <p className="mt-8 text-xs uppercase tracking-[0.24em] text-emerald-400">Editorial access</p>
        <h1 className="mt-3 text-3xl font-semibold">Entrar no admin</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          As solicitações públicas contêm contato e evidências privadas.
        </p>

        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm text-slate-300">
            E-mail
            <input
              className="min-h-12 rounded-lg border border-slate-700 bg-slate-950 px-3 outline-none focus:border-emerald-500"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Senha
            <input
              className="min-h-12 rounded-lg border border-slate-700 bg-slate-950 px-3 outline-none focus:border-emerald-500"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {message ? <p className="text-sm text-rose-300" role="alert">{message}</p> : null}
          <button
            className="mt-2 min-h-12 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            type="submit"
            disabled={state === "loading"}
          >
            {state === "loading" ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
