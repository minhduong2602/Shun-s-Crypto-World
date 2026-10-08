-- Keep operational tables bounded without deleting user-owned portfolio data.
-- Retention windows are defined in purge_expired_portfolio_data():
-- wallet sync runs (30 days), alert delivery attempts (90 days), and
-- portfolio snapshots (365 days).

revoke all on function public.purge_expired_portfolio_data() from public, anon, authenticated, service_role;
grant execute on function public.purge_expired_portfolio_data() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'portfolio-data-retention') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'portfolio-data-retention';
  end if;

  perform cron.schedule(
    'portfolio-data-retention',
    '23 2 * * *',
    'select public.purge_expired_portfolio_data();'
  );
end;
$$;
