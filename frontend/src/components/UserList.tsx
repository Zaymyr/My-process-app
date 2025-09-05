import React, { useEffect, useState } from 'react';
import { getUsers } from '../services/supabaseService';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getUsers();
        setUsers(data);
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
      <h2>Liste des Utilisateurs</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.Name} ({user.Email}) - Rôle: {user.Role}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserList;
