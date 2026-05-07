/**
 * Mounts the Clerk hosted SignIn component into #clerk-mount.
 * After successful sign in, Clerk reloads and auth-guard.js redirects to /timeline.
 */
(() => {
    function waitForClerk() {
        return new Promise((resolve) => {
            if (window.Clerk) return resolve();
            const id = setInterval(() => {
                if (window.Clerk) { clearInterval(id); resolve(); }
            }, 80);
        });
    }

    function safeRedirect(raw) {
        if (typeof raw !== 'string') return '/timeline';
        if (!raw.startsWith('/') || raw.startsWith('//')) return '/timeline';
        return raw;
    }

    async function mount() {
        await waitForClerk();
        await window.Clerk.load();

        const params = new URLSearchParams(window.location.search);
        const redirect = safeRedirect(params.get('redirect_url'));

        if (window.Clerk.session) {
            window.location.href = redirect;
            return;
        }

        const el = document.getElementById('clerk-mount');
        if (!el) return;
        window.Clerk.mountSignIn(el, {
            redirectUrl: redirect,
            afterSignInUrl: redirect,
            afterSignUpUrl: redirect,
            appearance: {
                variables: {
                    colorPrimary: '#a86b4f',
                    colorBackground: '#fbf6ec',
                    colorText: '#2f2a23',
                    colorTextSecondary: '#877863',
                    colorInputBackground: '#f4ede1',
                    colorInputText: '#2f2a23',
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    borderRadius: '12px',
                },
                elements: {
                    card: {
                        boxShadow: 'none',
                        backgroundColor: 'transparent',
                    },
                    headerTitle: { display: 'none' },
                    headerSubtitle: { display: 'none' },
                },
            },
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
