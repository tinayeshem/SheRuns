import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthProvider";
import RequireAuth from "./features/auth/RequireAuth";
import Landing from "./pages/Landing";
import HowItWorks from "./pages/HowItWorks";
import Login from "./app/Login";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import Home from "./app/Home";
import ProfileSetup from "./pages/ProfileSetup";
import RoutePlanner from "./pages/RoutePlanner";
import RouteDetails from "./pages/RouteDetails";
import ReportIssue from "./pages/ReportIssue";
import ReportsFeed from "./pages/ReportsFeed";
import Health from "./pages/Health";
import LiveRun from "./pages/LiveRun";
import LiveShare from "./pages/LiveShare";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

function PageFade({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageFade>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/plan" element={<RoutePlanner />} />
            <Route path="/route" element={<RouteDetails />} />
            <Route
              path="/report"
              element={
                <RequireAuth>
                  <ReportIssue />
                </RequireAuth>
              }
            />
            <Route path="/reports" element={<ReportsFeed />} />
            <Route path="/health" element={<Health />} />
            <Route
              path="/live-run"
              element={
                <RequireAuth>
                  <LiveRun />
                </RequireAuth>
              }
            />
            <Route path="/live/:token" element={<LiveShare />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <Admin />
                </RequireAuth>
              }
            />
          </Routes>
        </PageFade>
      </BrowserRouter>
    </AuthProvider>
  );
}