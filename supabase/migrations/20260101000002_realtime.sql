-- ============================================================
-- ShiftSync Pro · Realtime Subscriptions
-- Enable realtime on notifications and schedules for live updates
-- ============================================================

-- Enable realtime publication for live updates
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.market_offers;
