# privbook

A private, personal timeline. Just for you — no followers, no feed, no socializing.
Simple HTML/CSS frontend, Node.js + Express backend, Clerk auth, Postgres for data,
local-disk image storage. Designed to feel warm, grounded, and homey.

## Stack

- **Frontend** — vanilla HTML / CSS / JS (no build step)
- **Backend** — Node.js 20+, Express 4, ES modules
- **Auth** — Clerk (`@clerk/express`)
- **DB** — Postgres (shared `influxcode` database, `privbook_*` tables)
- **Images** — uploaded via multer, processed with sharp (rotated, resized, converted to webp), stored on local disk under `uploads/<user-id>/`

## Routes

### Pages (server-rendered HTML)
| Path        | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `/`         | Landing. Signed-in users auto-redirect to `/timeline`.                   |
| `/signin`   | Clerk-hosted sign-in component. Redirects to `/timeline` on success.     |
| `/timeline` | The user's private feed + composer. Auth-guarded.                        |

### API (auth required, JSON)
| Method | Path              | Description                                                                                  |
| ------ | ----------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/api/me`         | The current user's profile row.                                                              |
| PATCH  | `/api/me`         | Update `display_name`.                                                                       |
| GET    | `/api/posts`      | Cursor-paginated timeline. Query: `?cursor=<created_at>&limit=20`.                           |
| GET    | `/api/posts/:id`  | Single post.                                                                                 |
| POST   | `/api/posts`      | Create. `multipart/form-data` with `body`, `layout`, and 0–10 `images[]`.                    |
| PATCH  | `/api/posts/:id`  | Update body / layout.                                                                         |
| DELETE | `/api/posts/:id`  | Delete post + all images from disk.                                                           |

### Static
| Path        | Description                                  |
| ----------- | -------------------------------------------- |
| `/css/*`    | Stylesheets                                  |
| `/js/*`     | Client JS                                    |
| `/uploads/*`| Uploaded images (served with 7d cache)       |
| `/healthz`  | Liveness check                                |

## Local development

```bash
cd /Users/andrewjudd/influxcode/privbook
cp .env.example .env       # already populated with shared dev creds
npm install
npm run migrate            # only runs successfully against a reachable Postgres
npm run dev                # http://localhost:3030
```

> Note: this Mac doesn't run Postgres locally — the dev DB lives on the server (`influxcode`).
> For real local dev, either run a local Postgres + create an `influxcode` database, or use an SSH tunnel:
> `ssh -L 5432:localhost:5432 influxcode`

## Deployment to `privbook.influxcode.io`

The pattern matches other apps deployed under `/home/ubuntu/influxcode/<app>/` on the influxcode server.

### 1. Sync the directory to the server

```bash
rsync -avz --exclude node_modules --exclude .git --exclude uploads \
    /Users/andrewjudd/influxcode/privbook/ \
    influxcode:/home/ubuntu/influxcode/privbook/
```

### 2. On the server: install + migrate + start

```bash
ssh influxcode
cd /home/ubuntu/influxcode/privbook

# Production .env (do not commit). Same DB password as smsfluxapi.
# Set CLERK_AUTHORIZED_PARTIES to include the public URL.
cat > .env <<'EOF'
PORT=3030
NODE_ENV=production

DB_USER=influx
DB_HOST=localhost
DB_NAME=influxcode
DB_PASSWORD=...
DB_PORT=5432

CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JS_URL=https://liked-panther-46.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js
CLERK_AUTHORIZED_PARTIES=https://privbook.influxcode.io

PUBLIC_BASE_URL=https://privbook.influxcode.io
MAX_UPLOAD_MB=12
MAX_IMAGES_PER_POST=10
EOF

mkdir -p uploads
npm ci --omit=dev
npm run migrate
```

### 3. systemd service

Create `/etc/systemd/system/privbook.service`:

```ini
[Unit]
Description=privbook (private personal timeline)
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/influxcode/privbook
EnvironmentFile=/home/ubuntu/influxcode/privbook/.env
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now privbook
sudo systemctl status privbook
journalctl -u privbook -f
```

### 4. nginx vhost + TLS

Create `/etc/nginx/sites-available/privbook.influxcode.io`:

```nginx
server {
    listen 80;
    server_name privbook.influxcode.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name privbook.influxcode.io;

    # certbot --nginx will fill in ssl_certificate / ssl_certificate_key
    client_max_body_size 60M;     # multi-image uploads

    location /uploads/ {
        proxy_pass http://127.0.0.1:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 7d;
    }

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/privbook.influxcode.io /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d privbook.influxcode.io
```

### 5. DNS

Add an A record at the influxcode.io DNS provider:

```
privbook.influxcode.io   A   52.202.64.137
```

(Same public IP as `recipes.influxcode.io`.)

### 6. Clerk dashboard

In the Clerk dashboard for the `liked-panther-46` development instance:

1. Add `https://privbook.influxcode.io` to **Authorized origins**.
2. Set **After sign-in URL** and **After sign-up URL** to `/timeline`.
3. (Optional) Restrict to invitation-only so only you can sign up.

## Schema

Tables (created by `npm run migrate`):

- **`privbook_users`** — one row per Clerk user, provisioned lazily on first authenticated request.
- **`privbook_posts`** — `(user_id, body, layout, created_at)`. Indexed `(user_id, created_at desc)`.
- **`privbook_post_images`** — `(post_id, url, storage_key, width, height, position)`. Cascade-delete with the post.

## Backups

Images live under `uploads/`. Add to your existing backup job, e.g.:

```bash
0 3 * * *  rsync -a --delete /home/ubuntu/influxcode/privbook/uploads/ /backup/privbook/uploads/
```

The text data is in the shared `influxcode` Postgres DB and gets covered by your existing pg dumps.

## Notes

- All posts are scoped to the calling user's `user_id`. There is no public timeline, no sharing, no other-user lookup.
- The Clerk publishable key + JS URL are injected into HTML at request time, so no rebuild is required when keys rotate.
- Image uploads are processed in memory (sharp) and written as webp to keep disk usage modest. Originals are not retained.
- CSP allows `img-src https:` so `<img>` tags can reference future migrated/external image hosts. Tighten as needed.
