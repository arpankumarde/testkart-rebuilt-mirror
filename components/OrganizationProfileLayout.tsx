import React from "react";
import { useLocation } from "react-router-dom";
import { OrganizationProfilePage } from "./OrganizationProfilePage";
import { ORGANIZATION_PATH_PATTERN } from "../helpers/organizationRoutes";

/**
 * Persistent layout for every organisation route (/coaching/:slug and
 * /coaching/:slug/:tab, and the same for school, college, university and
 * organisation). Floot keeps a layout mounted while navigating between pages
 * that share it, so the profile lives here rather than in the page files:
 * About and the other sections are different page files, and rendering the
 * profile in them remounted the whole view on every switch to or from About.
 * The route pages themselves render nothing.
 */
export const OrganizationProfileLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const match = ORGANIZATION_PATH_PATTERN.exec(pathname);
  if (!match) return <>{children}</>;
  const [, orgSlug, tab] = match;
  return <OrganizationProfilePage orgSlug={decodeURIComponent(orgSlug)} tab={tab} />;
};