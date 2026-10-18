import React from "react";
import { useParams } from "react-router-dom";
import { CurrentAffairsDigestView } from "../components/CurrentAffairsDigestView";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";

/** A digest at its period URL: /current-affairs/daily/2026-10-23, /weekly/2026-w43, /monthly/2023-08. */
const CurrentAffairsPeriodPage: React.FC = () => {
  const { type = "", period = "" } = useParams<{ type: string; period: string }>();
  const archive = currentAffairsMeta.isArchiveType(type.toLowerCase()) ? (type.toLowerCase() as "daily" | "weekly" | "monthly") : null;
  // An unknown type still renders the view, which shows its not-found state.
  return <CurrentAffairsDigestView input={archive ? { type: archive, period: period.toLowerCase() } : { slug: `${type}/${period}` }} />;
};

export default CurrentAffairsPeriodPage;