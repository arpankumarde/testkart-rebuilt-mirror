import React from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { LiveClassroom } from "../components/LiveClassroom";
import { NotFoundState } from "../components/NotFoundState";

const GroupClassroomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const groupLessonId = id ?? null;

  if (!groupLessonId) {
    return <NotFoundState kind="page" />;
  }

  return (
    <>
      <Helmet>
        <title>Live Classroom - Testkart</title>
      </Helmet>
      <LiveClassroom kind="group" id={groupLessonId} />
    </>
  );
};

export default GroupClassroomPage;
