import { getServerLocale } from "../i18n/serverLocale";

export default function OrganizationsPage() {
  const locale = getServerLocale();
  const copy =
    locale === "en"
      ? {
          eyebrow: "Team / academy page",
          founders: "Founders",
          instructors: "Head instructors",
          connection: "Founder lineage connection"
        }
      : {
          eyebrow: "Página da equipe / academia",
          founders: "Fundadores",
          instructors: "Instrutores-chefes",
          connection: "Conexão de linhagem do fundador"
        };
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">{copy.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-semibold">10th Planet Jiu-Jitsu</h1>
        <p className="mt-3 text-slate-300">{copy.founders}: Eddie Bravo</p>
        <p className="mt-2 text-slate-300">{copy.instructors}: Eddie Bravo</p>
        <p className="mt-2 text-slate-300">{copy.connection}: Eddie Bravo → Jean Jacques Machado</p>
      </section>
    </main>
  );
}
