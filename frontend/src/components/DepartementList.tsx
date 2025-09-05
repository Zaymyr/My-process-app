import React, { useEffect, useState } from 'react';
import { getDepartements } from '../services/supabaseService';

const DepartementList: React.FC = () => {
  const [departements, setDepartements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getDepartements();
        setDepartements(data);
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
      <h2>Liste des Départements</h2>
      <ul>
        {departements.map((dep) => (
          <li key={dep.id}>
            {dep.Name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DepartementList;
