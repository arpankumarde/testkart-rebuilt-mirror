import React from "react";
import { Badge } from "./Badge";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type { CurrentAffairsStatus } from "../helpers/schema";

const VARIANTS: Record<CurrentAffairsStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  draft: "secondary",
  scheduled: "warning",
  published: "success",
  archived: "outline",
};

export const CurrentAffairsStatusBadge: React.FC<{ status: CurrentAffairsStatus }> = ({ status }) => (
  <Badge variant={VARIANTS[status]}>{currentAffairsMeta.statusLabel(status)}</Badge>
);