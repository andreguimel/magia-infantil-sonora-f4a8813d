ALTER TABLE public.tracking_links ADD COLUMN commission_percent numeric NOT NULL DEFAULT 50;
ALTER TABLE public.tracking_links ADD COLUMN commission_paid numeric NOT NULL DEFAULT 0;