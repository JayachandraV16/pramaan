import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/common/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InstrumentsListPage } from "./pages/instruments/InstrumentsListPage";
import { InstrumentDetailPage } from "./pages/instruments/InstrumentDetailPage";
import { NewInstrumentPage } from "./pages/instruments/NewInstrumentPage";
import { ApplicationsListPage } from "./pages/applications/ApplicationsListPage";
import { ApplicationDetailPage } from "./pages/applications/ApplicationDetailPage";
import { NewApplicationPage } from "./pages/applications/NewApplicationPage";
import { VerificationsListPage } from "./pages/verifications/VerificationsListPage";
import { VerificationDetailPage } from "./pages/verifications/VerificationDetailPage";
import { AssignmentsListPage } from "./pages/assignments/AssignmentsListPage";
import { CertificatesListPage } from "./pages/certificates/CertificatesListPage";
import { CertificateDetailPage } from "./pages/certificates/CertificateDetailPage";
import { PublicVerifyPage } from "./pages/verify/PublicVerifyPage";

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-pramaan-surface text-slate-900 font-sans">
      <Navbar />

      {/* Main content route outlet */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Instruments routes */}
          <Route path="/instruments" element={<InstrumentsListPage />} />
          <Route path="/instruments/new" element={<NewInstrumentPage />} />
          <Route path="/instruments/:id" element={<InstrumentDetailPage />} />

          {/* Applications routes */}
          <Route path="/applications" element={<ApplicationsListPage />} />
          <Route path="/applications/new" element={<NewApplicationPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />

          {/* Assignments route (LMO/GATC queue, ADMIN overview) */}
          <Route path="/assignments" element={<AssignmentsListPage />} />

          {/* Verifications routes */}
          <Route path="/verifications" element={<VerificationsListPage />} />
          <Route
            path="/verifications/:id"
            element={<VerificationDetailPage />}
          />

          {/* Certificates routes */}
          <Route path="/certificates" element={<CertificatesListPage />} />
          <Route path="/certificates/:id" element={<CertificateDetailPage />} />

          {/* Public Verification route */}
          <Route path="/verify-public" element={<PublicVerifyPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};
