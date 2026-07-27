-- Change payroll attendance counters to numeric so half-day values are stored correctly.

ALTER TABLE public.payroll
  ALTER COLUMN "presentDays" TYPE NUMERIC USING "presentDays"::NUMERIC,
  ALTER COLUMN "absentDays" TYPE NUMERIC USING "absentDays"::NUMERIC;
