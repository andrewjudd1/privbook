create extension if not exists "pgcrypto";

create table if not exists privbook_users (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text unique not null,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists privbook_posts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references privbook_users(id) on delete cascade,
    body text not null default '',
    layout text not null default 'auto',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists privbook_posts_user_created_idx
    on privbook_posts (user_id, created_at desc);

create table if not exists privbook_post_images (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references privbook_posts(id) on delete cascade,
    url text not null,
    storage_key text not null,
    width int,
    height int,
    position int not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists privbook_post_images_post_idx
    on privbook_post_images (post_id, position);
