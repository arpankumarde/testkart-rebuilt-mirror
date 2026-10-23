import React from "react";
import { useParams } from "react-router-dom";
import { CurrentAffairsDigestView } from "../components/CurrentAffairsDigestView";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";

/** Every Current Affairs article: /current-affairs/{daily|weekly|monthly}/{slug}, plus /daily/2026-10-23 for a day's digest. */
const CurrentAffairsArticlePage: React.FC = () => {
  const { type = "", slug = "" } = useParams<{ type: string; slug: string }>();
  const archive = currentAffairsMeta.isArchiveType(type.toLowerCase()) ? (type.toLowerCase() as "daily" | "weekly" | "monthly") : null;
  // An unknown type still renders the view, which shows its not-found state.
  return <CurrentAffairsDigestView input={archive ? { type: archive, slug: slug.toLowerCase() } : { slug: `${type}/${slug}` }} />;
};

export default CurrentAffairsArticlePage;
