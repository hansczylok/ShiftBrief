// Reads a fetch Response as JSON; non-JSON error bodies surface status + raw text.
export async function readJson<T = any>(res: Response): Promise<T> {
  const raw = await res.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Request failed (${res.status}): ${raw.slice(0, 300) || res.statusText}`);
  }
  if (!res.ok || data?.error) throw new Error(data?.error ?? `Request failed (${res.status}): ${raw.slice(0, 300)}`);
  return data as T;
}
