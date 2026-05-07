/**
 * Reusable share-scope modal used by:
 *  - the "Invite a friend" flow on /friends
 *  - the "Share back" prompt after accepting an invite
 *  - editing an existing share's scope on /friends
 *
 *   window.shareModal.open({
 *     title,                 // string
 *     subtitle,              // optional string
 *     primaryLabel,          // text on the primary button (default: 'Save')
 *     allowAll: true,        // whether 'all' is offered
 *     allowSpecific: true,   // whether 'specific books' is offered
 *     allowNone: false,      // include a "Don't share" button
 *     scope: 'all'|'books',  // initial selection (default 'all')
 *     bookIds: [],           // initial selected books
 *     showRecipient: false,  // show email/phone fields
 *     onConfirm: ({ scope, book_ids, recipient_email, recipient_phone }) => Promise|void
 *     onNone: () => void     // called when "Don't share" is pressed
 *   })
 *
 * Returns nothing; resolves via callbacks.
 */
window.shareModal = (() => {
    function open(opts = {}) {
        const o = {
            title: 'Share',
            subtitle: '',
            primaryLabel: 'Save',
            allowAll: true,
            allowSpecific: true,
            allowNone: false,
            scope: opts.scope || 'all',
            bookIds: Array.isArray(opts.bookIds) ? opts.bookIds.slice() : [],
            showRecipient: false,
            onConfirm: () => {},
            onNone: () => {},
            ...opts,
        };

        const overlay = document.createElement('div');
        overlay.className = 'dp-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const card = document.createElement('div');
        card.className = 'dp-card sm-card';
        overlay.appendChild(card);

        const head = document.createElement('div');
        head.className = 'sm-head';
        const title = document.createElement('div');
        title.className = 'sm-title';
        title.textContent = o.title;
        head.appendChild(title);
        if (o.subtitle) {
            const sub = document.createElement('div');
            sub.className = 'sm-sub';
            sub.textContent = o.subtitle;
            head.appendChild(sub);
        }
        card.appendChild(head);

        const body = document.createElement('div');
        body.className = 'sm-body';
        card.appendChild(body);

        // Scope radios
        const scopeRow = document.createElement('div');
        scopeRow.className = 'sm-scopes';

        function makeRadio(value, label, hint) {
            const lbl = document.createElement('label');
            lbl.className = 'sm-radio';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'sm-scope';
            input.value = value;
            if (o.scope === value) input.checked = true;
            input.addEventListener('change', () => {
                o.scope = value;
                refreshPickRow();
            });
            const txtWrap = document.createElement('div');
            const t = document.createElement('div');
            t.className = 'sm-radio-label';
            t.textContent = label;
            txtWrap.appendChild(t);
            if (hint) {
                const h = document.createElement('div');
                h.className = 'sm-radio-hint';
                h.textContent = hint;
                txtWrap.appendChild(h);
            }
            lbl.appendChild(input);
            lbl.appendChild(txtWrap);
            return lbl;
        }

        if (o.allowAll) scopeRow.appendChild(makeRadio('all', 'Everything', 'Timeline + every book'));
        if (o.allowSpecific) scopeRow.appendChild(makeRadio('books', 'Specific books', 'Pick which books to share'));
        body.appendChild(scopeRow);

        // Pick books row
        const pickRow = document.createElement('div');
        pickRow.className = 'sm-pick';

        const pickBtn = document.createElement('button');
        pickBtn.type = 'button';
        pickBtn.className = 'btn btn-soft btn-sm';
        pickBtn.addEventListener('click', () => {
            window.bookPicker.open({
                selectedIds: o.bookIds.slice(),
                onConfirm: (ids) => {
                    o.bookIds = ids;
                    refreshPickRow();
                },
            });
        });
        pickRow.appendChild(pickBtn);
        body.appendChild(pickRow);

        function refreshPickRow() {
            pickRow.style.display = o.scope === 'books' ? 'flex' : 'none';
            const n = o.bookIds.length;
            pickBtn.textContent = n === 0
                ? 'Pick books…'
                : n === 1 ? '1 book selected — change' : `${n} books selected — change`;
        }
        refreshPickRow();

        // Optional recipient fields
        let emailInput = null;
        let phoneInput = null;
        if (o.showRecipient) {
            const recip = document.createElement('div');
            recip.className = 'sm-recip';
            const explain = document.createElement('div');
            explain.className = 'sm-recip-hint';
            explain.textContent = 'Optional — used to prefill the email or text.';
            recip.appendChild(explain);

            emailInput = document.createElement('input');
            emailInput.type = 'email';
            emailInput.placeholder = 'their@email.com';
            emailInput.className = 'sm-input';
            emailInput.value = opts.recipientEmail || '';
            recip.appendChild(emailInput);

            phoneInput = document.createElement('input');
            phoneInput.type = 'tel';
            phoneInput.placeholder = '+1 555 555 5555';
            phoneInput.className = 'sm-input';
            phoneInput.value = opts.recipientPhone || '';
            recip.appendChild(phoneInput);

            body.appendChild(recip);
        }

        // Footer
        const footer = document.createElement('div');
        footer.className = 'dp-footer';
        const noneBtn = document.createElement('button');
        noneBtn.type = 'button';
        noneBtn.className = 'dp-link';
        noneBtn.textContent = 'Don’t share';
        if (!o.allowNone) noneBtn.style.display = 'none';

        const spacer = document.createElement('div'); spacer.style.flex = '1';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-ghost btn-sm';
        cancelBtn.textContent = 'Cancel';

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn btn-primary btn-sm';
        okBtn.textContent = o.primaryLabel;

        footer.appendChild(noneBtn);
        footer.appendChild(spacer);
        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);
        card.appendChild(footer);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('open'));

        function close() {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 160);
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        noneBtn.addEventListener('click', async () => {
            try { await o.onNone(); } catch (err) { console.error(err); }
            close();
        });
        okBtn.addEventListener('click', async () => {
            if (o.scope === 'books' && o.bookIds.length === 0) {
                window.toast?.error('Pick at least one book.');
                return;
            }
            const payload = { scope: o.scope, book_ids: o.scope === 'books' ? o.bookIds : [] };
            if (emailInput) payload.recipient_email = emailInput.value.trim();
            if (phoneInput) payload.recipient_phone = phoneInput.value.trim();
            okBtn.disabled = true;
            try {
                await o.onConfirm(payload);
                close();
            } catch (err) {
                window.toast?.error(err.message || 'Something went wrong.');
                okBtn.disabled = false;
            }
        });
    }

    return { open };
})();
