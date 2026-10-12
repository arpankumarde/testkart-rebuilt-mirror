import React from "react";
import { useParams } from "react-router-dom";
import { OrganizationProfilePage } from "../components/OrganizationProfilePage";

const UniversityRoutePage = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <OrganizationProfilePage orgSlug={orgSlug || ""} />;
};

export default UniversityRoutePage;
