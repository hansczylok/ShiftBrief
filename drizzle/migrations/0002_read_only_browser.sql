-- The browser (anon) only reads. Handovers and briefs are written by API routes with the service
-- role; the browser may still tick and untick tasks. Safe to run more than once.
DROP POLICY IF EXISTS "demo all" ON public.personas;
DROP POLICY IF EXISTS "demo all" ON public.handovers;
DROP POLICY IF EXISTS "demo all" ON public.briefs;
DROP POLICY IF EXISTS "demo all" ON public.task_states;
REVOKE INSERT, UPDATE, DELETE ON public.personas, public.handovers, public.briefs FROM anon, authenticated;
REVOKE DELETE ON public.task_states FROM anon, authenticated;

DROP POLICY IF EXISTS "read" ON public.personas;
DROP POLICY IF EXISTS "read" ON public.handovers;
DROP POLICY IF EXISTS "read" ON public.briefs;
DROP POLICY IF EXISTS "read" ON public.task_states;
DROP POLICY IF EXISTS "tick task" ON public.task_states;
DROP POLICY IF EXISTS "retick task" ON public.task_states;
CREATE POLICY "read" ON public.personas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read" ON public.handovers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read" ON public.briefs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read" ON public.task_states FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tick task" ON public.task_states FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.handovers h WHERE h.id = handover_id));
CREATE POLICY "retick task" ON public.task_states FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (EXISTS (SELECT 1 FROM public.handovers h WHERE h.id = handover_id));
