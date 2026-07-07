import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireAdmin() {
  const { isLoggedIn, userRole } = useAuth();

  if (!isLoggedIn || userRole !== 'administrator') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
