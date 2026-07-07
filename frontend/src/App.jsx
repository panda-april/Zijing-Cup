import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RequireAdmin from './components/RequireAdmin';
import CustomAlert from './components/CustomAlert';

import DashboardPage from './pages/DashboardPage';
import TeamsDirectoryPage from './pages/TeamsDirectoryPage';
import MatchHistoryPage from './pages/MatchHistoryPage';
import TeamDetail from './pages/TeamDetail';
import TeamManagement from './pages/TeamManagement';
import TeamListSelect from './pages/TeamListSelect';
import TournamentDetail from './pages/TournamentDetail';
import CreateTeam from './pages/CreateTeam';
import AdminConsole from './pages/AdminConsole';
import MessageCenter from './pages/MessageCenter';
import ProfileEdit from './pages/ProfileEdit';
import MatchScheduling from './pages/MatchScheduling';
import NotFoundPage from './pages/NotFoundPage';
import DeployTournamentWrapper from './pages/wrappers/DeployTournamentWrapper';
import TournamentEditWrapper from './pages/wrappers/TournamentEditWrapper';
import InputMatchResultWrapper from './pages/wrappers/InputMatchResultWrapper';

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/teams" element={<TeamsDirectoryPage />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/history" element={<MatchHistoryPage />} />
            <Route path="/match/:id" element={<MatchScheduling />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/teams/create" element={<CreateTeam />} />
              <Route path="/teams/:id/manage" element={<TeamManagement />} />
              <Route path="/teams/manage" element={<TeamListSelect />} />
              <Route path="/messages" element={<MessageCenter />} />
              <Route path="/profile" element={<ProfileEdit />} />
              <Route path="/match/:id/result" element={<InputMatchResultWrapper />} />

              {/* Admin-only routes */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminConsole />} />
                <Route path="/admin/tournaments/new" element={<DeployTournamentWrapper />} />
                <Route path="/admin/tournaments/:id/edit" element={<TournamentEditWrapper />} />
                <Route path="/admin/matches/:id/results" element={<InputMatchResultWrapper />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <CustomAlert />
      </AlertProvider>
    </AuthProvider>
  );
}
