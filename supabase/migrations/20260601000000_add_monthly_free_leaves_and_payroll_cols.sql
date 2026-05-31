-- Add monthly free leave config to employees and payroll columns for tracking
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS monthly_free_casual INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_free_sick INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_free_total INTEGER DEFAULT 2;

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS paid_leaves_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_deductions NUMERIC DEFAULT 0;

-- No scheduled reset needed because monthly allowance is computed at payroll time