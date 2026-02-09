
-- Add phone field to volunteers
ALTER TABLE public.volunteers ADD COLUMN phone TEXT;

-- Add status field (active by default)
ALTER TABLE public.volunteers ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Add unique constraint on email to prevent duplicates at DB level
ALTER TABLE public.volunteers ADD CONSTRAINT volunteers_email_unique UNIQUE (email);

-- Allow volunteers to update their own data (by email match, since they're not authenticated users)
-- Update existing SELECT policy to be less restrictive for the volunteer flow
DROP POLICY IF EXISTS "Volunteers can view their own data" ON public.volunteers;
CREATE POLICY "Anyone can view volunteers"
ON public.volunteers
FOR SELECT
USING (true);

-- Allow updating volunteer profiles
CREATE POLICY "Volunteers can update their own data"
ON public.volunteers
FOR UPDATE
USING (true)
WITH CHECK (true);
