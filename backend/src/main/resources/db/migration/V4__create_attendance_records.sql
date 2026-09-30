-- V4: attendance (docs/database.md §4 "Academics", §6 "Attendance").
--
-- A course's attendance = its baseline counts (courses.baseline_conducted / baseline_attended, the
-- "28 of 34" a student copies from the portal when they start using NOVA) + one row per class marked
-- since. Percentages and "can miss" are always computed from these, never stored.

create table attendance_records (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null,
    course_id  uuid        not null,
    held_on    date        not null,
    slot       integer     not null default 1,     -- 2 classes of one course on the same day: slots 1 and 2
    status     varchar(9)  not null,               -- CANCELLED classes are kept for history but never counted
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Composite FK: a record can only point at a course of the same user
    constraint fk_attendance_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete cascade,
    constraint uq_attendance_course_day_slot unique (course_id, held_on, slot),
    constraint ck_attendance_slot check (slot between 1 and 12),
    constraint ck_attendance_status check (status in ('PRESENT', 'ABSENT', 'CANCELLED'))
);

-- The unique constraint's index (course_id, held_on, slot) already serves per-course counts and
-- newest-first history, so it replaces the planned ix_attendance_course_date. This one serves
-- "all my records" queries (per-semester stats).
create index ix_attendance_user on attendance_records (user_id);
