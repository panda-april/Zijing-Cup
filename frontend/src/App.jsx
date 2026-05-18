import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CustomAlert from './components/CustomAlert';

import DashboardPage from './pages/DashboardPage';
import TeamsDirectoryPage from './pages/TeamsDirectoryPage';
import MatchHistoryPage from './pages/MatchHistoryPage';
import TeamDetail from './pages/TeamDetail';
import TeamManagement from './pages/TeamManagement';
import TournamentDetail from './pages/TournamentDetail';
import CreateTeam from './pages/CreateTeam';
import AdminConsole from './pages/AdminConsole';
import MessageCenter from './pages/MessageCenter';
import ProfileEdit from './pages/ProfileEdit';
import MatchScheduling from './pages/MatchScheduling';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Public routes */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/teams" element={<TeamsDirectoryPage />} />
              <Route path="/teams/:id" element={<TeamDetail />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/history" element={<MatchHistoryPage />} />
              <Route path="/match/:id" element={<MatchScheduling />} />
              <Route path="*" element={<NotFoundPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/teams/create" element={<CreateTeam />} />
                <Route path="/teams/:id/manage" element={<TeamManagement />} />
                <Route path="/messages" element={<MessageCenter />} />
                <Route path="/profile" element={<ProfileEdit />} />
                <Route path="/admin" element={<AdminConsole />} />
              </Route>
            </Route>
          </Routes>
          <CustomAlert />
        </BrowserRouter>
      </AlertProvider>
    </AuthProvider>
  );
}
