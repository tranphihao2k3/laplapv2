ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;
