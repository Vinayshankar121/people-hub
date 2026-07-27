-- Migration: Add CEO role, appraisal cycles, and self-appraisal/admin/CEO columns to appraisals.
-- Safe, idempotent execution.

-- 1. Drop dependent policies on notifications and appraisals first (direct e.role query)
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_write ON public.notifications;
DROP POLICY IF EXISTS appraisals_admin_all ON public.appraisals;
DROP POLICY IF EXISTS appraisals_employee_select_own ON public.appraisals;

-- 2. Alter employees.role to TEXT to bypass enum limitations
ALTER TABLE public.employees ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.employees ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE public.employees ALTER COLUMN role SET DEFAULT 'Employee';

-- 3. Update trigger handle_new_user to use TEXT role instead of enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp_id TEXT;
  v_name TEXT;
  v_role TEXT;
BEGIN
  v_emp_id := COALESCE(NEW.raw_user_meta_data->>'employee_id', 'TM' || LPAD((FLOOR(RANDOM()*9999))::TEXT, 4, '0'));
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Employee');
  INSERT INTO public.employees (auth_uid, employee_id, name, email, role,
    department, designation, salary, phone, "joiningDate")
  VALUES (
    NEW.id, v_emp_id, v_name, NEW.email, v_role,
    COALESCE(NEW.raw_user_meta_data->>'department',''),
    COALESCE(NEW.raw_user_meta_data->>'designation',''),
    COALESCE((NEW.raw_user_meta_data->>'salary')::NUMERIC, 0),
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    COALESCE((NEW.raw_user_meta_data->>'joiningDate')::TIMESTAMPTZ, now())
  )
  ON CONFLICT (auth_uid) DO NOTHING;
  RETURN NEW;
END; $$;

-- 4. Redefine has_role(UUID, public.app_role) to typecast the input, and create overloaded has_role(UUID, TEXT)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE auth_uid = _user_id AND role = _role::text)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE auth_uid = _user_id AND role = _role)
$$;

-- 5. Recreate notifications policies using the text-based roles (support Admin and CEO)
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  USING (user_auth_uid = auth.uid() OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid()
      AND e.role IN ('Admin', 'CEO')
  ));

CREATE POLICY notifications_admin_write ON public.notifications
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid()
      AND e.role IN ('Admin', 'CEO')
  ));

-- 6. Create appraisal_cycles table
CREATE TABLE IF NOT EXISTS public.appraisal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Active', 'Closed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for appraisal_cycles
ALTER TABLE public.appraisal_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appraisal_cycles_employee_select ON public.appraisal_cycles;
CREATE POLICY appraisal_cycles_employee_select ON public.appraisal_cycles
  FOR SELECT USING (status IN ('Active', 'Closed') OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid() AND e.role IN ('Admin', 'CEO')
  ));

DROP POLICY IF EXISTS appraisal_cycles_admin_ceo_all ON public.appraisal_cycles;
CREATE POLICY appraisal_cycles_admin_ceo_all ON public.appraisal_cycles
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid() AND e.role IN ('Admin', 'CEO')
  ));

-- 7. Alter appraisals table to add all flow-specific fields
ALTER TABLE public.appraisals
  ADD COLUMN IF NOT EXISTS projects_worked TEXT,
  ADD COLUMN IF NOT EXISTS skills_learned TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  ADD COLUMN IF NOT EXISTS challenges_faced TEXT,
  ADD COLUMN IF NOT EXISTS suggestions TEXT,
  ADD COLUMN IF NOT EXISTS future_goals TEXT,
  ADD COLUMN IF NOT EXISTS self_rating INT,
  
  ADD COLUMN IF NOT EXISTS strengths TEXT,
  ADD COLUMN IF NOT EXISTS areas_for_improvement TEXT,
  ADD COLUMN IF NOT EXISTS admin_comments TEXT,
  ADD COLUMN IF NOT EXISTS admin_rating INT,
  ADD COLUMN IF NOT EXISTS admin_increment_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_increment_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_proposed_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation_type TEXT,
  
  ADD COLUMN IF NOT EXISTS ceo_comments TEXT,
  ADD COLUMN IF NOT EXISTS ceo_increment_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ceo_increment_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ceo_proposed_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ceo_effective_date DATE,
  ADD COLUMN IF NOT EXISTS ceo_decision TEXT;

-- Update status check constraint
ALTER TABLE public.appraisals DROP CONSTRAINT IF EXISTS appraisals_status_check;
ALTER TABLE public.appraisals ADD CONSTRAINT appraisals_status_check 
  CHECK (status IN ('Draft', 'Self Submitted', 'Admin Reviewed', 'CEO Approved', 'Payroll Updated', 'Completed', 'Send Back', 'Rejected', 'Closed'));

-- 8. Recreate RLS policies on appraisals table for Admin, CEO, and Employees
CREATE POLICY appraisals_employee_select_own ON public.appraisals
  FOR SELECT
  USING (
    employee_auth_uid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid() AND e.role IN ('Admin', 'CEO')
    )
  );

CREATE POLICY appraisals_employee_insert_own ON public.appraisals
  FOR INSERT
  WITH CHECK (employee_auth_uid = auth.uid());

CREATE POLICY appraisals_employee_update_own ON public.appraisals
  FOR UPDATE
  USING (
    employee_auth_uid = auth.uid() AND (status = 'Draft' OR status = 'Send Back')
  )
  WITH CHECK (
    employee_auth_uid = auth.uid()
  );

CREATE POLICY appraisals_admin_all ON public.appraisals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid() AND e.role IN ('Admin', 'CEO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid() AND e.role IN ('Admin', 'CEO')
    )
  );
