import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TestSeriesDetailsEditor } from "../components/TestSeriesDetailsEditor";

const Page = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const parsedId = Number.parseInt(searchParams.get("testId") ?? "", 10);
  const testId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  // Series are created on teacher.create-test; this page only edits one.
  useEffect(() => {
    if (testId === null) navigate("/teacher/create-test", { replace: true });
  }, [testId, navigate]);

  if (testId === null) return null;
  return <TestSeriesDetailsEditor testId={testId} />;
};

export default Page;