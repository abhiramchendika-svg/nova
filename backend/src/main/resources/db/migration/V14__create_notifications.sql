-- V14: in-app notifications (docs/architecture.md §9.6, docs/database.md §4 "System").
-- A scheduled job creates them from the user's data. The unique (user_id, dedupe_key) makes every
-- run safe to repeat: the same reminder is never created twice, even with two app instances.

create table notifications (
    id          uuid         primary key default gen_random_uuid(),
    user_id     uuid         not null references users (id) on delete cascade,
    type        varchar(30)  not null,
    title       varchar(160) not null,
    body        varchar(500),
    link_path   varchar(200),                       -- in-app route, e.g. /app/academics/exams/{id}
    dedupe_key  varchar(120) not null,              -- e.g. 'EXAM_SOON:{examId}:2026-11-03'
    read_at     timestamptz,
    created_at  timestamptz  not null default now(),
    constraint uq_notifications_dedupe unique (user_id, dedupe_key),
    constraint ck_notifications_type check (type in (
        'ASSIGNMENT_DUE', 'TASK_DUE', 'TASK_OVERDUE', 'EXAM_SOON', 'ATTENDANCE_AT_RISK',
        'HACKATHON_DEADLINE', 'INTERNSHIP_DEADLINE', 'INTERNSHIP_STEP')),
    constraint ck_notifications_title_not_blank check (length(trim(title)) > 0),
    constraint ck_notifications_link check (link_path like '/app%')
);

-- The bell's unread count and the Unread filter
create index ix_notifications_unread on notifications (user_id, created_at desc) where read_at is null;
-- The full list, newest first
create index ix_notifications_user on notifications (user_id, created_at desc);
-- The daily clean-up of notifications read long ago
create index ix_notifications_read_at on notifications (read_at) where read_at is not null;

-- Types the user switched off in Settings → Notifications. No row = on, so every type starts on and
-- new types added later are on by default too.
create table notification_mutes (
    user_id  uuid        not null references users (id) on delete cascade,
    type     varchar(30) not null,
    primary key (user_id, type),
    constraint ck_notification_mutes_type check (type in (
        'ASSIGNMENT_DUE', 'TASK_DUE', 'TASK_OVERDUE', 'EXAM_SOON', 'ATTENDANCE_AT_RISK',
        'HACKATHON_DEADLINE', 'INTERNSHIP_DEADLINE', 'INTERNSHIP_STEP'))
);

-- The last state a rule saw, for rules that notify when something changes rather than when a date
-- comes near (attendance: SAFE → AT_RISK → BELOW). subject: e.g. 'ATTENDANCE:{courseId}'.
create table notification_states (
    user_id     uuid        not null references users (id) on delete cascade,
    subject     varchar(80) not null,
    state       varchar(20) not null,
    updated_at  timestamptz not null default now(),
    primary key (user_id, subject)
);
