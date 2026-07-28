-- Drop unique constraint on date in holidays table so multiple events/announcements can exist on the same day
ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_key;

-- Drop check constraint on type column to allow 'Event' and 'Announcement' types
ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_type_check;

-- Ensure RLS policy allows authenticated & anon inserts for calendar events/announcements
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow write on holidays" ON public.holidays;
CREATE POLICY "Allow write on holidays" ON public.holidays FOR ALL USING (true);
