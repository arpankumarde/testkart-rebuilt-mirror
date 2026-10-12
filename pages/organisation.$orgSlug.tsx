import React from "react";
import { useParams } from "react-router-dom";
import { OrganizationProfilePage } from "../components/OrganizationProfilePage";

const OrganisationRoutePage = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <OrganizationProfilePage orgSlug={orgSlug || ""} />;
};

export default OrganisationRoutePage;
