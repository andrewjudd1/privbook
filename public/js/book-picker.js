/**
 * A small popover for picking which books a post belongs to.
 *
 *   window.bookPicker.open({ selectedIds, onConfirm })
 *
 * - selectedIds: string[] (book ids that should start checked)
 * - onConfirm: (ids: string[]) => void  called when the user closes the picker
 *
 * Loads all of the user's books from /api/books, lets the user toggle them,
 * and lets the user add new books inline. New books are created immediately
 * (and a "books-changed" event is dispatched so the books strip refreshes).
 */
window.bookPicker = (() => {
    function open({ selectedIds = [], onConfirm } = {}) {
        const selected = new Set(selectedIds);
        let books = [];

        const overlay = document.createElement('div');
        overlay.className = 'dp-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Add to a book');

        const card = document.createElement('div');
        card.className = 'dp-card bp-card';
        overlay.appendChild(card);

        const head = document.createElement('div');
        head.className = 'bp-head';
        const title = document.createElement('div');
        title.className = 'bp-title';
        title.textContent = 'Add to books';
        head.appendChild(title);
        card.appendChild(head);

        const list = document.createElement('div');
        list.className = 'bp-list';
        card.appendChild(list);

        const newRow = document.createElement('form');
        newRow.className = 'bp-new';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'New book…';
        input.maxLength = 80;
        input.className = 'bp-input';
        const addBtn = document.createElement('button');
        addBtn.type = 'submit';
        addBtn.className = 'btn btn-soft btn-sm';
        addBtn.textContent = 'Add';
        newRow.appendChild(input);
        newRow.appendChild(addBtn);
        card.appendChild(newRow);

        const footer = document.createElement('div');
        footer.className = 'dp-footer';
        const spacer = document.createElement('div'); spacer.style.flex = '1';
        const doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'btn btn-primary btn-sm';
        doneBtn.textContent = 'Done';
        footer.appendChild(spacer);
        footer.appendChild(doneBtn);
        card.appendChild(footer);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('open'));

        function renderList() {
            list.innerHTML = '';
            if (books.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'bp-empty';
                empty.textContent = 'No books yet — add one below.';
                list.appendChild(empty);
                return;
            }
            for (const b of books) {
                const row = document.createElement('label');
                row.className = 'bp-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = selected.has(b.id);
                cb.addEventListener('change', () => {
                    if (cb.checked) selected.add(b.id);
                    else selected.delete(b.id);
                    row.classList.toggle('is-selected', cb.checked);
                });
                row.classList.toggle('is-selected', cb.checked);
                const name = document.createElement('span');
                name.className = 'bp-row-name';
                name.textContent = b.name;
                const count = document.createElement('span');
                count.className = 'bp-row-count';
                count.textContent = b.post_count != null ? String(b.post_count) : '';
                row.appendChild(cb);
                row.appendChild(name);
                row.appendChild(count);
                list.appendChild(row);
            }
        }

        async function loadBooks() {
            try {
                const data = await window.api.get('/api/books');
                books = data.items || [];
                renderList();
            } catch (err) {
                window.toast?.error(err.message || 'Could not load books.');
            }
        }

        async function createBook(name) {
            try {
                const data = await window.api.post('/api/books', { name });
                const created = data.book;
                books.push(created);
                books.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                selected.add(created.id);
                renderList();
                window.dispatchEvent(new CustomEvent('books-changed'));
            } catch (err) {
                window.toast?.error(err.message || 'Could not create book.');
            }
        }

        newRow.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (!name) return;
            input.value = '';
            createBook(name);
        });

        function close() {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 160);
            document.removeEventListener('keydown', onKey);
            try { onConfirm?.(Array.from(selected)); } catch (err) { console.error(err); }
        }
        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', onKey);
        doneBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        loadBooks();
        // focus the input so users can type immediately if they want
        setTimeout(() => input.focus(), 60);
    }

    return { open };
})();
