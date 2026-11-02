CREATE TABLE public.personas (id text PRIMARY KEY, name text NOT NULL, role text NOT NULL, team text NOT NULL, language text NOT NULL);
CREATE TABLE public.handovers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), author_id text NOT NULL, team text NOT NULL, transcript text NOT NULL DEFAULT '', summary text NOT NULL DEFAULT '', source_language text, data jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'published');
CREATE TABLE public.briefs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), handover_id uuid NOT NULL REFERENCES public.handovers(id) ON DELETE CASCADE, recipient_id text NOT NULL, language text, script text NOT NULL, checklist jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.task_states (handover_id uuid NOT NULL REFERENCES public.handovers(id) ON DELETE CASCADE, task_id text NOT NULL, recipient_id text NOT NULL, done boolean NOT NULL DEFAULT false, done_at timestamptz, PRIMARY KEY (handover_id, task_id, recipient_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personas, public.handovers, public.briefs, public.task_states TO anon, authenticated;
GRANT ALL ON public.personas, public.handovers, public.briefs, public.task_states TO service_role;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo all" ON public.personas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo all" ON public.handovers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo all" ON public.briefs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo all" ON public.task_states FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.personas VALUES
('anna','Anna','Nurse, night shift','Ward 3B','de'),
('mehmet','Mehmet','Nurse, day shift','Ward 3B','tr'),
('lisa','Lisa','Receptionist, late shift','Hotel Front Desk','de'),
('james','James','Receptionist, early shift','Hotel Front Desk','en'),
('petra','Petra','Line operator, shift C','Factory Line 2','de'),
('ion','Ion','Line operator, shift A','Factory Line 2','ro');