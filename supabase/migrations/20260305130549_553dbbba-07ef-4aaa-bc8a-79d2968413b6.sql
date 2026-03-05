
-- Add ref_code column to music_tasks
ALTER TABLE public.music_tasks ADD COLUMN ref_code text;

-- Create tracking_links table
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on tracking_links
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

-- Deny all direct access (same pattern as music_tasks)
CREATE POLICY "Deny direct read access" ON public.tracking_links FOR SELECT USING (false);
CREATE POLICY "Deny direct insert access" ON public.tracking_links AS RESTRICTIVE FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct update access" ON public.tracking_links FOR UPDATE USING (false);
CREATE POLICY "Deny direct delete access" ON public.tracking_links FOR DELETE USING (false);
