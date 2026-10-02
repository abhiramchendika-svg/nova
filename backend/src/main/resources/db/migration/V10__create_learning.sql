-- V10: learning goals with ordered topics and resource links (docs/database.md §4 "Developer"),
-- and the optional task → learning goal link used by study plans. A goal's progress is derived
-- from its topics and never stored. Deleting a goal deletes its topics and links and keeps its
-- tasks, clearing the link.

create table learning_goals (
    id          uuid          primary key default gen_random_uuid(),
    user_id     uuid          not null references users (id) on delete cascade,
    title       varchar(100)  not null,
    description varchar(4000),
    status      varchar(6)    not null default 'ACTIVE',
    target_on   date,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    constraint uq_learning_goals_id_user unique (id, user_id),
    constraint ck_learning_goals_title_not_blank check (length(trim(title)) > 0),
    constraint ck_learning_goals_status check (status in ('ACTIVE', 'PAUSED', 'DONE'))
);

create index ix_learning_goals_user_status on learning_goals (user_id, status);

create table learning_topics (
    id         uuid          primary key default gen_random_uuid(),
    user_id    uuid          not null,
    goal_id    uuid          not null,
    title      varchar(160)  not null,
    position   integer       not null,                  -- display order; renumbered by the service
    done_at    timestamptz,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint fk_learning_topics_goal foreign key (goal_id, user_id)
        references learning_goals (id, user_id) on delete cascade,
    constraint ck_learning_topics_title_not_blank check (length(trim(title)) > 0),
    constraint ck_learning_topics_position check (position >= 0)
);

create index ix_learning_topics_goal on learning_topics (goal_id, position);

create table learning_resources (
    id         uuid          primary key default gen_random_uuid(),
    user_id    uuid          not null,
    goal_id    uuid          not null,
    title      varchar(120)  not null,
    url        varchar(2048) not null,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint fk_learning_resources_goal foreign key (goal_id, user_id)
        references learning_goals (id, user_id) on delete cascade,
    constraint ck_learning_resources_title_not_blank check (length(trim(title)) > 0),
    constraint ck_learning_resources_url check (url ~* '^https?://')
);

create index ix_learning_resources_goal on learning_resources (goal_id);

alter table tasks add column learning_goal_id uuid;
alter table tasks add constraint fk_tasks_learning_goal foreign key (learning_goal_id, user_id)
    references learning_goals (id, user_id) on delete set null (learning_goal_id);
create index ix_tasks_learning_goal on tasks (learning_goal_id) where learning_goal_id is not null;
