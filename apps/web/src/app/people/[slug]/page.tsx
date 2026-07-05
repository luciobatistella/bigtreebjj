const verifiedProfiles: Record<string, {
  name: string;
  aliases?: string;
  location: string;
  lineageStatus: 'Confirmed' | 'Corroborated' | 'Under review' | 'No verified lineage yet';
  promotion?: {
    label: string;
    teacher: string;
    evidenceLevel: string;
    sourceCount: number;
    lastReviewedDate: string;
    sourceUrl: string;
  };
}> = {
  'kaynan-duarte': {
    name: 'Kaynan Duarte',
    aliases: 'Kaynan',
    location: 'Brazil / United States',
    lineageStatus: 'Confirmed',
    promotion: {
      label: 'Black belt awarded by',
      teacher: 'Andre Galvao',
      evidenceLevel: 'High',
      sourceCount: 1,
      lastReviewedDate: '2026-07-05',
      sourceUrl: 'https://atosjiujitsuhq.com/2018/06/06/kaynan-duarte-wins-double-gold-worlds-2018/'
    }
  },
  'nisar-loynab': {
    name: 'Nisar Loynab',
    aliases: 'Nisar',
    location: 'United States',
    lineageStatus: 'Confirmed',
    promotion: {
      label: 'Black belt awarded by',
      teacher: 'Andre Galvao',
      evidenceLevel: 'High',
      sourceCount: 1,
      lastReviewedDate: '2026-07-05',
      sourceUrl: 'https://atosjiujitsuhq.com/2018/04/20/instructor-spotlight-nisar-loynab/'
    }
  },
  'sarah-galvao': {
    name: 'Sarah Galvao',
    aliases: 'Sarah',
    location: 'United States',
    lineageStatus: 'Under review'
  },
  'demian-maia': {
    name: 'Demian Maia',
    aliases: 'Demian',
    location: 'Brazil',
    lineageStatus: 'Confirmed',
    promotion: {
      label: 'Black belt awarded by',
      teacher: 'Milo',
      evidenceLevel: 'High',
      sourceCount: 1,
      lastReviewedDate: '2026-07-05',
      sourceUrl: 'https://en.wikipedia.org/wiki/Demian_Maia'
    }
  }
};

export default function PersonProfilePage({ params }: { params: { slug: string } }) {
  const profile = verifiedProfiles[params.slug] ?? {
    name: params.slug.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' '),
    location: 'Research profile',
    lineageStatus: 'No verified lineage yet' as const
  };
  const hasPromotion = Boolean(profile.promotion);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Person profile</p>
        <h1 className="mt-4 text-4xl font-semibold">{profile.name}</h1>
        {profile.aliases ? <p className="mt-3 text-slate-300">Aliases: {profile.aliases}</p> : null}
        <p className="mt-2 text-slate-300">{profile.location}</p>
        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm text-slate-500">Lineage status</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{profile.lineageStatus}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">Lineage</h2>
          {hasPromotion ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              <p>{profile.promotion?.teacher}</p>
              <p className="mt-2 text-slate-500">to</p>
              <p className="mt-2">{profile.name}</p>
            </div>
          ) : (
            <p className="mt-4 text-slate-300">No verified lineage is public for this profile yet.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">Black Belt Promotion</h2>
          {hasPromotion ? (
            <dl className="mt-4 grid gap-3 text-sm text-slate-300">
              <div><dt className="text-slate-500">Relationship</dt><dd>{profile.promotion?.label}</dd></div>
              <div><dt className="text-slate-500">Evidence level</dt><dd>{profile.promotion?.evidenceLevel}</dd></div>
              <div><dt className="text-slate-500">Source count</dt><dd>{profile.promotion?.sourceCount}</dd></div>
              <div><dt className="text-slate-500">Last reviewed</dt><dd>{profile.promotion?.lastReviewedDate}</dd></div>
            </dl>
          ) : (
            <p className="mt-4 text-slate-300">Pending claims are hidden until editorial approval.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-8">
        <h2 className="text-2xl font-semibold">Evidence Timeline</h2>
        {hasPromotion ? (
          <a className="mt-4 inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-emerald-300 hover:bg-slate-800" href={profile.promotion?.sourceUrl}>
            Open approved source
          </a>
        ) : (
          <ul className="mt-4 space-y-2 text-slate-300">
            <li>Pending import review is not shown publicly</li>
            <li>Official registry/ranking observations are not lineage edges</li>
            <li>Reported team/academy affiliation is not proof of black belt promotion</li>
          </ul>
        )}
      </section>
    </main>
  );
}
