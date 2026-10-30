import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Mic, Plus, Square, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiJson, usePersona, type HandoverData, type Task } from "@/lib/persona";
import { LoadingLine } from "@/components/PriorityChip";
import { cn } from "@/lib/utils";
import { readJson } from "@/lib/http";

export const Route = createFileRoute("/record")({
  head: () => ({
    meta: [
      { title: "Record handover · ShiftBrief" },
      { name: "description", content: "Speak your shift handover; ShiftBrief extracts tasks and safety flags." },
      { property: "og:title", content: "Record handover · ShiftBrief" },
      { property: "og:description", content: "Speak your shift handover; ShiftBrief extracts tasks and safety flags." },
    ],
  }),
  component: RecordPage,
});

const MAX = 120;
const field = "h-12 w-full rounded-xl border bg-background px-3 text-sm";

function RecordPage() {
  const { persona } = usePersona();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<HandoverData | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    recRef.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const kb = Math.max(1, Math.round(blob.size / 1024));
        const emptyMsg = `Nothing was transcribed. Speak for at least 3 seconds, check your microphone, or use Type instead. (audio: ${kb} KB)`;
        if (blob.size < 2048) { toast.error(emptyMsg); return; }
        setStage("Listening…");
        try {
          const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
          const fd = new FormData();
          fd.append("audio", blob, `handover.${ext}`);
          const res = await fetch("/api/public/transcribe", { method: "POST", body: fd });
          const data = await readJson<{ text?: string; language?: string | null }>(res);
          if (!data.text?.trim()) { toast.error(emptyMsg); return; }
          setTranscript(data.text);
          setLang(data.language ?? null);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
        } finally {
          setStage(null);
        }
      };
      recRef.current = rec;
      rec.start(1000);
      setRecording(true);
      setSeconds(0);
      setResult(null);
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX) stop();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microphone not available");
    }
  };

  const extract = async () => {
    if (!persona || !transcript?.trim()) return;
    setStage("Gemma is reading your handover…");
    try {
      const out = await apiJson<HandoverData>("/api/public/handover", {
        transcript,
        author: { name: persona.name, role: persona.role, team: persona.team, language: persona.language },
      });
      setResult(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setStage(null);
    }
  };

  const publish = async () => {
    if (!persona || !result || !transcript) return;
    setStage("Publishing…");
    const { error } = await supabase.from("handovers").insert({
      author_id: persona.id,
      team: persona.team,
      transcript,
      summary: result.summary,
      source_language: result.source_language ?? lang,
      data: result as never,
      status: "published",
    });
    setStage(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Handover published to ${persona.team}`);
    navigate({ to: "/incoming" });
  };

  const updateTask = (i: number, patch: Partial<Task>) =>
    setResult((r) => r && { ...r, tasks: r.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Record handover</h1>
        <p className="text-sm text-muted-foreground">
          {persona ? `${persona.name} · ${persona.team}` : "…"}
        </p>
      </div>

      {transcript === null && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="relative">
            {recording && <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />}
            <button
              aria-label={recording ? "Stop recording" : "Start recording"}
              onClick={recording ? stop : start}
              disabled={!!stage}
              className={cn(
                "relative flex h-36 w-36 items-center justify-center rounded-full text-primary-foreground shadow-mic transition active:scale-95",
                recording ? "bg-safety" : "bg-primary",
              )}
            >
              {recording ? <Square className="h-12 w-12 fill-current" /> : <Mic className="h-14 w-14" />}
            </button>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {mm} <span className="text-sm font-normal text-muted-foreground">/ 2:00</span>
          </div>
          <p className="text-sm text-muted-foreground">{recording ? "Tap to stop" : "Tap to start speaking"}</p>
          {!recording && !stage && (
            <button onClick={() => setTranscript("")} className="h-12 text-sm font-medium text-primary">
              Type instead
            </button>
          )}
        </div>
      )}

      {stage && <LoadingLine text={stage} />}

      {transcript !== null && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Transcript</h2>
            <button
              onClick={() => {
                setTranscript(null);
                setResult(null);
                setSeconds(0);
              }}
              className="h-12 text-sm font-medium text-muted-foreground"
            >
              Record again
            </button>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={7}
            placeholder="Type or edit the handover…"
            className="w-full rounded-2xl border bg-card p-4 text-[15px] leading-relaxed shadow-card"
          />
          <button
            onClick={extract}
            disabled={!transcript.trim() || !!stage}
            className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            Extract tasks
          </button>
        </section>
      )}

      {result && (
        <section className="space-y-4">
          {result.safety_flags.length > 0 && (
            <div className="space-y-2 rounded-2xl border-2 border-safety bg-safety-soft p-4">
              <div className="flex items-center gap-2 font-semibold text-safety">
                <AlertTriangle className="h-5 w-5" /> Safety flags
              </div>
              {result.safety_flags.map((f, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold uppercase text-safety">{f.severity}</span> · {f.text}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <h2 className="mb-1 font-semibold">Summary</h2>
            <p className="text-sm">{result.summary}</p>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold">Tasks</h2>
            {result.tasks.map((t, i) => (
              <div key={t.id + i} className="space-y-2 rounded-2xl border bg-card p-3 shadow-card">
                <div className="flex gap-2">
                  <input className={field} value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })} placeholder="Task" />
                  <button
                    aria-label="Delete task"
                    onClick={() => setResult((r) => r && { ...r, tasks: r.tasks.filter((_, j) => j !== i) })}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select className={field} value={t.priority} onChange={(e) => updateTask(i, { priority: e.target.value as Task["priority"] })}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input className={field} value={t.due ?? ""} onChange={(e) => updateTask(i, { due: e.target.value || null })} placeholder="Due" />
                  <input className={field} value={t.location ?? ""} onChange={(e) => updateTask(i, { location: e.target.value || null })} placeholder="Where" />
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setResult((r) => r && { ...r, tasks: [...r.tasks, { id: `t${Date.now()}`, title: "", priority: "medium", due: null, location: null }] })
              }
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" /> Add task
            </button>
          </div>
          <button
            onClick={publish}
            disabled={!!stage}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-mic disabled:opacity-50"
          >
            Publish handover
          </button>
        </section>
      )}
    </div>
  );
}
