import React, { useEffect, useState } from 'react';
import { getSteps } from '../services/supabaseService';

const StepList: React.FC = () => {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getSteps();
        setSteps(data);
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
      <h2>Liste des Étapes</h2>
      <ul>
        {steps.map((step) => (
          <li key={step.id}>
            {step.Name} (Action: {step.Action})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StepList;
