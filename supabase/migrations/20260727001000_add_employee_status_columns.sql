-- Add employee status columns to support Active/Inactive user management

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.employees
  ALTER COLUMN status SET DEFAULT 'Active';

UPDATE public.employees
SET is_active = CASE WHEN status = 'Inactive' THEN false ELSE true END
WHERE status IS NOT NULL;
