-- Migration: Add CEO support to existing RLS policies across HRMS tables.
-- Safe, idempotent updates for deployed environments.

BEGIN;

-- Ensure the app_role enum includes CEO when present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'app_role'
         AND pg_enum.enumlabel = 'CEO'
     ) THEN
    ALTER TYPE public.app_role ADD VALUE 'CEO';
  END IF;
END$$;

-- Attendance policies
DROP POLICY IF EXISTS "Att: admin select" ON public.attendance;
DROP POLICY IF EXISTS "Att: admin insert" ON public.attendance;
DROP POLICY IF EXISTS "Att: admin update" ON public.attendance;
CREATE POLICY "Att: admin select" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Att: admin insert" ON public.attendance FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Att: admin update" ON public.attendance FOR UPDATE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Leaves policies
DROP POLICY IF EXISTS "Leaves: admin select" ON public.leaves;
DROP POLICY IF EXISTS "Leaves: admin update" ON public.leaves;
CREATE POLICY "Leaves: admin select" ON public.leaves FOR SELECT USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Leaves: admin update" ON public.leaves FOR UPDATE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Leave balance history policies
DROP POLICY IF EXISTS "leave_balance_history: admin select all" ON public.leave_balance_history;
DROP POLICY IF EXISTS "leave_balance_history: admin insert" ON public.leave_balance_history;
DROP POLICY IF EXISTS "leave_balance_history: admin delete" ON public.leave_balance_history;
CREATE POLICY "leave_balance_history: admin select all" ON public.leave_balance_history FOR SELECT USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "leave_balance_history: admin insert" ON public.leave_balance_history FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "leave_balance_history: admin delete" ON public.leave_balance_history FOR DELETE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Holidays policies
DROP POLICY IF EXISTS "Holidays: admin insert" ON public.holidays;
DROP POLICY IF EXISTS "Holidays: admin update" ON public.holidays;
DROP POLICY IF EXISTS "Holidays: admin delete" ON public.holidays;
CREATE POLICY "Holidays: admin insert" ON public.holidays FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Holidays: admin update" ON public.holidays FOR UPDATE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Holidays: admin delete" ON public.holidays FOR DELETE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Payroll policies
DROP POLICY IF EXISTS "Payroll: admin all" ON public.payroll;
CREATE POLICY "Payroll: admin all" ON public.payroll FOR ALL USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO')) WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Payslips policies
DROP POLICY IF EXISTS "Payslips: admin all" ON public.payslips;
CREATE POLICY "Payslips: admin all" ON public.payslips FOR ALL USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO')) WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Calendar policies
DROP POLICY IF EXISTS "Calendar config: admin update" ON public.calendar_config;
CREATE POLICY "Calendar config: admin update" ON public.calendar_config FOR UPDATE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

DROP POLICY IF EXISTS "Calendar events: admin insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: admin update" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: admin delete" ON public.calendar_events;
CREATE POLICY "Calendar events: admin insert" ON public.calendar_events FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Calendar events: admin update" ON public.calendar_events FOR UPDATE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));
CREATE POLICY "Calendar events: admin delete" ON public.calendar_events FOR DELETE USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

DROP POLICY IF EXISTS "Notifications: admin manage all" ON public.calendar_notifications;
CREATE POLICY "Notifications: admin manage all" ON public.calendar_notifications FOR ALL USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'CEO'));

-- Appraisals policies
DROP POLICY IF EXISTS appraisals_employee_select_own ON public.appraisals;
DROP POLICY IF EXISTS appraisals_admin_all ON public.appraisals;
CREATE POLICY appraisals_employee_select_own ON public.appraisals FOR SELECT
  USING (
    employee_auth_uid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  );

CREATE POLICY appraisals_admin_all ON public.appraisals FOR ALL
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

-- Notifications policies
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_write ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT
  USING (
    user_auth_uid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  );
CREATE POLICY notifications_admin_write ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_uid = auth.uid()
        AND e.role::text IN ('Admin', 'CEO')
    )
  );

COMMIT;
