/**
 * Friends page: shows pending invites, given shares, received shares.
 * Handles invite creation (with the share-scope modal + book picker) and
 * surfaces "Copy link / Send via email / Send via text" for each invite.
 */
(() => {
    const els = {};

    function pickEls() {
        els.signOut = document.getElementById('signout-btn');
        els.inviteBtn = document.getElementById('invite-btn');
        els.invitesList = document.getElementById('invites-list');
        els.invitesEmpty = document.getElementById('invites-empty');
        els.givenList = document.getElementById('given-list');
        els.givenEmpty = document.getElementById('given-empty');
        els.receivedList = document.getElementById('received-list');
        els.receivedEmpty = document.getElementById('received-empty');
    }

    function inviteUrl(token) {
        return `${window.location.origin}/invite/${token}`;
    }

    function describeScope(item) {
        if (item.scope === 'all') return 'Everything';
        const n = (item.books || []).length;
        if (n === 0) return 'No books selected';
        if (n === 1) return `Book: ${item.books[0].name}`;
        return `${n} books`;
    }

    function ownerName(o) {
        return o?.display_name || 'A friend';
    }

    // ---------- INVITES ----------

    async function loadInvites() {
        try {
            const data = await window.api.get('/api/invites');
            renderInvites(data.items || []);
        } catch (err) {
            console.error(err);
        }
    }

    function renderInvites(items) {
        els.invitesList.innerHTML = '';
        els.invitesEmpty.hidden = items.length > 0;
        for (const item of items) {
            els.invitesList.appendChild(renderInviteRow(item));
        }
    }

    function renderInviteRow(item) {
        const card = document.createElement('div');
        card.className = 'friend-card';

        const head = document.createElement('div');
        head.className = 'friend-card-head';
        const name = document.createElement('div');
        name.className = 'friend-card-name';
        name.textContent = item.recipient_email || item.recipient_phone || 'Anyone with the link';
        const meta = document.createElement('div');
        meta.className = 'friend-card-meta';
        meta.textContent = describeScope(item);
        head.appendChild(name);
        head.appendChild(meta);
        card.appendChild(head);

        const url = inviteUrl(item.token);

        const linkRow = document.createElement('div');
        linkRow.className = 'friend-card-link';
        const linkInput = document.createElement('input');
        linkInput.type = 'text';
        linkInput.readOnly = true;
        linkInput.value = url;
        linkInput.className = 'sm-input';
        linkInput.addEventListener('focus', () => linkInput.select());
        linkRow.appendChild(linkInput);
        card.appendChild(linkRow);

        const actions = document.createElement('div');
        actions.className = 'friend-card-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-soft btn-sm';
        copyBtn.textContent = 'Copy link';
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(url);
                window.toast?.info('Link copied.');
            } catch {
                linkInput.select();
                document.execCommand?.('copy');
                window.toast?.info('Link copied.');
            }
        });
        actions.appendChild(copyBtn);

        const ownerName = window.Clerk?.user?.firstName || 'A friend';
        const subject = encodeURIComponent(`${ownerName} wants to share their privbook with you`);
        const bodyText = encodeURIComponent(
            `Hi! I'd like to share my privbook with you.\n\nFollow this link to accept: ${url}`
        );

        if (item.recipient_email || true) {
            const a = document.createElement('a');
            a.className = 'btn btn-soft btn-sm';
            const to = item.recipient_email ? encodeURIComponent(item.recipient_email) : '';
            a.href = `mailto:${to}?subject=${subject}&body=${bodyText}`;
            a.textContent = 'Send via email';
            actions.appendChild(a);
        }

        const a2 = document.createElement('a');
        a2.className = 'btn btn-soft btn-sm';
        const tel = item.recipient_phone ? item.recipient_phone : '';
        a2.href = `sms:${tel}?body=${bodyText}`;
        a2.textContent = 'Send via text';
        actions.appendChild(a2);

        const spacer = document.createElement('div'); spacer.style.flex = '1';
        actions.appendChild(spacer);

        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'btn btn-danger btn-sm';
        revoke.textContent = 'Revoke';
        revoke.addEventListener('click', async () => {
            if (!confirm('Revoke this invite? The link will stop working.')) return;
            try {
                await window.api.del(`/api/invites/${item.id}`);
                window.toast?.info('Invite revoked.');
                loadInvites();
            } catch (err) {
                window.toast?.error(err.message || 'Could not revoke.');
            }
        });
        actions.appendChild(revoke);

        card.appendChild(actions);
        return card;
    }

    function openInviteModal() {
        window.shareModal.open({
            title: 'Invite a friend',
            subtitle: 'Choose what they’ll be able to see, then share the link.',
            primaryLabel: 'Create link',
            allowAll: true,
            allowSpecific: true,
            showRecipient: true,
            scope: 'all',
            onConfirm: async (payload) => {
                const data = await window.api.post('/api/invites', payload);
                window.toast?.info('Invite ready — share the link.');
                await loadInvites();
            },
        });
    }

    // ---------- GIVEN SHARES ----------

    async function loadGiven() {
        try {
            const data = await window.api.get('/api/shares/given');
            renderGiven(data.items || []);
        } catch (err) {
            console.error(err);
        }
    }

    function renderGiven(items) {
        els.givenList.innerHTML = '';
        els.givenEmpty.hidden = items.length > 0;
        for (const s of items) {
            els.givenList.appendChild(renderGivenRow(s));
        }
    }

    function renderGivenRow(s) {
        const card = document.createElement('div');
        card.className = 'friend-card';

        const head = document.createElement('div');
        head.className = 'friend-card-head';
        const name = document.createElement('div');
        name.className = 'friend-card-name';
        name.textContent = ownerName(s.viewer);
        const meta = document.createElement('div');
        meta.className = 'friend-card-meta';
        meta.textContent = describeScope(s);
        head.appendChild(name);
        head.appendChild(meta);
        card.appendChild(head);

        if (s.scope === 'books' && s.books?.length) {
            const chips = document.createElement('div');
            chips.className = 'friend-card-chips';
            for (const b of s.books) {
                const c = document.createElement('span');
                c.className = 'post-book-chip';
                c.textContent = b.name;
                chips.appendChild(c);
            }
            card.appendChild(chips);
        }

        const actions = document.createElement('div');
        actions.className = 'friend-card-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn btn-soft btn-sm';
        edit.textContent = 'Edit access';
        edit.addEventListener('click', () => editShare(s));
        actions.appendChild(edit);

        const spacer = document.createElement('div'); spacer.style.flex = '1';
        actions.appendChild(spacer);

        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'btn btn-danger btn-sm';
        revoke.textContent = 'Revoke';
        revoke.addEventListener('click', async () => {
            if (!confirm(`Stop sharing with ${ownerName(s.viewer)}?`)) return;
            try {
                await window.api.del(`/api/shares/${s.id}`);
                window.toast?.info('Access revoked.');
                loadGiven();
            } catch (err) {
                window.toast?.error(err.message || 'Could not revoke.');
            }
        });
        actions.appendChild(revoke);

        card.appendChild(actions);
        return card;
    }

    function editShare(s) {
        window.shareModal.open({
            title: `Edit access for ${ownerName(s.viewer)}`,
            primaryLabel: 'Save',
            allowAll: true,
            allowSpecific: true,
            scope: s.scope,
            bookIds: (s.books || []).map((b) => b.id),
            onConfirm: async (payload) => {
                await window.api.patch(`/api/shares/${s.id}`, payload);
                window.toast?.info('Access updated.');
                await loadGiven();
            },
        });
    }

    // ---------- RECEIVED SHARES ----------

    async function loadReceived() {
        try {
            const data = await window.api.get('/api/shares/received');
            renderReceived(data.items || []);
        } catch (err) {
            console.error(err);
        }
    }

    function renderReceived(items) {
        els.receivedList.innerHTML = '';
        els.receivedEmpty.hidden = items.length > 0;
        for (const s of items) {
            els.receivedList.appendChild(renderReceivedRow(s));
        }
    }

    function renderReceivedRow(s) {
        const card = document.createElement('a');
        card.className = 'friend-card friend-card-clickable';
        card.href = `/friend/${s.owner.id}`;

        const head = document.createElement('div');
        head.className = 'friend-card-head';
        const name = document.createElement('div');
        name.className = 'friend-card-name';
        name.textContent = ownerName(s.owner);
        const meta = document.createElement('div');
        meta.className = 'friend-card-meta';
        meta.textContent = describeScope(s);
        head.appendChild(name);
        head.appendChild(meta);
        card.appendChild(head);

        if (s.scope === 'books' && s.books?.length) {
            const chips = document.createElement('div');
            chips.className = 'friend-card-chips';
            for (const b of s.books) {
                const c = document.createElement('span');
                c.className = 'post-book-chip';
                c.textContent = b.name;
                chips.appendChild(c);
            }
            card.appendChild(chips);
        }

        const open = document.createElement('div');
        open.className = 'friend-card-cta';
        open.textContent = 'Open →';
        card.appendChild(open);

        return card;
    }

    function start() {
        pickEls();
        els.signOut.addEventListener('click', async () => {
            await window.Clerk.signOut();
            window.location.href = '/';
        });
        els.inviteBtn.addEventListener('click', openInviteModal);

        loadInvites();
        loadGiven();
        loadReceived();
    }

    window.privbook.onAuthReady(start);
})();
