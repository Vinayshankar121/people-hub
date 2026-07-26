# Appraisal Management Module — Implementation Checklist

- [ ] Add Supabase migration: `appraisals` table + RLS + indexes + status constraints
- [ ] (Optional) Add `notifications` table + RLS (for in-app notification when appraisal approved)
- [ ] Add route file: `people-hub/src/routes/appraisals.tsx`
- [ ] Add feature page: `people-hub/src/features/AppraisalsPage.tsx`
- [ ] Update sidebar navigation: add `Appraisals` link to `/appraisals` (admin + employee)
- [ ] Update dashboard widgets: `people-hub/src/features/DashboardPage.tsx`
- [ ] Implement admin appraisal workflow in `people-hub/src/lib/admin.functions.ts`
  - [ ] create draft
  - [ ] submit
  - [ ] approve (set approved_by/approved_at, status)
  - [ ] reject
  - [ ] fetch appraisals (admin filters/search)
  - [ ] fetch appraisals (employee own)
- [ ] Add approval notification (in-app/email) on approve
- [ ] Payroll integration: update `previewPayroll` and `generatePayroll` in `people-hub/src/lib/admin.functions.ts`
  - [ ] Use proposed_salary for entire payroll month when effective_from date falls within payroll month and appraisal is Approved
  - [ ] Otherwise use employees.salary
- [ ] Status badges + confirmation dialogs + validations + loading + toast errors
- [ ] Ensure employee can only view own appraisals; cannot create/edit/approve/reject
- [ ] Ensure admin can create/edit/submit/approve/reject/view all appraisals
- [ ] Run build/typecheck and smoke test flows

