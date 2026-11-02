import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime, usePersona, type HandoverData } from "@/lib/persona";
import { LoadingLine } from "@/components/PriorityChip";

export const Route = createFileRoute("/incoming")({
  head: () => ({
    meta: [
      { title: "Incoming handovers · ShiftBrief" },
      { name: "description", content: "Handovers waiting for your team, newest first." },
      { property: "og:title", content: "Incoming handovers · ShiftBrief" },
      { property: "og:description", content: "Handovers waiting for your team, newest first." },
    ],
  }),
  component: Incoming,
});

function Incoming() {
  const { persona, personas } = usePersona();
  const team = persona?.team;
  const { data, isLoading } = useQuery({
    queryKey: ["handovers", team],
    enabled: !!team,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("handovers")
        .select("*")
        .eq("team", team!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Incoming</h1>
        <p className="text-sm text-muted-foreground">{team ?? "…"}</p>
      </div>
      {isLoading && <LoadingLine text="Loading handovers…" />}
      {data?.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No handovers for {team} yet.{" "}
          <Link to="/record" className="font-medium text-primary">
            Record one
          </Link>
        </div>
      )}
      {data?.map((h) => {
        const author = personas.find((p) => p.id === h.author_id);
        const d = (h.data ?? {}) as Partial<HandoverData>;
        const nTasks = d.tasks?.length ?? 0;
        const nFlags = d.safety_flags?.length ?? 0;
        return (
          <Link
            key={h.id}
            to="/brief/$id"
            params={{ id: h.id }}
            className="block rounded-2xl border bg-card p-4 shadow-card transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-accent-foreground">
                {(author?.name ?? h.author_id).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {author?.name ?? h.author_id} → {h.team}
                </div>
                <div className="text-xs text-muted-foreground">{relativeTime(h.created_at)}</div>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-sm">{h.summary}</p>
            <div className="mt-3 text-xs font-medium text-muted-foreground">
              {nTasks} tasks · <span className={nFlags ? "text-safety" : ""}>{nFlags} safety flags</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
