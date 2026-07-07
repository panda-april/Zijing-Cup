import React from 'react';
import { useNavigate } from 'react-router-dom';
import CreateTournament from '../DeployTournament';

export default function DeployTournamentWrapper() {
  const navigate = useNavigate();
  return (
    <CreateTournament
      onCancel={() => navigate('/admin')}
      onSuccess={() => navigate('/admin')}
    />
  );
}
