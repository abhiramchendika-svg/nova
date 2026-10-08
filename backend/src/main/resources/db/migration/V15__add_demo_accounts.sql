-- V15: temporary "Try the demo" accounts (docs/api.md §2.1, "Demo").
-- A demo account is an ordinary user with an expiry. When it passes, DemoCleanup deletes the user;
-- every table that belongs to a user cascades on delete, so nothing is left behind.

alter table users add column demo_expires_at timestamptz;

-- Partial index: the clean-up job and the capacity checks only ever look at demo accounts
create index ix_users_demo_expires_at on users (demo_expires_at) where demo_expires_at is not null;
