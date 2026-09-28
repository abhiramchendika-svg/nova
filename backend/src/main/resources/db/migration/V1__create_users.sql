-- V1: identity tables (docs/database.md §4, "Identity").
-- Flyway runs each versioned file exactly once, in order, and records it in flyway_schema_history.
-- Never edit a migration after it has run anywhere; add a new V<n>__ file instead.

create table users (
    id            uuid         primary key default gen_random_uuid(),
    -- Stored lower-case (enforced below) so a plain unique index gives case-insensitive uniqueness.
    email         varchar(254) not null,
    password_hash varchar(100) not null,
    display_name  varchar(80)  not null,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    constraint ck_users_email_lowercase check (email = lower(email)),
    constraint ck_users_display_name_not_blank check (length(trim(display_name)) > 0)
);

create unique index ux_users_email on users (email);

create table user_settings (
    user_id                   uuid         primary key references users (id) on delete cascade,
    timezone                  varchar(64)  not null default 'UTC',
    week_start                varchar(3)   not null default 'MON'
                                           constraint ck_user_settings_week_start check (week_start in ('MON', 'SUN')),
    university_name           varchar(120),
    -- Nullable on purpose: NOVA never assumes an attendance policy.
    default_attendance_target numeric(5, 2)
                              constraint ck_user_settings_attendance_target
                              check (default_attendance_target > 0 and default_attendance_target < 100),
    theme                     varchar(6)   not null default 'SYSTEM'
                                           constraint ck_user_settings_theme check (theme in ('LIGHT', 'DARK', 'SYSTEM')),
    onboarding_completed_at   timestamptz,
    created_at                timestamptz  not null default now(),
    updated_at                timestamptz  not null default now()
);
