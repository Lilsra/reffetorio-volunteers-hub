
-- Add birthdate and occupation columns
ALTER TABLE public.volunteers ADD COLUMN birthdate date;
ALTER TABLE public.volunteers ADD COLUMN occupation text;

-- Make address nullable (keep column for historical data but no longer required)
ALTER TABLE public.volunteers ALTER COLUMN address SET DEFAULT '';
ALTER TABLE public.volunteers ALTER COLUMN address DROP NOT NULL;
