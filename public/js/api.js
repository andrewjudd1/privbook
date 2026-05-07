/**
 * Authenticated API client. Attaches Clerk session token to every request.
 */
window.api = (() => {
    const API_BASE = window.__ENV__?.API_BASE || '';

    async function token({ skipCache = false } = {}) {
        if (!window.Clerk?.session) throw new Error('Not authenticated');
        return window.Clerk.session.getToken(skipCache ? { skipCache: true } : undefined);
    }

    async function request(method, path, { body, params, isFormData } = {}) {
        let url = API_BASE + path;

        if (params) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') qs.append(k, v);
            }
            const s = qs.toString();
            if (s) url += '?' + s;
        }

        const send = async (skipCache) => {
            const t = await token({ skipCache });
            const headers = { Authorization: 'Bearer ' + t };
            const opts = { method, headers };
            if (body && !isFormData) {
                headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            } else if (body && isFormData) {
                opts.body = body;
            }
            return fetch(url, opts);
        };

        let res = await send(false);
        // Right after sign-in, Clerk's cached token can briefly be stale —
        // refresh once before surfacing the error.
        if (res.status === 401 && window.Clerk?.session) {
            res = await send(true);
        }

        const ct = res.headers.get('content-type') || '';
        let data = null;
        if (ct.includes('application/json')) {
            data = await res.json().catch(() => null);
        }
        if (!res.ok) {
            const msg = data?.error || data?.message || `Request failed (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    return {
        get: (path, params) => request('GET', path, { params }),
        post: (path, body) => request('POST', path, { body }),
        put: (path, body) => request('PUT', path, { body }),
        patch: (path, body) => request('PATCH', path, { body }),
        del: (path) => request('DELETE', path),
        upload: (path, formData) => request('POST', path, { body: formData, isFormData: true }),
    };
})();
