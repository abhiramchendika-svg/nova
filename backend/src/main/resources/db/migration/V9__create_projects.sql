-- V9: developer projects and their milestones (docs/database.md §4 "Developer"), and the optional
-- task → project link deferred from V8. A project's progress is derived from its milestones and
-- never stored. Deleting a project deletes its milestones and keeps its tasks, clearing the link.

create table projects (
    id          uuid          primary key default gen_random_uuid(),
    user_id     uuid          not null references users (id) on delete cascade,
    name        varchar(100)  not null,
    description varchar(4000),
    tech_stack  text[]        not null default '{}',
    repo_url    varchar(2048),
    demo_url    varchar(2048),
    status      varchar(11)   not null default 'IDEA',
    started_on  date,
    target_on   date,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    constraint uq_projects_id_user unique (id, user_id),     -- target of the composite FKs below
    constraint ck_projects_name_not_blank check (length(trim(name)) > 0),
    constraint ck_projects_status check (status in ('IDEA', 'PLANNING', 'DEVELOPMENT', 'COMPLETED', 'ARCHIVED')),
    constraint ck_projects_repo_url check (repo_url ~* '^https?://'),
    constraint ck_projects_demo_url check (demo_url ~* '^https?://'),
    constraint ck_projects_stack_size check (cardinality(tech_stack) <= 15),
    constraint ck_projects_dates check (target_on is null or started_on is null or target_on >= started_on)
);

create index ix_projects_user_status on projects (user_id, status);

create table project_milestones (
    id         uuid          primary key default gen_random_uuid(),
    user_id    uuid          not null,
    project_id uuid          not null,
    title      varchar(160)  not null,
    due_on     date,
    position   integer       not null,                  -- display order; renumbered by the service
    done_at    timestamptz,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint fk_milestones_project foreign key (project_id, user_id)
        references projects (id, user_id) on delete cascade,
    constraint ck_milestones_title_not_blank check (length(trim(title)) > 0),
    constraint ck_milestones_position check (position >= 0)
);

create index ix_milestones_project on project_milestones (project_id, position);
-- Calendar and Home: open milestones by due date
create index ix_milestones_open_due on project_milestones (user_id, due_on) where done_at is null and due_on is not null;

alter table tasks add column project_id uuid;
alter table tasks add constraint fk_tasks_project foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null (project_id);
create index ix_tasks_project on tasks (project_id) where project_id is not null;
