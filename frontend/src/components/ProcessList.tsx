import React, { useEffect, useState } from 'react';
import { getProcesses } from '../services/supabaseService';

const ProcessList: React.FC = () => {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getProcesses();
        setProcesses(data);
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
      <h2>Liste des Processus</h2>
      <ul>
        {processes.map((proc) => (
          <li key={proc.id}>
            {proc.Name} (Département: {proc.Departement}, Owner: {proc.Owner}, Step: {proc.Step})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProcessList;
