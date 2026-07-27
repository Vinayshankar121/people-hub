-- Appraisals module: ensure public.appraisals schema, constraints, RLS, indexes, and updated_at trigger
-- Idempotent migration intended to be safe on existing environments.

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  employee_auth_uid uuid NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,

  appraisal_cycle TEXT NOT NULL,

  current_salary NUMERIC NOT NULL DEFAULT 0,
  proposed_salary NUMERIC NOT NULL DEFAULT 0,
  increment_percentage NUMERIC NOT NULL DEFAULT 0,

  performance_rating TEXT,
  achievements TEXT,
  manager_feedback TEXT,

  status TEXT NOT NULL DEFAULT 'Draft',
  effective_from DATE NOT NULL,

  approved_by uuid,
  approved_at TIMESTAMPTZ,

  created_by uuid NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Constraints
-- 2) Constraints (ensure status constraint exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'appraisals'
      AND c.conname = 'appraisals_status_check'
  ) THEN
    ALTER TABLE public.appraisals
      ADD CONSTRAINT appraisals_status_check
      CHECK (status IN ('Draft','Submitted','Approved','Rejected'));
  END IF;
END$$;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_appraisals_employee_auth_uid
  ON public.appraisals (employee_auth_uid);

CREATE INDEX IF NOT EXISTS idx_appraisals_status
  ON public.appraisals (status);

CREATE INDEX IF NOT EXISTS idx_appraisals_effective_from
  ON public.appraisals (effective_from);

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appraisals_updated_at ON public.appraisals;
CREATE TRIGGER trg_appraisals_updated_at
BEFORE UPDATE ON public.appraisals
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5) Enable RLS
ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

-- 6) Policies
-- Employees: only view their own appraisals
DROP POLICY IF EXISTS appraisals_employee_select_own ON public.appraisals;
CREATE POLICY appraisals_employee_select_own
  ON public.appraisals
  FOR SELECT
  USING (
    employee_auth_uid = auth.uid()
  );

-- Admins: manage all appraisals
-- Uses public.employees.role = 'Admin' convention from existing code.
DROP POLICY IF EXISTS appraisals_admin_all ON public.appraisals;
CREATE POLICY appraisals_admin_all
  ON public.appraisals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  );

COMMIT;

