export type Lane = { id: string; name: string };
export type ProcStep = {
  id: string;
  label: string;
  laneId: string | null;
  pos?: { x: number; y: number };
};
export type Content = {
  goal: string;
  trigger: string;
  lanes: Lane[];
  steps: ProcStep[];
  metrics: string[];
};
export type Process = {
  id?: number;
  name: string;
  content: Content;
  updated_at?: string;
};
