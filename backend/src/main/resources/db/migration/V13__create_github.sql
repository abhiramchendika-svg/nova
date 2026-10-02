-- V13: GitHub in public (username-only) mode (docs/database.md §4 "Developer"). NOVA keeps a
-- normalised copy of what GitHub returned (profile fields, repositories, daily contribution counts)
-- with the ETags and fetch times needed to refresh politely. Nothing here is derived: NOVA's own
-- metrics are computed from these rows when read. OAuth (an encrypted token) comes later.

create table github_accounts (
    user_id                  uuid          primary key references users (id) on delete cascade,
    username                 varchar(39)   not null,          -- GitHub's maximum login length
    github_user_id           bigint,
    name                     varchar(255),
    avatar_url               varchar(2048),
    html_url                 varchar(2048),
    public_repos             integer,
    followers                integer,
    following                integer,
    github_created_at        timestamptz,
    profile_etag             varchar(200),
    profile_fetched_at       timestamptz,
    repos_etag               varchar(200),
    repos_fetched_at         timestamptz,
    contributions_total      integer,
    contributions_fetched_at timestamptz,
    backoff_until            timestamptz,                     -- GitHub's rate-limit reset; no calls before it
    refresh_requested_at     timestamptz,                     -- the manual refresh throttle
    created_at               timestamptz   not null default now(),
    updated_at               timestamptz   not null default now(),
    constraint ck_github_accounts_username check (username ~ '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$'),
    constraint ck_github_accounts_avatar_url check (avatar_url ~* '^https://'),
    constraint ck_github_accounts_html_url check (html_url ~* '^https://')
);

create table github_repos (
    id          uuid          primary key default gen_random_uuid(),
    user_id     uuid          not null references github_accounts (user_id) on delete cascade,
    name        varchar(100)  not null,
    full_name   varchar(200)  not null,
    html_url    varchar(2048) not null,
    description varchar(400),
    language    varchar(60),
    stars       integer       not null,
    forks       integer       not null,
    fork        boolean       not null,
    archived    boolean       not null,
    pushed_at   timestamptz,
    constraint uq_github_repos_user_name unique (user_id, full_name),
    constraint ck_github_repos_html_url check (html_url ~* '^https://'),
    constraint ck_github_repos_counts check (stars >= 0 and forks >= 0)
);

create table github_contribution_days (
    id      uuid    primary key default gen_random_uuid(),
    user_id uuid    not null references github_accounts (user_id) on delete cascade,
    day     date    not null,
    count   integer not null,
    constraint uq_github_days_user_day unique (user_id, day),
    constraint ck_github_days_count check (count >= 0)
);
