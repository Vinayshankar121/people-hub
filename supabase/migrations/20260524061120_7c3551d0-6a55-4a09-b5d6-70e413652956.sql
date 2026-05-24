-- ============ ENUM + helper function ============
CREATE TYPE public.app_role AS ENUM ('Admin', 'Employee');

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  "joiningDate" TIMESTAMPTZ,
  salary NUMERIC NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'Employee',
  "profileImage" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- has_role security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE auth_uid = _user_id AND role = _role)
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Employees RLS
CREATE POLICY "Employees: self select" ON public.employees FOR SELECT
  USING (auth.uid() = auth_uid);
CREATE POLICY "Employees: admin select all" ON public.employees FOR SELECT
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Employees: admin insert" ON public.employees FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Employees: admin update" ON public.employees FOR UPDATE
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Employees: admin delete" ON public.employees FOR DELETE
  USING (public.has_role(auth.uid(), 'Admin'));

-- Auto-create employee row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp_id TEXT;
  v_name TEXT;
  v_role public.app_role;
BEGIN
  v_emp_id := COALESCE(NEW.raw_user_meta_data->>'employee_id', 'TM' || LPAD((FLOOR(RANDOM()*9999))::TEXT, 4, '0'));
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'Employee');
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ HOLIDAYS ============
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Company' CHECK (type IN ('National','Company')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Holidays: all auth read" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Holidays: admin insert" ON public.holidays FOR INSERT WITH CHECK (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Holidays: admin update" ON public.holidays FOR UPDATE USING (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Holidays: admin delete" ON public.holidays FOR DELETE USING (public.has_role(auth.uid(),'Admin'));

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  date DATE NOT NULL,
  punch_in_time TEXT NOT NULL DEFAULT '',
  punch_out_time TEXT NOT NULL DEFAULT '',
  total_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present','Absent','Leave','Holiday','Half Day')),
  approval_status TEXT NOT NULL DEFAULT 'Approved' CHECK (approval_status IN ('Approved','Pending','Rejected')),
  edit_requested BOOLEAN NOT NULL DEFAULT false,
  original_punch_in TEXT NOT NULL DEFAULT '',
  original_punch_out TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  approved_by UUID REFERENCES public.employees(auth_uid),
  approved_at TIMESTAMPTZ,
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_auth_uid, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Att: self select" ON public.attendance FOR SELECT USING (auth.uid() = user_auth_uid);
CREATE POLICY "Att: admin select" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Att: self insert" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_auth_uid);
CREATE POLICY "Att: admin insert" ON public.attendance FOR INSERT WITH CHECK (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Att: self update" ON public.attendance FOR UPDATE USING (auth.uid() = user_auth_uid);
CREATE POLICY "Att: admin update" ON public.attendance FOR UPDATE USING (public.has_role(auth.uid(),'Admin'));

-- ============ LEAVES ============
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  admin_comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Leaves: self select" ON public.leaves FOR SELECT USING (auth.uid() = user_auth_uid);
CREATE POLICY "Leaves: admin select" ON public.leaves FOR SELECT USING (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Leaves: self insert" ON public.leaves FOR INSERT WITH CHECK (auth.uid() = user_auth_uid);
CREATE POLICY "Leaves: admin update" ON public.leaves FOR UPDATE USING (public.has_role(auth.uid(),'Admin'));

-- ============ PAYROLL ============
CREATE TABLE public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  "basicSalary" NUMERIC NOT NULL DEFAULT 0,
  "workingDays" INTEGER NOT NULL DEFAULT 0,
  "presentDays" INTEGER NOT NULL DEFAULT 0,
  "absentDays" INTEGER NOT NULL DEFAULT 0,
  "approvedLeaves" INTEGER NOT NULL DEFAULT 0,
  holidays INTEGER NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  "netSalary" NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Locked','Paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_auth_uid, month, year)
);
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Payroll: self select" ON public.payroll FOR SELECT USING (auth.uid() = user_auth_uid);
CREATE POLICY "Payroll: admin all" ON public.payroll FOR ALL USING (public.has_role(auth.uid(),'Admin')) WITH CHECK (public.has_role(auth.uid(),'Admin'));

-- ============ PAYSLIPS ============
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID UNIQUE REFERENCES public.payroll(id) ON DELETE CASCADE,
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  pdf_path TEXT NOT NULL DEFAULT '',
  "pdfUrl" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payslips_updated BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Payslips: self select" ON public.payslips FOR SELECT USING (auth.uid() = user_auth_uid);
CREATE POLICY "Payslips: admin all" ON public.payslips FOR ALL USING (public.has_role(auth.uid(),'Admin')) WITH CHECK (public.has_role(auth.uid(),'Admin'));
