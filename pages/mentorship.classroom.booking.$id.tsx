import React from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { LiveClassroom } from "../components/LiveClassroom";
import { NotFoundState } from "../components/NotFoundState";

const BookingClassroomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = id ? parseInt(id, 10) : null;

  if (!bookingId) {
    return <NotFoundState kind="page" />;
  }

  return (
    <>
      <Helmet>
        <title>Live Classroom - Testkart</title>
      </Helmet>
      <LiveClassroom kind="booking" id={bookingId} />
    </>
  );
};

export default BookingClassroomPage;
