import React, { useEffect, useState } from 'react';
import { getActions } from '../services/supabaseService';

const ActionList: React.FC = () => {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getActions();
        setActions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <h2>Liste des Actions</h2>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>
            {action.Name} (Séquence: {action.Num_sequence}, Rôle: {action.Role})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActionList;
