/**
 * Horizontal pill row of "books" above the timeline.
 *  - "All" pill clears the filter.
 *  - Each book pill filters the timeline to that book.
 *  - "+ New" creates a book inline.
 *  - Hover a book pill to reveal a small "×" that deletes it (with confirm).
 *
 * Events emitted:
 *  - "book-filter-changed" with detail.bookId (string | null)
 *  - "books-changed" — fired when a book is created/deleted
 *
 * Events listened to:
 *  - "books-changed" — re-fetches the list
 */
window.booksStrip = (() => {
    const state = {
        books: [],
        activeId: null,
        creating: false,
    };
    const els = {};

    function init(rootEl) {
        els.root = rootEl;
        render();
        window.addEventListener('books-changed', loadBooks);
        loadBooks();
    }

    async function loadBooks() {
        try {
            const data = await window.api.get('/api/books');
            state.books = data.items || [];
            // If the active filter no longer exists, drop it.
            if (state.activeId && !state.books.find((b) => b.id === state.activeId)) {
                state.activeId = null;
                emitFilter();
            }
            render();
        } catch (err) {
            console.error(err);
        }
    }

    function emitFilter() {
        window.dispatchEvent(
            new CustomEvent('book-filter-changed', { detail: { bookId: state.activeId } })
        );
    }

    function setActive(id) {
        state.activeId = id;
        emitFilter();
        render();
    }

    function makePill({ label, active, onClick, dataId, deletable }) {
        const wrap = document.createElement('span');
        wrap.className = 'book-pill-wrap';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'book-pill';
        if (active) btn.classList.add('is-active');
        btn.textContent = label;
        if (dataId) btn.dataset.id = dataId;
        btn.addEventListener('click', onClick);
        wrap.appendChild(btn);

        if (deletable) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'book-pill-del';
            del.title = 'Delete book';
            del.setAttribute('aria-label', 'Delete book');
            del.textContent = '×';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBook(dataId, label);
            });
            wrap.appendChild(del);
        }
        return wrap;
    }

    async function deleteBook(id, name) {
        if (!confirm(`Delete the book "${name}"? Posts in it will not be deleted.`)) return;
        try {
            await window.api.del(`/api/books/${id}`);
            window.toast?.info('Book removed.');
            window.dispatchEvent(new CustomEvent('books-changed'));
        } catch (err) {
            window.toast?.error(err.message || 'Could not delete book.');
        }
    }

    function showCreateInput() {
        state.creating = true;
        render();
        const input = els.root.querySelector('.book-pill-input');
        input?.focus();
    }

    async function commitCreate(name) {
        const trimmed = name.trim();
        state.creating = false;
        if (!trimmed) { render(); return; }
        try {
            const data = await window.api.post('/api/books', { name: trimmed });
            window.toast?.info('Book created.');
            window.dispatchEvent(new CustomEvent('books-changed'));
            // After books-changed re-fetch lands, books will include the new one;
            // optimistically include it now too in case order matters.
            state.books = [...state.books, data.book].sort(
                (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );
            render();
        } catch (err) {
            window.toast?.error(err.message || 'Could not create book.');
            render();
        }
    }

    function render() {
        const r = els.root;
        r.innerHTML = '';
        const row = document.createElement('div');
        row.className = 'books-strip-row';

        row.appendChild(
            makePill({
                label: 'All',
                active: state.activeId === null,
                onClick: () => setActive(null),
            })
        );

        for (const b of state.books) {
            const label = b.post_count != null && b.post_count > 0
                ? `${b.name} · ${b.post_count}`
                : b.name;
            row.appendChild(
                makePill({
                    label,
                    active: state.activeId === b.id,
                    onClick: () => setActive(b.id),
                    dataId: b.id,
                    deletable: true,
                })
            );
        }

        if (state.creating) {
            const form = document.createElement('form');
            form.className = 'book-pill-form';
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 80;
            input.placeholder = 'Book name';
            input.className = 'book-pill-input';
            form.appendChild(input);
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                commitCreate(input.value);
            });
            input.addEventListener('blur', () => {
                // small delay to let submit fire if user pressed Enter
                setTimeout(() => {
                    if (state.creating) {
                        state.creating = false;
                        render();
                    }
                }, 120);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    state.creating = false;
                    render();
                }
            });
            row.appendChild(form);
        } else {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'book-pill book-pill-add';
            add.textContent = '+ New book';
            add.addEventListener('click', showCreateInput);
            row.appendChild(add);
        }

        r.appendChild(row);
    }

    return { init, get activeId() { return state.activeId; } };
})();
