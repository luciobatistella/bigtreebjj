import { getServerLocale } from "../../../i18n/serverLocale";
import MotionForest from "../../motion/MotionForest";

export default function ExplorePersonPage({
  params
}: {
  params: { id: string };
}) {
  const locale = getServerLocale();
  const personId = decodeURIComponent(params.id);
  return <MotionForest locale={locale} initialPersonId={personId} />;
}
