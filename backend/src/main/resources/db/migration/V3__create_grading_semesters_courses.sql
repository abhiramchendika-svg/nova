-- V3: grading schemes, semesters and courses (docs/database.md §4 "Grading" and "Academics").
--
-- Ownership is enforced by the database, not only by code: a course's (semester_id, user_id) is a
-- composite foreign key to semesters(id, user_id), so a course can never point at another user's
-- semester even if a service has a bug.

-- ───────────── Grading ─────────────

create table grading_schemes (
    id         uuid          primary key default gen_random_uuid(),
    -- NULL = built-in preset (read-only, visible to everyone). Users clone a preset to edit it.
    user_id    uuid          references users (id) on delete cascade,
    name       varchar(60)   not null,
    max_points numeric(4, 2) not null,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint ck_grading_schemes_name_not_blank check (length(trim(name)) > 0),
    constraint ck_grading_schemes_max_points check (max_points > 0)
);

create index ix_grading_schemes_user on grading_schemes (user_id);

create table grade_definitions (
    id            uuid          primary key default gen_random_uuid(),
    scheme_id     uuid          not null references grading_schemes (id) on delete cascade,
    label         varchar(8)    not null,                 -- 'O', 'A+', 'B', 'F', 'P'
    points        numeric(4, 2) not null,
    is_passing    boolean       not null,                 -- defines the minimum passing grade per scheme
    counts_in_gpa boolean       not null default true,    -- false for Pass/Fail, Withdrawn, Audit ...
    position      integer       not null,                 -- display order, best first
    constraint ck_grade_definitions_points check (points >= 0),
    constraint ck_grade_definitions_position check (position >= 0),
    constraint ck_grade_definitions_label_not_blank check (length(trim(label)) > 0),
    -- Checked at commit, not per row: editing a scheme can swap labels or positions between
    -- existing rows inside one transaction, which is only invalid half-way through.
    constraint uq_grade_definitions_label unique (scheme_id, label) deferrable initially deferred,
    constraint uq_grade_definitions_position unique (scheme_id, position) deferrable initially deferred
);

-- ───────────── Academics ─────────────

create table semesters (
    id                uuid          primary key default gen_random_uuid(),
    user_id           uuid          not null references users (id) on delete cascade,
    grading_scheme_id uuid          not null references grading_schemes (id),   -- no cascade: in-use schemes can't be deleted
    name              varchar(40)   not null,             -- 'Semester 3', 'Fall 2026'
    ordinal           integer       not null,             -- 1, 2, 3 ... chronological order
    starts_on         date,
    ends_on           date,
    is_current        boolean       not null default false,
    -- Overrides the user's default target; NULL = inherit. Used from Phase 2.2 (attendance).
    attendance_target numeric(5, 2),
    created_at        timestamptz   not null default now(),
    updated_at        timestamptz   not null default now(),
    constraint uq_semesters_id_user unique (id, user_id),          -- target of the courses composite FK
    constraint uq_semesters_user_ordinal unique (user_id, ordinal),
    constraint ck_semesters_name_not_blank check (length(trim(name)) > 0),
    constraint ck_semesters_ordinal check (ordinal > 0),
    constraint ck_semesters_dates check (ends_on is null or starts_on is null or ends_on >= starts_on),
    constraint ck_semesters_attendance_target check (attendance_target > 0 and attendance_target < 100)
);

-- At most one current semester per user
create unique index ux_semesters_one_current on semesters (user_id) where is_current;
create index ix_semesters_scheme on semesters (grading_scheme_id);

create table courses (
    id                  uuid          primary key default gen_random_uuid(),
    user_id             uuid          not null,
    semester_id         uuid          not null,
    code                varchar(20),                     -- 'CSE 201'
    name                varchar(120)  not null,
    credits             numeric(4, 1) not null,          -- numeric, never float: 3 × 8.5 must be exact
    faculty             varchar(120),
    color_hue           integer,                         -- optional per-course accent, 0-359
    notes               varchar(2000),
    grade_definition_id uuid          references grade_definitions (id),
    grade_kind          varchar(8),                      -- FINAL (official) or EXPECTED (projection only)
    -- Attendance (used from Phase 2.2): target override and the counts the student starts from
    attendance_target   numeric(5, 2),
    baseline_conducted  integer       not null default 0,
    baseline_attended   integer       not null default 0,
    created_at          timestamptz   not null default now(),
    updated_at          timestamptz   not null default now(),
    constraint uq_courses_id_user unique (id, user_id),            -- target for later child tables
    constraint fk_courses_semester foreign key (semester_id, user_id)
        references semesters (id, user_id) on delete cascade,
    constraint ck_courses_name_not_blank check (length(trim(name)) > 0),
    constraint ck_courses_credits check (credits >= 0),
    constraint ck_courses_color_hue check (color_hue between 0 and 359),
    constraint ck_courses_grade_kind check (grade_kind in ('FINAL', 'EXPECTED')),
    constraint ck_courses_grade_complete check ((grade_definition_id is null) = (grade_kind is null)),
    constraint ck_courses_attendance_target check (attendance_target > 0 and attendance_target < 100),
    constraint ck_courses_baseline check (
        baseline_conducted >= 0 and baseline_attended >= 0 and baseline_attended <= baseline_conducted)
);

-- PostgreSQL doesn't index foreign-key columns automatically
create index ix_courses_semester on courses (semester_id);
create index ix_courses_user on courses (user_id);
create index ix_courses_grade on courses (grade_definition_id);

-- ───────────── Built-in presets ─────────────
-- Examples, not assumed university policies: users clone and adjust them.
-- Fixed ids keep them stable across environments (and let tests and the mock API refer to them).

insert into grading_schemes (id, user_id, name, max_points) values
    ('00000000-0000-4000-8000-000000000001', null, '10-point scale', 10.00),
    ('00000000-0000-4000-8000-000000000002', null, '4.0 scale (US)', 4.00),
    -- No grade here counts towards GPA, so the maximum is never used in a calculation
    ('00000000-0000-4000-8000-000000000003', null, 'Pass/Fail', 10.00);

insert into grade_definitions (id, scheme_id, label, points, is_passing, counts_in_gpa, position) values
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'O',  10.00, true,  true, 0),
    ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'A+',  9.00, true,  true, 1),
    ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'A',   8.00, true,  true, 2),
    ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'B+',  7.00, true,  true, 3),
    ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'B',   6.00, true,  true, 4),
    ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'C',   5.00, true,  true, 5),
    ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'P',   4.00, true,  true, 6),
    ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'F',   0.00, false, true, 7),

    ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'A',   4.00, true,  true, 0),
    ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000002', 'A-',  3.70, true,  true, 1),
    ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000002', 'B+',  3.30, true,  true, 2),
    ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002', 'B',   3.00, true,  true, 3),
    ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000002', 'B-',  2.70, true,  true, 4),
    ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000002', 'C+',  2.30, true,  true, 5),
    ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000002', 'C',   2.00, true,  true, 6),
    ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000002', 'C-',  1.70, true,  true, 7),
    ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000002', 'D+',  1.30, true,  true, 8),
    ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000002', 'D',   1.00, true,  true, 9),
    ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000002', 'F',   0.00, false, true, 10),

    ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000003', 'P',   0.00, true,  false, 0),
    ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000003', 'F',   0.00, false, false, 1);
