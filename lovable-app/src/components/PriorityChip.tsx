import { cn } from "@/lib/utils";

const styles = {
  high: "bg-safety-soft text-safety",
  medium: "bg-warn-soft text-warn",
  low: "bg-muted text-muted-foreground",
} as const;

export function PriorityChip({ priority }: { priority: string }) {
  const p = (priority in styles ? priority : "low") as keyof typeof styles;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", styles[p])}>
      {p}
    </span>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-4 text-sm font-medium text-accent-foreground">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
      {text}
    </div>
  );
}
