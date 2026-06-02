-- Ensure leave and payroll columns exist for payroll preview and generation logic
-- This migration is safe to run repeatedly because it uses IF NOT EXISTS.

ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS days_count NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_paid_leave BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS converted_to_lwp BOOLEAN DEFAULT false;

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS paid_leaves_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_deductions NUMERIC DEFAULT 0;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS monthly_free_casual INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_free_sick INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_free_total INTEGER DEFAULT 2;
