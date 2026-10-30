import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Persona = { id: string; name: string; role: string; team: string; language: string };

const KEY = "shiftbrief.persona";
type Ctx = { personas: Persona[]; persona: Persona | null; setPersonaId: (id: string) => void };
const PersonaCtx = createContext<Ctx>({ personas: [], persona: null, setPersonaId: () => {} });

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>("anna");
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) setId(saved);
  }, []);
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personas").select("*").order("team");
      if (error) throw error;
      return data as Persona[];
    },
  });
  const setPersonaId = (v: string) => {
    setId(v);
    localStorage.setItem(KEY, v);
  };
  const persona = personas.find((p) => p.id === id) ?? personas[0] ?? null;
  return <PersonaCtx.Provider value={{ personas, persona, setPersonaId }}>{children}</PersonaCtx.Provider>;
}

export const usePersona = () => useContext(PersonaCtx);

export async function apiJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const { readJson } = await import("@/lib/http");
  return readJson<T>(res);
}

export type Task = { id: string; title: string; priority: "high" | "medium" | "low"; due: string | null; location: string | null };
export type SafetyFlag = { text: string; severity: string };
export type HandoverData = {
  summary: string;
  source_language: string | null;
  tasks: Task[];
  safety_flags: SafetyFlag[];
  open_questions: string[];
  people_or_assets: string[];
};

export function relativeTime(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
