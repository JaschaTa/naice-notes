-- Purge tombstones nightly. Deleting only sets deleted_at, so a deleted note's text stays in the
-- database until purge_tombstones() hard-deletes it; the privacy policy promises 30 days.
--
-- A client whose cursor falls below the raised horizon re-reads in full (sync contract; both
-- the PWA's and Android's pull check it).
--
-- PGlite (supabase/test) has no pg_cron, so the block skips there.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available, tombstone purge not scheduled';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  -- Scheduling under an existing name replaces that job, so re-running is harmless.
  perform cron.schedule('purge-tombstones', '17 3 * * *', 'select public.purge_tombstones()');
end;
$$;
