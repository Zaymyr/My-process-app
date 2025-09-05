import React, { useEffect, useState } from 'react';
import { getRoles } from '../services/supabaseService';

const RoleList: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getRoles();
        setRoles(data);
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
      <h2>Liste des Rôles</h2>
      <ul>
        {roles.map((role) => (
          <li key={role.id}>
            {role.Name} (Département: {role.Departement})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RoleList;
