-- V11: hackathons (docs/database.md §4 "Developer") and the optional task → hackathon link for prep
-- work. Status tracks progress only; the outcome is free text the user writes ("result") and is
-- never inferred. Deleting a hackathon keeps its tasks (clearing the link); deleting its project
-- keeps the hackathon (clearing that link).

create table hackathons (
    id                    uuid          primary key default gen_random_uuid(),
    user_id               uuid          not null references users (id) on delete cascade,
    name                  varchar(120)  not null,
    organizer             varchar(120),
    mode                  varchar(7),
    location              varchar(120),
    website_url           varchar(2048),
    starts_on             date,
    ends_on               date,
    registration_deadline timestamptz,
    submission_deadline   timestamptz,
    status                varchar(13)   not null default 'INTERESTED',
    team_name             varchar(80),
    team_members          varchar(500),               -- free text; teammates aren't NOVA users
    project_id            uuid,
    result                varchar(160),               -- only what the user writes
    repo_url              varchar(2048),
    demo_url              varchar(2048),
    certificate_url       varchar(2048),
    notes                 varchar(4000),
    created_at            timestamptz   not null default now(),
    updated_at            timestamptz   not null default now(),
    constraint uq_hackathons_id_user unique (id, user_id),   -- target of fk_tasks_hackathon
    constraint fk_hackathons_project foreign key (project_id, user_id)
        references projects (id, user_id) on delete set null (project_id),
    constraint ck_hackathons_name_not_blank check (length(trim(name)) > 0),
    constraint ck_hackathons_mode check (mode in ('ONLINE', 'OFFLINE', 'HYBRID')),
    constraint ck_hackathons_status check (status in
        ('INTERESTED', 'REGISTERED', 'PARTICIPATING', 'SUBMITTED', 'FINISHED', 'SKIPPED')),
    constraint ck_hackathons_website_url check (website_url ~* '^https?://'),
    constraint ck_hackathons_repo_url check (repo_url ~* '^https?://'),
    constraint ck_hackathons_demo_url check (demo_url ~* '^https?://'),
    constraint ck_hackathons_certificate_url check (certificate_url ~* '^https?://'),
    constraint ck_hackathons_end_needs_start check (ends_on is null or starts_on is not null),
    constraint ck_hackathons_dates check (ends_on is null or ends_on >= starts_on),
    constraint ck_hackathons_deadlines check (registration_deadline is null or submission_deadline is null
        or registration_deadline <= submission_deadline)
);

create index ix_hackathons_user_start on hackathons (user_id, starts_on);
create index ix_hackathons_project on hackathons (project_id) where project_id is not null;

alter table tasks add column hackathon_id uuid;
alter table tasks add constraint fk_tasks_hackathon foreign key (hackathon_id, user_id)
    references hackathons (id, user_id) on delete set null (hackathon_id);
create index ix_tasks_hackathon on tasks (hackathon_id) where hackathon_id is not null;
