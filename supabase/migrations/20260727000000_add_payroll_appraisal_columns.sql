-- Add payroll columns for appraisal tracking and update the payroll view

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS "appraisalApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "appraisalEffectiveFrom" DATE;

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
  p."appraisalApplied",
  p."appraisalEffectiveFrom",
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
  e.location,
  e."pf_no",
  e.universal_account_number,
  e.date_of_birth
FROM public.payroll p
JOIN public.employees e ON p.user_auth_uid = e.auth_uid;
