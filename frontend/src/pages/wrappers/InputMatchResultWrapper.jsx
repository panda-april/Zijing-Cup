import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import InputMatchResult from '../InputMatchResult';

export default function InputMatchResultWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <InputMatchResult
      matchId={id}
      onCancel={() => navigate('/admin')}
      onSuccess={() => navigate('/admin')}
    />
  );
}
