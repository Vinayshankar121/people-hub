-- Add leave types ENUM
CREATE TYPE public.leave_type_enum AS ENUM (
  'Casual Leave',
  'Sick Leave', 
  'Earned Leave',
  'Leave Without Pay'
);

-- Add leave balance tracking to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS casual_leave_balance NUMERIC DEFAULT 12,
  ADD COLUMN IF NOT EXISTS sick_leave_balance NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS earned_leave_balance NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS casual_leave_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_leave_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lwp_taken NUMERIC DEFAULT 0;

-- Add columns to leaves table to track leave type and paid status
ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS leave_type public.leave_type_enum DEFAULT 'Casual Leave',
  ADD COLUMN IF NOT EXISTS is_paid_leave BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS days_count NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS salary_deducted NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_to_lwp BOOLEAN DEFAULT false;

-- Create leave balance history table for audit trail
CREATE TABLE IF NOT EXISTS public.leave_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  leave_type public.leave_type_enum NOT NULL,
  action TEXT NOT NULL, -- 'approved', 'rejected', 'manual_adjustment'
  days_count NUMERIC NOT NULL,
  reason TEXT,
  related_leave_id UUID REFERENCES public.leaves(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_balance_history ENABLE ROW LEVEL SECURITY;

-- Create leave balance history RLS policies
CREATE POLICY "leave_balance_history: self select" ON public.leave_balance_history FOR SELECT
  USING (auth.uid() = user_auth_uid);
CREATE POLICY "leave_balance_history: admin select all" ON public.leave_balance_history FOR SELECT
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "leave_balance_history: admin insert" ON public.leave_balance_history FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "leave_balance_history: admin delete" ON public.leave_balance_history FOR DELETE
  USING (public.has_role(auth.uid(), 'Admin'));

-- Create RLS policies for leaves table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaves' AND policyname = 'leaves: self select'
  ) THEN
    CREATE POLICY "leaves: self select" ON public.leaves FOR SELECT
      USING (auth.uid() = user_auth_uid);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaves' AND policyname = 'leaves: self insert'
  ) THEN
    CREATE POLICY "leaves: self insert" ON public.leaves FOR INSERT
      WITH CHECK (auth.uid() = user_auth_uid);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaves' AND policyname = 'leaves: admin select all'
  ) THEN
    CREATE POLICY "leaves: admin select all" ON public.leaves FOR SELECT
      USING (public.has_role(auth.uid(), 'Admin'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaves' AND policyname = 'leaves: admin update'
  ) THEN
    CREATE POLICY "leaves: admin update" ON public.leaves FOR UPDATE
      USING (public.has_role(auth.uid(), 'Admin'));
  END IF;
END $$;

-- Add updated_at trigger to leave_balance_history
CREATE TRIGGER trg_leave_balance_history_updated 
BEFORE UPDATE ON public.leave_balance_history
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
