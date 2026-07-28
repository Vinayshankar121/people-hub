-- Create company_settings table for persistent backend configuration
CREATE TABLE IF NOT EXISTS public.company_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist to prevent conflict
DROP POLICY IF EXISTS "Allow public read of company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow write of company_settings for authenticated users" ON public.company_settings;

-- Allow public read access so all users/employees can fetch settings
CREATE POLICY "Allow public read of company_settings" ON public.company_settings
  FOR SELECT USING (true);

-- Allow authenticated users to update settings
CREATE POLICY "Allow write of company_settings for authenticated users" ON public.company_settings
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
