-- V12: internship applications with their status history (docs/database.md §4 "Developer"), and
-- the optional task → application link for prep work. Analytics are derived from the history and
-- never stored. Deleting an application deletes its history and keeps its tasks (clearing the link).

create table internship_applications (
    id             uuid          primary key default gen_random_uuid(),
    user_id        uuid          not null references users (id) on delete cascade,
    company        varchar(120)  not null,
    role           varchar(120)  not null,
    location       varchar(120),
    job_url        varchar(2048),
    source         varchar(60),                          -- 'LinkedIn', 'Referral', 'Campus'
    status         varchar(10)   not null default 'APPLIED',
    applied_on     date,
    deadline_at    timestamptz,                          -- apply by (matters while saved)
    next_step      varchar(120),                         -- 'Technical interview'
    next_step_at   timestamptz,
    resume_version varchar(60),                          -- a label, e.g. 'v3-backend'
    notes          varchar(4000),
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),
    constraint uq_internships_id_user unique (id, user_id),  -- target of the composite FKs below
    constraint ck_internships_company_not_blank check (length(trim(company)) > 0),
    constraint ck_internships_role_not_blank check (length(trim(role)) > 0),
    constraint ck_internships_status check (status in
        ('SAVED', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN')),
    constraint ck_internships_job_url check (job_url ~* '^https?://'),
    constraint ck_internships_applied check (status = 'SAVED' or applied_on is not null)
);

create index ix_internships_user_status on internship_applications (user_id, status);
create index ix_internships_user_applied on internship_applications (user_id, applied_on desc);

create table internship_status_events (
    id             uuid         primary key default gen_random_uuid(),
    user_id        uuid         not null,
    application_id uuid         not null,
    from_status    varchar(10),                          -- null for the first status
    to_status      varchar(10)  not null,
    changed_at     timestamptz  not null default now(),
    constraint fk_internship_events_application foreign key (application_id, user_id)
        references internship_applications (id, user_id) on delete cascade,
    constraint ck_internship_events_to check (to_status in
        ('SAVED', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'))
);

create index ix_internship_events_app on internship_status_events (application_id, changed_at);

alter table tasks add column internship_id uuid;
alter table tasks add constraint fk_tasks_internship foreign key (internship_id, user_id)
    references internship_applications (id, user_id) on delete set null (internship_id);
create index ix_tasks_internship on tasks (internship_id) where internship_id is not null;
