import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { session, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (admin && !isAdmin) {
    return (
      <div className="p-6 text-sm">
        <p className="font-medium mb-1">No access</p>
        <p className="text-gray-600">This page is for moderators only.</p>
      </div>
    );
  }
  return <>{children}</>;
}