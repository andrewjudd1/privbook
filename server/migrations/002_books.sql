create table if not exists privbook_books (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references privbook_users(id) on delete cascade,
    name text not null,
    color text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists privbook_books_user_name_unique
    on privbook_books (user_id, lower(name));

create index if not exists privbook_books_user_idx
    on privbook_books (user_id);

create table if not exists privbook_post_books (
    post_id uuid not null references privbook_posts(id) on delete cascade,
    book_id uuid not null references privbook_books(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, book_id)
);

create index if not exists privbook_post_books_book_idx
    on privbook_post_books (book_id);
