import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Inbox, Mic } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PersonaProvider, usePersona } from "@/lib/persona";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link to="/incoming" className="inline-flex h-12 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground">
            Go to Incoming
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Something went wrong."}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ShiftBrief — voice shift handovers" },
      { name: "description", content: "Record a shift handover by voice; the next shift hears a translated brief." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function HealthDot() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await fetch("/api/public/health")).json() as Promise<{ elevenlabs: boolean; gemini: boolean }>,
    refetchInterval: 60000,
  });
  const ok = !!data?.elevenlabs && !!data?.gemini;
  return (
    <span
      title={data ? `Voice: ${data.elevenlabs ? "ready" : "missing key"} · Gemma: ${data.gemini ? "ready" : "missing key"}` : "Checking…"}
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !data ? "bg-muted-foreground" : ok ? "bg-ok" : "bg-safety")}
    />
  );
}

function TopBar() {
  const { personas, persona, setPersonaId } = usePersona();
  return (
    <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
        <span className="text-lg font-bold tracking-tight text-primary">ShiftBrief</span>
        <HealthDot />
        <label className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">I am…</span>
          <select
            aria-label="I am…"
            value={persona?.id ?? ""}
            onChange={(e) => setPersonaId(e.target.value)}
            className="h-11 min-w-0 max-w-[220px] truncate rounded-xl border bg-background px-3 text-sm font-medium text-foreground"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.team}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}

function BottomNav() {
  const item = "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card">
      <div className="mx-auto flex max-w-xl">
        <Link to="/incoming" className={item} activeProps={{ className: "text-primary" }}>
          <Inbox className="h-6 w-6" /> Incoming
        </Link>
        <Link to="/record" className={item} activeProps={{ className: "text-primary" }}>
          <Mic className="h-6 w-6" /> Record
        </Link>
      </div>
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <PersonaProvider>
        <TopBar />
        <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
          <Outlet />
        </main>
        <BottomNav />
        <Toaster position="top-center" />
      </PersonaProvider>
    </QueryClientProvider>
  );
}
