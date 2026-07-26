import { redirect } from "next/navigation";
import { getServerLocale } from "../../../i18n/serverLocale";
import MotionForest from "../../motion/MotionForest";

const LEGACY_CANONICAL_SLUGS: Readonly<Record<string, string>> = {
  "canonical:kano": "jigoro-kano",
  "canonical:maeda": "mitsuyo-maeda",
  "canonical:ferro": "jacyntho-ferro",
  "canonical:carlos": "carlos-gracie"
};

export default function ExplorePersonPage({
  params
}: {
  params: { id: string };
}) {
  const locale = getServerLocale();
  const personId = decodeURIComponent(params.id);
  const legacyNameSlug = personId.startsWith("name:")
    ? personId.slice("name:".length)
    : LEGACY_CANONICAL_SLUGS[personId];

  if (legacyNameSlug && /^[a-z0-9-]+$/.test(legacyNameSlug)) {
    redirect(`/in/${legacyNameSlug}`);
  }

  return <MotionForest locale={locale} initialPersonId={personId} />;
}
