import { getServerLocale } from "../../i18n/serverLocale";
import MotionForest from "../../explore/motion/MotionForest";

export default function PublicLineagePage({
  params
}: {
  params: { slug: string };
}) {
  const locale = getServerLocale();
  return <MotionForest locale={locale} initialPersonId={params.slug} />;
}
