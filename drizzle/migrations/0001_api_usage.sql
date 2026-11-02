CREATE TABLE public.api_usage (
  day date NOT NULL DEFAULT current_date,
  route text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, route)
);
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_api_usage(_route text, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.api_usage(day, route, count) VALUES (current_date, _route, 1)
  ON CONFLICT (day, route) DO UPDATE SET count = public.api_usage.count + 1
  RETURNING count INTO n;
  RETURN n <= _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_api_usage(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_api_usage(text, integer) TO service_role;