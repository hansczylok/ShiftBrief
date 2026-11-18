-- TRUNCATE ignores row-level security, so the browser roles must not hold it. api_usage is only
-- touched by the service role through bump_api_usage. Safe to run more than once.
REVOKE TRUNCATE ON public.personas, public.handovers, public.briefs, public.task_states FROM anon, authenticated;
REVOKE ALL ON public.api_usage FROM anon, authenticated;
