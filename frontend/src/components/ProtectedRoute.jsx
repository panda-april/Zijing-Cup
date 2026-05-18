import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isLoggedIn, openLogin } = useAuth();

  if (!isLoggedIn) {
    openLogin();
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
