-- V8: planner tasks (docs/database.md §4 "Planner"). A task has an optional "do date"
-- (planned_for, plus an optional wall-clock start in the user's timezone) and an optional hard
-- deadline (due_at). Course and exam links are optional; deleting a course or exam keeps the task
-- and only clears the link. The project link arrives with projects in Phase 4.

create table tasks (
    id                   uuid          primary key default gen_random_uuid(),
    user_id              uuid          not null references users (id) on delete cascade,
    title                varchar(160)  not null,
    description          varchar(4000),
    category             varchar(11)   not null default 'PERSONAL',
    priority             varchar(6)    not null default 'MEDIUM',
    status               varchar(11)   not null default 'TODO',
    planned_for          date,
    planned_start        time,
    due_at               timestamptz,
    estimated_minutes    integer,
    completed_at         timestamptz,
    recurrence           varchar(8)    not null default 'NONE',
    recurrence_series_id uuid,
    course_id            uuid,
    exam_id              uuid,
    created_at           timestamptz   not null default now(),
    updated_at           timestamptz   not null default now(),
    constraint fk_tasks_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete set null (course_id),
    constraint fk_tasks_exam foreign key (exam_id, user_id)
        references exams (id, user_id) on delete set null (exam_id),
    constraint ck_tasks_title_not_blank check (length(trim(title)) > 0),
    constraint ck_tasks_category check (category in ('ACADEMIC', 'CODING', 'PERSONAL', 'INTERNSHIP', 'OPEN_SOURCE', 'PROJECT')),
    constraint ck_tasks_priority check (priority in ('LOW', 'MEDIUM', 'HIGH')),
    constraint ck_tasks_status check (status in ('TODO', 'IN_PROGRESS', 'DONE')),
    constraint ck_tasks_recurrence check (recurrence in ('NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY')),
    constraint ck_tasks_estimate check (estimated_minutes between 1 and 1440),
    -- completed_at is set exactly when the task is done
    constraint ck_tasks_completed check ((status = 'DONE') = (completed_at is not null)),
    -- a start time only makes sense on a planned day; a repeating task needs a day to repeat from
    constraint ck_tasks_start_needs_day check (planned_start is null or planned_for is not null),
    constraint ck_tasks_recurrence_needs_day check (recurrence = 'NONE' or planned_for is not null),
    constraint ck_tasks_recurrence_series check (recurrence = 'NONE' or recurrence_series_id is not null)
);

-- Today / Upcoming: open work by do date and by deadline. Partial, so finished work doesn't bloat them.
create index ix_tasks_open_planned on tasks (user_id, planned_for) where status <> 'DONE';
create index ix_tasks_open_due on tasks (user_id, due_at) where status <> 'DONE';
-- Done view, newest first
create index ix_tasks_done on tasks (user_id, completed_at desc) where status = 'DONE';
create index ix_tasks_course on tasks (course_id) where course_id is not null;
create index ix_tasks_exam on tasks (exam_id) where exam_id is not null;
-- One instance per day per series: completing, reopening and completing again can't duplicate the next one
create unique index uq_tasks_series_day on tasks (recurrence_series_id, planned_for)
    where recurrence_series_id is not null;
