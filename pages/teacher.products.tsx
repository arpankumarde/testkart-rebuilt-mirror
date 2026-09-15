import React from 'react';
import { Helmet } from 'react-helmet';
import { TeacherProductManager } from '../components/TeacherProductManager';

const TeacherProductsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Notes &amp; PDFs - Testkart for Teachers</title>
        <meta name="description" content="Manage your notes, eBooks and other PDF products." />
      </Helmet>
      <TeacherProductManager />
    </>
  );
};

export default TeacherProductsPage;
