-- HRMS Professional Calendar Management System
-- Comprehensive holiday and calendar configuration for IT companies

CREATE TABLE IF NOT EXISTS public.calendar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'TechMinds',
  weekend_days TEXT[] NOT NULL DEFAULT ARRAY['Saturday', 'Sunday'],
  financial_year_start SMALLINT NOT NULL DEFAULT 4, -- Month (1-12), April = 4
  max_paid_leaves_per_month SMALLINT NOT NULL DEFAULT 2,
  total_paid_leaves_per_year SMALLINT NOT NULL DEFAULT 24,
  enable_pf BOOLEAN NOT NULL DEFAULT false,
  enable_esi BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar config: all auth read" ON public.calendar_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Calendar config: admin update" ON public.calendar_config FOR UPDATE USING (public.has_role(auth.uid(),'Admin') OR public.has_role(auth.uid(),'CEO'));

-- Enhanced holidays table with more detailed categorization
ALTER TABLE public.holidays
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'National' CHECK (category IN ('National', 'Public', 'Company', 'Optional', 'Weekend')),
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_full_day BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(auth_uid),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Calendar events table for company events and announcements
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TEXT DEFAULT NULL,
  end_time TEXT DEFAULT NULL,
  event_type TEXT NOT NULL DEFAULT 'company' CHECK (event_type IN ('company', 'meeting', 'training', 'announcement')),
  location TEXT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES public.employees(auth_uid),
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'department', 'team')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar events: all auth read" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Calendar events: admin insert" ON public.calendar_events FOR INSERT WITH CHECK (public.has_role(auth.uid(),'Admin') OR public.has_role(auth.uid(),'CEO'));
CREATE POLICY "Calendar events: admin update" ON public.calendar_events FOR UPDATE USING (public.has_role(auth.uid(),'Admin') OR public.has_role(auth.uid(),'CEO'));
CREATE POLICY "Calendar events: admin delete" ON public.calendar_events FOR DELETE USING (public.has_role(auth.uid(),'Admin') OR public.has_role(auth.uid(),'CEO'));

-- Calendar notifications
CREATE TABLE IF NOT EXISTS public.calendar_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_uid UUID NOT NULL REFERENCES public.employees(auth_uid) ON DELETE CASCADE,
  holiday_id UUID REFERENCES public.holidays(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday', 'event', 'leave', 'announcement')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_auth_uid, holiday_id),
  UNIQUE(user_auth_uid, event_id)
);
ALTER TABLE public.calendar_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications: user read own" ON public.calendar_notifications FOR SELECT USING (auth.uid() = user_auth_uid);
CREATE POLICY "Notifications: user insert own" ON public.calendar_notifications FOR INSERT WITH CHECK (auth.uid() = user_auth_uid);
CREATE POLICY "Notifications: admin manage all" ON public.calendar_notifications FOR ALL USING (public.has_role(auth.uid(),'Admin') OR public.has_role(auth.uid(),'CEO'));

-- Initialize default calendar config
INSERT INTO public.calendar_config (company_name, weekend_days, financial_year_start, max_paid_leaves_per_month, total_paid_leaves_per_year)
VALUES ('TechMinds IT Solutions', ARRAY['Saturday', 'Sunday'], 4, 2, 24)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER trg_calendar_config_updated BEFORE UPDATE ON public.calendar_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_calendar_events_updated BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
