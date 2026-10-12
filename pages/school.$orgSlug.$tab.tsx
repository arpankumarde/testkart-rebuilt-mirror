import React from "react";
import { useParams } from "react-router-dom";
import { OrganizationProfilePage } from "../components/OrganizationProfilePage";

const SchoolTabRoutePage = () => {
  const { orgSlug, tab } = useParams<{ orgSlug: string; tab: string }>();
  return <OrganizationProfilePage orgSlug={orgSlug || ""} tab={tab} />;
};

export default SchoolTabRoutePage;
