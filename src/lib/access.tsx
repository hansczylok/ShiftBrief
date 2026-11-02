import { useEffect, useState } from "react";

const KEY = "shiftbrief.accessCode";
const EVT = "shiftbrief:need-code";

type CodePrompt = { message: string; resolve: (code: string | null) => void };

export const getAccessCode = () =>
  typeof window === "undefined" ? null : localStorage.getItem(KEY);

// Opens the access-code dialog; resolves with the entered code, or null when the user cancels.
function askForCode(message: string): Promise<string | null> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<CodePrompt>(EVT, { detail: { message, resolve } }));
  });
}

// Sends a request to a paid API route with the stored access code. On 401 the dialog opens and,
// once a code is entered, the same request is sent once more. Only the paid routes return 401, so
// browsing and cached audio never trigger the dialog.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (code: string | null) => {
    const headers = new Headers(init.headers);
    if (code) headers.set("x-demo-code", code);
    return fetch(path, { ...init, headers });
  };
  const stored = getAccessCode();
  const res = await send(stored);
  if (res.status !== 401) return res;
  if (stored) localStorage.removeItem(KEY);
  const code = await askForCode(
    stored ? "Access code not valid" : "This action needs the demo access code.",
  );
  if (!code) return res;
  localStorage.setItem(KEY, code);
  return send(code);
}

export function AccessCodeDialog() {
  const [prompt, setPrompt] = useState<CodePrompt | null>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    const on = (e: Event) => {
      setValue("");
      setPrompt((prev) => {
        prev?.resolve(null);
        return (e as CustomEvent<CodePrompt>).detail;
      });
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  if (!prompt) return null;
  const close = (code: string | null) => {
    prompt.resolve(code);
    setPrompt(null);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) close(value.trim());
        }}
        className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-5 shadow-card"
      >
        <h2 className="text-lg font-semibold">Enter demo access code</h2>
        <p className="text-sm text-muted-foreground">{prompt.message}</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 w-full rounded-xl border bg-background px-3"
          aria-label="Access code"
        />
        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => close(null)}
          className="h-11 w-full rounded-xl border bg-background text-sm"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
