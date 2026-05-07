/**
 * privbook auth guard.
 *  - On signin/signup pages: if signed in, send to redirect_url (or /timeline).
 *  - On any auth-required page (/timeline, /friends, /invite/*, /friend/*):
 *    if not signed in, redirect to /signin?redirect_url=<original>.
 *  - On /: if signed in, send to /timeline.
 *  - Dispatches `auth-ready` once Clerk has loaded and the user is signed in.
 *  - Once signed in, sync the Clerk display name to privbook_users.display_name
 *    if it's empty (so friends see your name).
 */
(() => {
    const path = window.location.pathname;
    const isAuthPage = path === '/signin' || path === '/signup';
    const isLanding = path === '/' || path === '/index.html';
    const isInvite = path.startsWith('/invite/');
    const isFriend = path.startsWith('/friend/');
    const isFriends = path === '/friends';
    const isTimeline = path === '/timeline';
    const isAuthRequired = isTimeline || isFriends || isInvite || isFriend;

    function safeRedirect(raw) {
        if (typeof raw !== 'string') return '/timeline';
        if (!raw.startsWith('/') || raw.startsWith('//')) return '/timeline';
        return raw;
    }

    function waitForClerk(maxWait = 10000) {
        return new Promise((resolve) => {
            if (window.Clerk) return resolve();
            const start = Date.now();
            const id = setInterval(() => {
                if (window.Clerk || Date.now() - start > maxWait) {
                    clearInterval(id);
                    resolve();
                }
            }, 80);
        });
    }

    async function syncDisplayName() {
        try {
            if (!window.Clerk?.session) return;
            const token = await window.Clerk.session.getToken();
            const meRes = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
            if (!meRes.ok) return;
            const me = await meRes.json();
            if (me.user?.display_name) return;
            const u = window.Clerk.user;
            const name = u?.firstName || u?.username || u?.primaryEmailAddress?.emailAddress;
            if (!name) return;
            await fetch('/api/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ display_name: name }),
            });
        } catch { /* best-effort */ }
    }

    async function guard() {
        await waitForClerk();
        if (!window.Clerk) {
            if (isAuthRequired) goSignIn();
            return;
        }
        try {
            await window.Clerk.load();
        } catch (err) {
            console.error('Clerk failed to load', err);
            if (isAuthRequired) goSignIn();
            return;
        }

        const signedIn = !!window.Clerk.session;

        if (isAuthPage && signedIn) {
            const params = new URLSearchParams(window.location.search);
            window.location.href = safeRedirect(params.get('redirect_url'));
            return;
        }
        if (isLanding && signedIn) {
            window.location.href = '/timeline';
            return;
        }
        if (isAuthRequired && !signedIn) {
            goSignIn();
            return;
        }

        if (isAuthRequired && signedIn) {
            syncDisplayName();
            window.dispatchEvent(new CustomEvent('auth-ready'));
        }
    }

    function goSignIn() {
        const target = encodeURIComponent(path + window.location.search);
        window.location.href = `/signin?redirect_url=${target}`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', guard);
    } else {
        guard();
    }
})();
