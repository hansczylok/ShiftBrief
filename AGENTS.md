<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Backend endpoints (transcribe, handover, brief, speak, health) live as TanStack server routes under src/routes/api/public/ instead of Supabase Edge Functions — platform rule for this stack.
- AI prompt texts live in src/server/prompts.ts so they can be swapped without touching route logic.
- Paid API routes call requireDemoCode and takeQuota (src/server/ai.ts) before any paid work (speak serves cached audio before either check); daily counters live in api_usage, written only via the service-role bump_api_usage RPC.
- Brief voice audio is cached in the private brief-audio bucket as <briefId>.mp3 and served via signed URLs, because the workspace blocks public buckets.
- The access-code dialog (src/lib/access.tsx) opens only when apiFetch gets a 401; it never opens on page load, and the interrupted request is retried once after the code is entered.
