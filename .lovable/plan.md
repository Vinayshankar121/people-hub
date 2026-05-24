# HRMS Build Plan

A full HRMS for Tech Minds IT Solutions with Admin/Employee roles. I'll adapt the BRD to this project's stack (TanStack Start + Lovable Cloud / Supabase) while keeping the UI, modules, and business rules identical.

## Stack mapping (BRD → this project)

- React Router DOM v7 → **TanStack Router** (file-based routes in `src/routes/`)
- Vite + React → already present
- TailwindCSS v3 → **Tailwind v4** (already wired via `src/styles.css`)
- Supabase Auth + Postgres → **Lovable Cloud** (Supabase under the hood)
- Edge Functions for payroll → **TanStack `createServerFn`** (admin-elevated)
- Axios-style `api.js` → typed server functions + browser Supabase client
- `react-big-calendar` + `date-fns` + `lucide-react` → install as deps

## Modules to build

1. **Auth** — Login page, AuthContext via `onAuthStateChange`, ProtectedRoute, role-based routing
2. **Layout** — Dark sidebar (264px) + white navbar (80px) with Punch In/Out for employees
3. **Dashboard** — Admin (5 stat cards + quick actions) / Employee (4 cards + last payslip + upcoming holidays)
4. **Employees** (admin) — Table, search, dept/role filters, Add/Edit/Delete modals incl. password field
5. **Attendance** — Admin (all logs by date + pending corrections approve/reject) / Employee (monthly history + 7-day edit window)
6. **Leaves** — Admin approve/reject with comment / Employee submit + view history; auto-create Leave attendance on approval
7. **Payroll** — Admin preview → lock & distribute; both can view history + download PDF payslip
8. **Holidays** — Admin CRUD, Employee view-only, card grid
9. **Calendar** — `react-big-calendar` month view with color-coded events, admin can filter by employee

## Database (Lovable Cloud)

Create all 6 tables exactly as specified in §5: `employees`, `holidays`, `attendance`, `leaves`, `payroll`, `payslips`. Add `app_role` enum + `has_role()` security-definer function. Apply RLS per §9, using `has_role(auth.uid(), 'admin')` to avoid recursion.

Seed two demo accounts:
- `admin@hrms.com` / `admin@123` (Admin, TM000)
- `employee@hrms.com` / `employee@123` (Employee, TM001)

Auto-create employee row on signup via trigger on `auth.users`.

## Server functions (admin/privileged)

- `createEmployee` — admin creates Supabase Auth user + employees row
- `deleteEmployee` — admin removes auth user + row
- `approveLeave` — sets status, auto-upserts Leave attendance for weekdays excl. holidays
- `previewPayroll` / `generatePayroll` — compute work days / present / absent / deductions, create payroll + payslip rows
- `approveAttendanceEdit` / `rejectAttendanceEdit`

All authenticated reads use the browser Supabase client + RLS. Bearer auth middleware (`attachSupabaseAuth`) wired in `src/start.ts`.

## Design system

- Primary blue `#2563eb`, dark slate sidebar `slate-900`
- Card radius 16px, input radius 12px, system sans
- Tokens defined in `src/styles.css` (oklch)

## Routes

```
/login                  (public)
/_authenticated/
  index                 dashboard
  employees             admin-gated client-side
  attendance
  leaves
  payroll
  holidays
  calendar
```

## Out of scope for v1

- Forgot/reset password page (can add next)
- Profile image upload (column exists, UI deferred)
- PDF payslip generation will use a simple client-side jsPDF download (no Storage upload) — keeps scope tight; can move to server-side later

## Confirmation

Ready to build this end-to-end. It's a large scope (~20 files + DB migration). Approving the plan starts the implementation.
