import React from 'react';
import { Navigate } from 'react-router-dom';

// Certificates are no longer issued (since 20-11-2026), so the section is
// hidden and old links land on the dashboard.
const StudentCertificatesPage = () => <Navigate to="/student/dashboard" replace />;

export default StudentCertificatesPage;