import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiJson, usePersona, type HandoverData, type Task } from "@/lib/persona";
import { LoadingLine, PriorityChip } from "@/components/PriorityChip";

export const Route = createFileRoute("/brief/$id")({
  head: () => ({
    meta: [
      { title: "Your brief · ShiftBrief" },
      { name: "description", content: "Listen to your translated shift brief and tick off tasks." },
      { property: "og:title", content: "Your brief · ShiftBrief" },
      { property: "og:description", content: "Listen to your translated shift brief and tick off tasks." },
    ],
  }),
  component: BriefPage,
});

type Brief = { id: string; script: string; language: string | null; checklist: { id: string; title: string }[] };

function BriefPage() {
  const { id } = Route.useParams();
  const { persona, personas } = usePersona();
  const qc = useQueryClient();
  const [stage, setStage] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const { data: handover } = useQuery({
    queryKey: ["handover", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("handovers").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const author = personas.find((p) => p.id === handover?.author_id);
  const hd = (handover?.data ?? {}) as Partial<HandoverData>;

  const { data: states = [] } = useQuery({
    queryKey: ["task_states", id, persona?.id],
    enabled: !!persona,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_states")
        .select("*")
        .eq("handover_id", id)
        .eq("recipient_id", persona!.id);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!handover || !persona) return;
    let cancelled = false;
    let url: string | null = null;
    setBrief(null);
    setAudioUrl(null);
    (async () => {
      try {
        const { data: cached } = await supabase
          .from("briefs")
          .select("*")
          .eq("handover_id", id)
          .eq("recipient_id", persona.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        let b = cached as unknown as Brief | null;
        if (!b) {
          setStage(`Writing ${persona.name}'s brief…`);
          const out = await apiJson<{ script: string; language: string; checklist: Brief["checklist"] }>(
            "/api/public/brief",
            {
              handover: { summary: handover.summary, ...hd },
              author: { name: author?.name ?? handover.author_id, role: author?.role ?? "" },
              recipient: { name: persona.name, role: persona.role, language: persona.language },
            },
          );
          const { data: ins, error } = await supabase
            .from("briefs")
            .insert({ handover_id: id, recipient_id: persona.id, language: out.language, script: out.script, checklist: out.checklist })
            .select()
            .single();
          if (error) throw error;
          b = ins as unknown as Brief;
        }
        if (cancelled) return;
        setBrief(b);
        setStage("Generating voice…");
        const res = await fetch("/api/public/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: b.script }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Voice failed (${res.status})`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setStage(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handover?.id, persona?.id]);

  const toggleTask = async (taskId: string, done: boolean) => {
    if (!persona) return;
    const { error } = await supabase.from("task_states").upsert({
      handover_id: id,
      task_id: taskId,
      recipient_id: persona.id,
      done,
      done_at: done ? new Date().toISOString() : null,
    });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task_states", id, persona.id] });
  };

  const tasks: Task[] = hd.tasks ?? [];
  const titleFor = (t: Task) => brief?.checklist.find((c) => c.id === t.id)?.title || t.title;

  return (
    <div className="space-y-4">
      <Link to="/incoming" className="inline-flex h-12 items-center gap-1 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Incoming
      </Link>
      {handover && (
        <div>
          <h1 className="text-2xl font-bold">
            {author?.name ?? handover.author_id} → {persona?.name}
          </h1>
          <p className="text-sm text-muted-foreground">{handover.team}</p>
        </div>
      )}

      <Player url={audioUrl} disabled={!audioUrl} />
      {stage && <LoadingLine text={stage} />}

      {(hd.safety_flags ?? []).length > 0 && (
        <div className="space-y-2">
          {hd.safety_flags!.map((f, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border-2 border-safety bg-safety-soft p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-safety" />
              <div className="text-sm">
                <span className="font-semibold uppercase text-safety">{f.severity}</span> · {f.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {brief && (
        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Your brief</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold uppercase text-accent-foreground">
              {brief.language ?? persona?.language}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{brief.script}</p>
        </section>
      )}

      {tasks.length > 0 && (
        <section className="rounded-2xl border bg-card p-2 shadow-card">
          <h2 className="px-2 pt-2 font-semibold">Checklist</h2>
          {tasks.map((t) => {
            const done = !!states.find((s) => s.task_id === t.id)?.done;
            return (
              <label key={t.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-2 active:bg-muted">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => toggleTask(t.id, e.target.checked)}
                  className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className={done ? "text-muted-foreground line-through" : "font-medium"}>{titleFor(t)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <PriorityChip priority={t.priority} />
                    {t.due && <span>⏱ {t.due}</span>}
                    {t.location && <span>📍 {t.location}</span>}
                  </div>
                </div>
              </label>
            );
          })}
        </section>
      )}

      {handover && (
        <div>
          <button onClick={() => setShowTranscript((v) => !v)} className="h-12 text-sm font-medium text-primary">
            {showTranscript ? "Hide original transcript" : "Show original transcript"}
          </button>
          {showTranscript && (
            <p className="whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{handover.transcript}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Player({ url, disabled }: { url: string | null; disabled: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
      <button
        aria-label={playing ? "Pause" : "Play"}
        disabled={disabled}
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) a.play();
          else a.pause();
        }}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-mic disabled:opacity-40 disabled:shadow-none"
      >
        {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium">{disabled ? "Preparing audio…" : playing ? "Playing" : "Play brief"}</div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {url && (
        <audio
          ref={ref}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setProgress(a.duration ? a.currentTime / a.duration : 0);
          }}
        />
      )}
    </div>
  );
}
