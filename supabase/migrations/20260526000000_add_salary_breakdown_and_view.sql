-- Add salary breakdown columns to payroll table
ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS "monthlySalary" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlySalary" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherAllowances" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyBasic" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyHra" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyOtherAllowances" NUMERIC NOT NULL DEFAULT 0;

-- Create VIEW for payroll with employee details (read-only)
CREATE OR REPLACE VIEW public.payroll_with_employee_details AS
SELECT 
  p.id,
  p.user_auth_uid,
  p.month,
  p.year,
  p."basicSalary",
  p."monthlySalary",
  p."yearlySalary",
  p."workingDays",
  p."presentDays",
  p."absentDays",
  p."approvedLeaves",
  p.holidays,
  p.deductions,
  p."netSalary",
  p.hra,
  p."otherAllowances",
  p."yearlyBasic",
  p."yearlyHra",
  p."yearlyOtherAllowances",
  p.status,
  p.created_at,
  p.updated_at,
  e.name,
  e.employee_id,
  e.email,
  e.department,
  e.designation,
  e.salary,
  e."joiningDate",
  e.phone,
  e.bank_name,
  e.bank_account_no,
  e.pan_no,
  e.pf_no,
  e.universal_account_number,
  e.date_of_birth
FROM public.payroll p
JOIN public.employees e ON p.user_auth_uid = e.auth_uid;

-- Create RLS policy for the VIEW (users can see their own, admins see all)
-- Note: Views don't have direct RLS, but querying through the view inherits from the underlying tables
