import Link from "next/link";
import { ApproveDiscoveryButton } from "./ApproveDiscoveryButton";
import { profileCopy, translateProfileValue } from "../../i18n/profileCopy";
import { getServerLocale } from "../../i18n/serverLocale";
import type { Locale } from "../../i18n/locale";

const apiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export const dynamic = "force-dynamic";

type PersonSummary = {
  id: string;
  fullName: string;
  nicknames?: string[];
  country?: string | null;
};

type Relationship = {
  id: string;
  teacherName?: string | null;
  relationshipLabel: string;
  evidenceLevel: string;
  sourceCount: number;
  sourceUrls?: string[];
};

type PersonProfile = PersonSummary & {
  personId: string;
  lineageStatus: string;
  affiliations: Array<{ id: string; organizationName: string; affiliationType: string }>;
  lineagePath?: PersonSummary[];
  publicRelationships: Relationship[];
};

type ExternalFactCandidate = {
  id: string;
  candidateType: string;
  subjectName: string;
  objectName?: string | null;
  sourceUrl: string;
  sourceLocator: string;
  evidenceLevel: string;
  status: string;
  confidenceScore: number;
};

type ExternalDiscoveryProfile = {
  id: string;
  sourceName: string;
  sourceProfileUrl: string;
  externalName: string;
  nickname?: string | null;
  listedTeamText?: string | null;
  capturedAt: string;
  sourceStatus: string;
  editorialStatus: string;
  publicVisibility: string;
  factCandidates: ExternalFactCandidate[];
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadProfile(slug: string): Promise<PersonProfile | null> {
  try {
    const peopleResponse = await fetch(`${apiBase}/people`, { cache: "no-store" });
    if (!peopleResponse.ok) return null;
    const people = (await peopleResponse.json()) as PersonSummary[];
    const match = people.find((person) => slugify(person.fullName) === slug);
    if (!match) return null;
    const profileResponse = await fetch(`${apiBase}/public/people/${match.id}`, { cache: "no-store" });
    if (!profileResponse.ok) return null;
    return profileResponse.json();
  } catch {
    return null;
  }
}

async function loadExternalDiscoveryProfile(slug: string): Promise<ExternalDiscoveryProfile | null> {
  try {
    const response = await fetch(`${apiBase}/external-profiles/slug/${slug}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function BeltNode({ person, active, locale }: { person: PersonSummary; active?: boolean; locale: Locale }) {
  const copy = profileCopy[locale];
  return (
    <div className={`relative min-h-[118px] rounded-lg border px-5 py-4 ${active ? "border-emerald-400 bg-emerald-950/30" : "border-slate-700 bg-slate-950"}`}>
      <div className="absolute left-0 top-0 h-full w-2 rounded-l-lg bg-gradient-to-b from-white via-slate-300 to-slate-800" />
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{active ? copy.selectedAthlete : copy.lineageAncestor}</p>
      <h3 className="mt-2 text-xl font-semibold text-white">{person.fullName}</h3>
      {person.country ? <p className="mt-2 text-sm text-slate-400">{person.country}</p> : null}
    </div>
  );
}

export default async function PersonPage({ params }: { params: { slug: string } }) {
  const locale = getServerLocale();
  const copy = profileCopy[locale];
  const profile = await loadProfile(params.slug);

  if (!profile) {
    const discoveryProfile = await loadExternalDiscoveryProfile(params.slug);
    if (discoveryProfile) {
      const lineageClues = discoveryProfile.factCandidates.filter((candidate) => candidate.candidateType.includes("teacher") || candidate.candidateType.includes("black_belt"));
      const teamClues = discoveryProfile.factCandidates.filter((candidate) => candidate.candidateType.includes("team") || candidate.candidateType.includes("affiliation"));

      return (
        <main className="min-h-screen bg-[#070914] text-slate-100">
          <section className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 lg:px-8">
            <header className="rounded-lg border border-amber-500/40 bg-slate-900 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300">{copy.discoveryPending}</p>
              <h1 className="mt-4 text-5xl font-black text-white sm:text-7xl">{discoveryProfile.externalName}</h1>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-100">{translateProfileValue(discoveryProfile.editorialStatus, locale)}</span>
                {discoveryProfile.nickname ? <span className="rounded border border-slate-700 px-3 py-2">{copy.nickname}: {discoveryProfile.nickname}</span> : null}
                {discoveryProfile.listedTeamText ? <span className="rounded border border-slate-700 px-3 py-2">{discoveryProfile.listedTeamText}</span> : null}
              </div>
            </header>

            <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-2xl font-bold">{copy.pendingClues}</h2>
                <div className="mt-5 grid gap-3">
                  {lineageClues.length ? lineageClues.map((candidate) => (
                    <div key={candidate.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                      <p className="text-sm uppercase tracking-[0.16em] text-slate-500">{translateProfileValue(candidate.candidateType, locale)}</p>
                      <p className="mt-2 text-lg text-white">{candidate.subjectName}{candidate.objectName ? ` -> ${candidate.objectName}` : ""}</p>
                      <p className="mt-2 text-sm text-slate-400">{translateProfileValue(candidate.evidenceLevel, locale)} · {translateProfileValue(candidate.status, locale)} · {copy.confidence} {Math.round(candidate.confidenceScore * 100)}%</p>
                    </div>
                  )) : <p className="text-slate-400">{copy.noClues}</p>}
                </div>
              </div>

              <aside className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-2xl font-bold">{copy.sourceAttribution}</h2>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">{copy.source}</dt>
                    <dd className="mt-1 text-white">{discoveryProfile.sourceName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{copy.use}</dt>
                    <dd className="mt-1 text-white">{copy.specializedSource}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{copy.visibility}</dt>
                    <dd className="mt-1 text-white">{translateProfileValue(discoveryProfile.publicVisibility, locale)}</dd>
                  </div>
                </dl>
                <a className="mt-6 inline-flex rounded border border-emerald-500 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10" href={discoveryProfile.sourceProfileUrl} target="_blank">
                  {copy.openSourceProfile}
                </a>
                <ApproveDiscoveryButton externalProfileId={discoveryProfile.id} locale={locale} />
              </aside>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-2xl font-bold">{copy.teamCandidates}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {teamClues.map((candidate) => (
                  <div key={candidate.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="font-semibold">{candidate.objectName ?? candidate.subjectName}</p>
                    <p className="mt-1 text-sm text-slate-400">{translateProfileValue(candidate.candidateType, locale)}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </main>
      );
    }

    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-bold">{copy.personNotFound}</h1>
        <p className="mt-3 text-slate-400">{copy.noLocalRecord}</p>
      </main>
    );
  }

  const relationship = profile.publicRelationships[0];
  const lineagePath = profile.lineagePath?.length ? profile.lineagePath : [profile];

  return (
    <main className="min-h-screen bg-[#070914] text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 lg:px-8">
        <header className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">{copy.verifiedProfile}</p>
            <h1 className="mt-4 text-5xl font-black text-white sm:text-7xl">{profile.fullName}</h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-emerald-200">{translateProfileValue(profile.lineageStatus, locale)}</span>
              {profile.country ? <span className="rounded border border-slate-700 px-3 py-2">{profile.country}</span> : null}
              {profile.affiliations.map((affiliation) => (
                <span key={affiliation.id} className="rounded border border-slate-700 px-3 py-2">{affiliation.organizationName}</span>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.approvedEvidence}</p>
            <div className="mt-4 text-5xl font-black">{relationship?.sourceCount ?? 0}</div>
            <p className="mt-2 text-slate-300">{relationship?.evidenceLevel ? translateProfileValue(relationship.evidenceLevel, locale) : copy.noPublicEvidence} {copy.evidenceOnEdge}</p>
            {relationship?.sourceUrls?.[0] ? (
              <a className="mt-5 inline-flex rounded border border-emerald-500 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10" href={relationship.sourceUrls[0]} target="_blank">
                {copy.openSource}
              </a>
            ) : null}
          </aside>
        </header>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.blackBeltLineage}</p>
              <h2 className="mt-2 text-3xl font-bold">{lineagePath.map((person) => person.fullName).join(" -> ")}</h2>
            </div>
            <p className="text-right text-sm text-slate-400">{copy.generationsShown(lineagePath.length)}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {lineagePath.map((person, index) => (
              <div key={person.id} className="relative">
                <BeltNode person={person} active={person.id === profile.personId} locale={locale} />
                {index < lineagePath.length - 1 ? (
                  <div className="hidden md:block">
                    <div className="absolute left-[calc(100%-2px)] top-1/2 z-10 h-px w-4 bg-emerald-400" />
                    <div className="absolute left-[calc(100%+10px)] top-[calc(50%-5px)] z-10 h-3 w-3 rotate-45 border-r border-t border-emerald-400" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">{copy.directPromotion}</p>
            <p className="mt-1 text-lg text-white">{relationship?.teacherName ?? copy.unknownTeacher} &rarr; {profile.fullName}: {relationship?.relationshipLabel ? translateProfileValue(relationship.relationshipLabel, locale) : "—"}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">{copy.teamContext}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {profile.affiliations.map((affiliation) => (
                <div key={affiliation.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="font-semibold">{affiliation.organizationName}</p>
                  <p className="mt-1 text-sm text-slate-400">{translateProfileValue(affiliation.affiliationType, locale)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">{copy.lineageRecords}</h2>
            <div className="mt-5 grid gap-2">
              {lineagePath.map((person) => (
                <Link key={person.id} className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm hover:border-emerald-500" href={`/people/${slugify(person.fullName)}`}>
                  {person.fullName}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
