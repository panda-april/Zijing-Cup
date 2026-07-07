import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditTournament from '../TournamentEdit';

export default function TournamentEditWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <EditTournament
      tournamentId={id}
      onCancel={() => navigate('/admin')}
      onSuccess={() => navigate('/admin')}
    />
  );
}
