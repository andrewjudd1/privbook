# Deploying privbook

The app runs on `influxcode` (52.202.64.137) at `/home/ubuntu/influxcode/privbook/`,
managed by `systemd` (`privbook.service`) behind nginx with a Let's Encrypt cert.
Public URL: <https://privbook.influxcode.io>.

## Standard deploy

```bash
# 1. Push your changes
git push origin main

# 2. Sync source to the server (excludes secrets and local-only data)
rsync -avz --exclude node_modules --exclude .git --exclude uploads --exclude .env \
  /Users/andrewjudd/influxcode/privbook/ \
  influxcode:/home/ubuntu/influxcode/privbook/

# 3. Restart only if you changed server/ or package.json (see matrix below)
ssh influxcode 'cd /home/ubuntu/influxcode/privbook && npm ci --omit=dev && sudo systemctl restart privbook'
```

## When to restart vs. not

| Changed                            | Action                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `public/css/`, `public/js/`, HTML  | rsync only. No restart. Hard-refresh to bypass the 1h browser cache.       |
| `server/` code                     | rsync + `sudo systemctl restart privbook`.                                 |
| `package.json` / `package-lock.json` | rsync + `npm ci --omit=dev` + restart.                                   |
| New file in `server/migrations/`   | rsync + `npm run migrate`. Restart only if server code also changed.       |
| `deploy/privbook.service`          | `sudo cp` to `/etc/systemd/system/`, then `daemon-reload` + restart.       |
| `deploy/privbook.influxcode.io.nginx` | `sudo cp` to `/etc/nginx/sites-available/`, then `sudo nginx -t && sudo systemctl reload nginx`. |

The static-file `maxAge: '1h'` is set in [server/app.js](server/app.js).

## One-file shortcut (CSS / single asset)

```bash
rsync -avz public/css/style.css influxcode:/home/ubuntu/influxcode/privbook/public/css/style.css
```

## Health checks

```bash
ssh influxcode 'sudo systemctl status privbook'      # is it running?
ssh influxcode 'sudo journalctl -u privbook -f'      # tail logs
curl https://privbook.influxcode.io/healthz          # 200 + {"ok":true} = alive
```

## .env

The server's `.env` is **separate** from your local one. Never rsync it (the
exclude list above protects you). To edit it:

```bash
ssh influxcode 'sudo -u ubuntu nano /home/ubuntu/influxcode/privbook/.env'
sudo systemctl restart privbook   # required after any .env change
```

Required keys are documented in [.env.example](.env.example).

## TLS renewal

Certbot installed an auto-renew systemd timer when we ran `certbot --nginx`.
Verify with:

```bash
ssh influxcode 'sudo systemctl list-timers | grep certbot'
ssh influxcode 'sudo certbot certificates'           # shows expiry
```

## First-time bootstrap (already done; for reference)

1. `mkdir -p /home/ubuntu/influxcode/privbook && mkdir -p .../uploads`
2. Write `.env` with `NODE_ENV=production` and prod URLs.
3. `npm ci --omit=dev && npm run migrate`
4. Install systemd unit from `deploy/privbook.service`, `daemon-reload`, `enable --now`.
5. Install http-only nginx vhost, `nginx -t`, reload.
6. `sudo certbot --nginx -d privbook.influxcode.io --redirect` — adds 443 + redirect.
