create table if not exists privbook_share_invites (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references privbook_users(id) on delete cascade,
    token text not null unique,
    scope text not null check (scope in ('all', 'books')),
    recipient_email text,
    recipient_phone text,
    note text,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    accepted_at timestamptz,
    accepted_by_user_id uuid references privbook_users(id) on delete set null,
    revoked_at timestamptz
);

create index if not exists privbook_share_invites_owner_idx
    on privbook_share_invites (owner_user_id);

create table if not exists privbook_share_invite_books (
    invite_id uuid not null references privbook_share_invites(id) on delete cascade,
    book_id uuid not null references privbook_books(id) on delete cascade,
    primary key (invite_id, book_id)
);

create table if not exists privbook_shares (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references privbook_users(id) on delete cascade,
    viewer_user_id uuid not null references privbook_users(id) on delete cascade,
    scope text not null check (scope in ('all', 'books')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint privbook_shares_unique unique (owner_user_id, viewer_user_id),
    constraint privbook_shares_no_self check (owner_user_id <> viewer_user_id)
);

create index if not exists privbook_shares_owner_idx
    on privbook_shares (owner_user_id);
create index if not exists privbook_shares_viewer_idx
    on privbook_shares (viewer_user_id);

create table if not exists privbook_share_books (
    share_id uuid not null references privbook_shares(id) on delete cascade,
    book_id uuid not null references privbook_books(id) on delete cascade,
    primary key (share_id, book_id)
);
