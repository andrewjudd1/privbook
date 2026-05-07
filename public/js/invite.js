/**
 * Invite acceptance page.
 *  - Reads the token from /invite/<token>.
 *  - If not signed in, auth-guard sends to /signin?redirect_url=/invite/<token>.
 *  - Shows a preview of what is being shared.
 *  - On accept → POST /api/invites/by-token/<token>/accept,
 *    then prompts the user to share something back.
 */
(() => {
    const card = () => document.getElementById('invite-card');

    function tokenFromPath() {
        const m = window.location.pathname.match(/^\/invite\/([^\/?#]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function ownerName(o) { return o?.display_name || 'A friend'; }

    function setLoading(text) {
        card().innerHTML = `<div class="invite-loading">${text}</div>`;
    }

    function setError(text) {
        card().innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'invite-error';
        const h = document.createElement('h2'); h.textContent = 'This invite isn’t available.';
        const p = document.createElement('p'); p.textContent = text;
        const a = document.createElement('a');
        a.href = '/timeline';
        a.className = 'btn btn-soft btn-sm';
        a.textContent = 'Go to your timeline';
        wrap.appendChild(h); wrap.appendChild(p); wrap.appendChild(a);
        card().appendChild(wrap);
    }

    async function loadInvite(token) {
        try {
            const data = await window.api.get(`/api/invites/by-token/${encodeURIComponent(token)}`);
            renderPreview(token, data.invite, data.isOwner);
        } catch (err) {
            setError(err.message || 'Try asking your friend to send a fresh link.');
        }
    }

    function renderPreview(token, invite, isOwner) {
        const c = card();
        c.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'invite-preview';

        const h = document.createElement('h2');
        h.className = 'invite-title';
        h.textContent = `${ownerName(invite.owner)} wants to share with you`;
        wrap.appendChild(h);

        const sub = document.createElement('p');
        sub.className = 'invite-sub';
        if (invite.scope === 'all') {
            sub.textContent = 'They’re giving you access to their full timeline and every book.';
        } else {
            const n = invite.books?.length || 0;
            sub.textContent = n === 1
                ? `They’re sharing one book with you.`
                : `They’re sharing ${n} books with you.`;
        }
        wrap.appendChild(sub);

        if (invite.scope === 'books' && invite.books?.length) {
            const chips = document.createElement('div');
            chips.className = 'friend-card-chips';
            for (const b of invite.books) {
                const c2 = document.createElement('span');
                c2.className = 'post-book-chip';
                c2.textContent = b.name;
                chips.appendChild(c2);
            }
            wrap.appendChild(chips);
        }

        if (invite.note) {
            const note = document.createElement('blockquote');
            note.className = 'invite-note';
            note.textContent = invite.note;
            wrap.appendChild(note);
        }

        const actions = document.createElement('div');
        actions.className = 'invite-actions';

        if (isOwner) {
            const msg = document.createElement('p');
            msg.className = 'invite-sub';
            msg.textContent = 'This is your own invite link — share it with someone else.';
            wrap.appendChild(msg);
            const back = document.createElement('a');
            back.href = '/friends';
            back.className = 'btn btn-soft btn-sm';
            back.textContent = 'Back to friends';
            actions.appendChild(back);
        } else {
            const accept = document.createElement('button');
            accept.type = 'button';
            accept.className = 'btn btn-primary';
            accept.textContent = 'Accept';
            accept.addEventListener('click', () => acceptInvite(token, invite));
            const later = document.createElement('a');
            later.href = '/timeline';
            later.className = 'btn btn-ghost btn-sm';
            later.textContent = 'Maybe later';
            actions.appendChild(accept);
            actions.appendChild(later);
        }
        wrap.appendChild(actions);

        c.appendChild(wrap);
    }

    async function acceptInvite(token, invite) {
        setLoading('Accepting…');
        try {
            const data = await window.api.post(`/api/invites/by-token/${encodeURIComponent(token)}/accept`, {});
            const share = data.share;
            renderShareBack(share, invite);
        } catch (err) {
            setError(err.message || 'Could not accept this invite.');
        }
    }

    function renderShareBack(share, invite) {
        const c = card();
        c.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'invite-preview';

        const h = document.createElement('h2');
        h.className = 'invite-title';
        h.textContent = 'You’re connected.';
        wrap.appendChild(h);

        const sub = document.createElement('p');
        sub.className = 'invite-sub';
        sub.textContent = `Want to share something back with ${ownerName(invite.owner)}?`;
        wrap.appendChild(sub);

        const actions = document.createElement('div');
        actions.className = 'invite-actions invite-actions-stack';

        const everything = document.createElement('button');
        everything.type = 'button';
        everything.className = 'btn btn-primary';
        everything.textContent = 'Share everything';
        everything.addEventListener('click', () => createReverseShare(share, { scope: 'all' }));
        actions.appendChild(everything);

        const pickBooks = document.createElement('button');
        pickBooks.type = 'button';
        pickBooks.className = 'btn btn-soft';
        pickBooks.textContent = 'Pick specific books';
        pickBooks.addEventListener('click', () => {
            window.bookPicker.open({
                selectedIds: [],
                onConfirm: async (ids) => {
                    if (ids.length === 0) {
                        window.toast?.info('Nothing selected — leaving things as-is.');
                        return;
                    }
                    await createReverseShare(share, { scope: 'books', book_ids: ids });
                },
            });
        });
        actions.appendChild(pickBooks);

        const skip = document.createElement('a');
        skip.className = 'btn btn-ghost btn-sm';
        skip.href = `/friend/${share.owner.id}`;
        skip.textContent = 'Don’t share — view their timeline';
        actions.appendChild(skip);

        wrap.appendChild(actions);
        c.appendChild(wrap);
    }

    async function createReverseShare(share, payload) {
        try {
            await window.api.post('/api/shares', {
                viewer_user_id: share.owner_user_id || share.owner.id,
                ...payload,
            });
            window.toast?.info('Sharing started.');
            window.location.href = `/friend/${share.owner.id}`;
        } catch (err) {
            window.toast?.error(err.message || 'Could not start sharing.');
        }
    }

    function start() {
        const token = tokenFromPath();
        if (!token) {
            setError('That invite link looks malformed.');
            return;
        }
        loadInvite(token);
    }

    window.privbook.onAuthReady(start);
})();
