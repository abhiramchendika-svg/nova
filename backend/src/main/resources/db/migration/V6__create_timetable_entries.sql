-- V6: the weekly timetable (docs/database.md §4 "Academics"). An entry is a recurring class: a course,
-- a weekday and a wall-clock start and end. Times are `time` without a zone and are read in the
-- user's timezone, so "Monday 09:00" stays 09:00 across DST changes.

create table timetable_entries (
    id          uuid         primary key default gen_random_uuid(),
    user_id     uuid         not null,
    course_id   uuid         not null,
    day_of_week integer      not null,                 -- ISO: 1 = Monday … 7 = Sunday
    starts_at   time         not null,
    ends_at     time         not null,
    kind        varchar(8)   not null default 'LECTURE',
    location    varchar(60),
    instructor  varchar(120),
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now(),
    constraint fk_timetable_course foreign key (course_id, user_id)
        references courses (id, user_id) on delete cascade,
    constraint ck_timetable_day check (day_of_week between 1 and 7),
    constraint ck_timetable_times check (ends_at > starts_at),
    constraint ck_timetable_kind check (kind in ('LECTURE', 'LAB', 'TUTORIAL', 'OTHER'))
);

-- Today's classes and the weekly grid
create index ix_timetable_user_day on timetable_entries (user_id, day_of_week, starts_at);
create index ix_timetable_course on timetable_entries (course_id);
