-- V7: onboarding arrives in Phase 2.4. Accounts that already set up a semester before it existed
-- have nothing to be walked through, so they're marked as onboarded; everyone else (new accounts,
-- and older ones that never added a semester) sees the first-run flow once.
update user_settings
set onboarding_completed_at = now(),
    updated_at = now()
where onboarding_completed_at is null
  and user_id in (select distinct user_id from semesters);
