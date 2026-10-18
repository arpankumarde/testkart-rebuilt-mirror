import React from "react";
import { useParams } from "react-router-dom";
import { CurrentAffairsDigestView } from "../components/CurrentAffairsDigestView";

/** Older /current-affairs/{slug} links; dated digests redirect to their period URL from here. */
const CurrentAffairsSlugPage: React.FC = () => {
  const { digestSlug = "" } = useParams<{ digestSlug: string }>();
  return <CurrentAffairsDigestView input={{ slug: digestSlug }} />;
};

export default CurrentAffairsSlugPage;