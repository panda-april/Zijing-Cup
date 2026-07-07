import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isLoggedIn, openLogin } = useAuth();

  if (!isLoggedIn) {
    openLogin();
    return null;
  }

  return <Outlet />;
}
