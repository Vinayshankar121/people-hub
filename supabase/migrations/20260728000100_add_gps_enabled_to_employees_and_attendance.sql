-- Add gps_enabled column to employees table (default: true)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gps_enabled BOOLEAN DEFAULT true;

-- Update existing employees to have gps_enabled = true if null
UPDATE public.employees SET gps_enabled = true WHERE gps_enabled IS NULL;

-- Add gps_enabled column to attendance table (default: true)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS gps_enabled BOOLEAN DEFAULT true;

-- Update existing attendance rows to have gps_enabled = true if null
UPDATE public.attendance SET gps_enabled = true WHERE gps_enabled IS NULL;
