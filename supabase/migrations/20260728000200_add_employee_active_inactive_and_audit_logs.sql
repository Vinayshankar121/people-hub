-- Add Active / Inactive management columns to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'Active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ NULL;

-- Backfill default values for existing employee records
UPDATE public.employees SET is_active = true WHERE is_active IS NULL;
UPDATE public.employees SET employment_status = 'Active' WHERE employment_status IS NULL OR employment_status = '';

-- Create employee status audit log table
CREATE TABLE IF NOT EXISTS public.employee_status_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id TEXT,
    user_auth_uid TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and grant authenticated permissions
ALTER TABLE public.employee_status_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'employee_status_logs' AND policyname = 'Allow authenticated full access on employee_status_logs'
    ) THEN
        CREATE POLICY "Allow authenticated full access on employee_status_logs"
            ON public.employee_status_logs
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
