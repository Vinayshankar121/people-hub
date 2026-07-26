-- Create Appraisal Management Module tables: appraisals (+ optional notifications)

-- Appraisal table
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

-- Status constraint
ALTER TABLE public.appraisals
  DROP CONSTRAINT IF EXISTS appraisals_status_check;

ALTER TABLE public.appraisals
  ADD CONSTRAINT appraisals_status_check
  CHECK (status IN ('Draft','Submitted','Approved','Rejected'));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_appraisals_employee_auth_uid_status_cycle
  ON public.appraisals (employee_auth_uid, status, appraisal_cycle);

CREATE INDEX IF NOT EXISTS idx_appraisals_effective_from
  ON public.appraisals (effective_from);

-- updated_at trigger
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

-- Enable RLS
ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

-- Admin users can access all (role stored in employees table)
-- Employee users can access only their own appraisals

CREATE OR REPLACE VIEW public.appraisals_with_auth_user AS
SELECT a.*
FROM public.appraisals a;

-- RLS policies
DROP POLICY IF EXISTS appraisals_employee_select_own ON public.appraisals;
CREATE POLICY appraisals_employee_select_own
  ON public.appraisals
  FOR SELECT
  USING (
    employee_auth_uid = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.auth_uid = auth.uid()
          AND e.role::text IN ('Admin', 'CEO')
      )
    )
  );

DROP POLICY IF EXISTS appraisals_admin_all ON public.appraisals;
CREATE POLICY appraisals_admin_all
  ON public.appraisals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  );

-- If you use Supabase auth + auth.uid(), the above SELECT policy allows employees to read their own records.

-- Optional: Notifications table for in-app/email messaging
-- Only created if it does not already exist.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid uuid NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'AppraisalApproved',
  meta JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  USING (user_auth_uid = auth.uid() OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid()
      AND e.role::text IN ('Admin', 'CEO')
  ));

DROP POLICY IF EXISTS notifications_admin_write ON public.notifications;
CREATE POLICY notifications_admin_write
  ON public.notifications
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_uid = auth.uid()
      AND e.role::text IN ('Admin', 'CEO')
  ));

