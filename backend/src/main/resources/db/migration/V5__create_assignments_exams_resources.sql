-- V5: assignments, exams with a topic checklist, and course links
-- (docs/database.md §4 "Academics"). Every child row carries user_id and a composite foreign key to
-- its parent's (id, user_id), so it can never point at another user's course or exam.

-- ───────────── Course links ─────────────

create table course_resources (
    id         uuid          primary key default gen_random_uuid(),
    user_id    uuid          not null,
    course_id  uuid          not null,
    title      varchar(120)  not null,
    url        varchar(2048) not null,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint fk_course_resources_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete cascade,
    constraint ck_course_resources_title_not_blank check (length(trim(title)) > 0),
    -- Only web links: no javascript:, file: or data: URLs can ever be stored
    constraint ck_course_resources_url_http check (url ~* '^https?://')
);

create index ix_course_resources_course on course_resources (course_id);

-- ───────────── Assignments ─────────────

create table assignments (
    id                uuid          primary key default gen_random_uuid(),
    user_id           uuid          not null,
    course_id         uuid          not null,
    title             varchar(160)  not null,
    description       varchar(4000),
    due_at            timestamptz   not null,
    priority          varchar(6)    not null default 'MEDIUM',
    status            varchar(11)   not null default 'NOT_STARTED',
    estimated_minutes integer,
    progress_pct      integer       not null default 0,
    submitted_at      timestamptz,
    completed_at      timestamptz,
    created_at        timestamptz   not null default now(),
    updated_at        timestamptz   not null default now(),
    constraint fk_assignments_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete cascade,
    constraint ck_assignments_title_not_blank check (length(trim(title)) > 0),
    constraint ck_assignments_priority check (priority in ('LOW', 'MEDIUM', 'HIGH')),
    constraint ck_assignments_status check (status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED')),
    constraint ck_assignments_estimate check (estimated_minutes > 0),
    constraint ck_assignments_progress check (progress_pct between 0 and 100),
    -- Timestamps follow the status (the service sets them; the database refuses anything inconsistent)
    constraint ck_assignments_completed check ((status = 'COMPLETED') = (completed_at is not null)),
    constraint ck_assignments_submitted check (submitted_at is null or status in ('SUBMITTED', 'COMPLETED')),
    constraint ck_assignments_completed_full check (status <> 'COMPLETED' or progress_pct = 100)
);

-- Open work by due date: "upcoming deadlines" and overdue checks. Partial, so it stays small as
-- finished work piles up.
create index ix_assignments_open_due on assignments (user_id, due_at)
    where status in ('NOT_STARTED', 'IN_PROGRESS');
create index ix_assignments_course on assignments (course_id);

-- ───────────── Exams ─────────────

create table exams (
    id               uuid         primary key default gen_random_uuid(),
    user_id          uuid         not null,
    course_id        uuid         not null,
    title            varchar(120) not null,              -- 'Mid-semester 1'
    kind             varchar(7)   not null default 'OTHER',
    starts_at        timestamptz  not null,
    duration_minutes integer,
    location         varchar(60),
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz  not null default now(),
    constraint uq_exams_id_user unique (id, user_id),          -- target of the exam_topics composite FK
    constraint fk_exams_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete cascade,
    constraint ck_exams_title_not_blank check (length(trim(title)) > 0),
    constraint ck_exams_kind check (kind in ('QUIZ', 'MIDTERM', 'FINAL', 'LAB', 'OTHER')),
    constraint ck_exams_duration check (duration_minutes between 1 and 1440)
);

create index ix_exams_user_start on exams (user_id, starts_at);
create index ix_exams_course on exams (course_id);

create table exam_topics (
    id         uuid         primary key default gen_random_uuid(),
    user_id    uuid         not null,
    exam_id    uuid         not null,
    title      varchar(160) not null,
    position   integer      not null,                    -- display order; renumbered by the service
    done_at    timestamptz,                              -- prep % = done / total, never stored
    created_at timestamptz  not null default now(),
    updated_at timestamptz  not null default now(),
    constraint fk_exam_topics_exam foreign key (exam_id, user_id)
        references exams (id, user_id) on delete cascade,
    constraint ck_exam_topics_title_not_blank check (length(trim(title)) > 0),
    constraint ck_exam_topics_position check (position >= 0)
);

create index ix_exam_topics_exam on exam_topics (exam_id);
