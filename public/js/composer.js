/**
 * Composer state — selected images, text body, and the upload submit flow.
 * The selected files live only in memory until "Post" is pressed.
 */
window.composer = (() => {
    const MAX_IMAGES = 10;

    const state = {
        files: [], // [{ file, previewUrl, id }]
        createdAt: null, // Date | null  (null = "now" at submit time)
        bookIds: [], // string[]
        booksByName: {}, // id -> name
    };

    let els = null;

    function getEls() {
        if (els) return els;
        els = {
            body: document.getElementById('post-body'),
            photos: document.getElementById('composer-photos'),
            input: document.getElementById('photo-input'),
            addBtn: document.getElementById('add-photos-btn'),
            postBtn: document.getElementById('post-btn'),
            status: document.getElementById('composer-status'),
            layout: document.getElementById('layout-select'),
            dateBtn: document.getElementById('composer-date-btn'),
            dateLabel: document.getElementById('composer-date-label'),
            dateClear: document.getElementById('composer-date-clear'),
            booksBtn: document.getElementById('composer-books-btn'),
            booksLabel: document.getElementById('composer-books-label'),
        };
        return els;
    }

    function formatDateLabel(d) {
        const now = new Date();
        const sameYear = d.getFullYear() === now.getFullYear();
        const opts = sameYear
            ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
        return d.toLocaleString(undefined, opts);
    }

    function refreshDate() {
        const e = getEls();
        if (state.createdAt) {
            e.dateLabel.textContent = formatDateLabel(state.createdAt);
            e.dateBtn.classList.add('is-set');
            e.dateClear.hidden = false;
        } else {
            e.dateLabel.textContent = 'Now';
            e.dateBtn.classList.remove('is-set');
            e.dateClear.hidden = true;
        }
    }

    function refreshBooks() {
        const e = getEls();
        const n = state.bookIds.length;
        if (n === 0) {
            e.booksLabel.textContent = 'Books';
            e.booksBtn.classList.remove('is-set');
            return;
        }
        e.booksBtn.classList.add('is-set');
        if (n === 1) {
            const name = state.booksByName[state.bookIds[0]] || '1 book';
            e.booksLabel.textContent = name;
        } else {
            e.booksLabel.textContent = `${n} books`;
        }
    }

    function refresh() {
        const e = getEls();
        const hasText = e.body.value.trim().length > 0;
        const hasFiles = state.files.length > 0;
        e.postBtn.disabled = !(hasText || hasFiles);

        if (state.files.length === 0) {
            e.photos.hidden = true;
            e.photos.innerHTML = '';
            return;
        }

        e.photos.hidden = false;
        e.photos.innerHTML = '';
        state.files.forEach((f, i) => {
            const cell = document.createElement('div');
            cell.className = 'composer-photo';
            const img = document.createElement('img');
            img.src = f.previewUrl;
            img.alt = '';
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'remove';
            rm.setAttribute('aria-label', 'Remove photo');
            rm.textContent = '×';
            rm.addEventListener('click', () => removeAt(i));
            cell.appendChild(img);
            cell.appendChild(rm);
            e.photos.appendChild(cell);
        });
    }

    function addFiles(fileList) {
        const e = getEls();
        const remaining = MAX_IMAGES - state.files.length;
        const arr = Array.from(fileList).slice(0, remaining);
        for (const f of arr) {
            if (!f.type.startsWith('image/')) continue;
            const previewUrl = URL.createObjectURL(f);
            state.files.push({
                file: f,
                previewUrl,
                id: Math.random().toString(36).slice(2),
            });
        }
        if (fileList.length > remaining) {
            window.toast?.error(`Only ${MAX_IMAGES} photos per post.`);
        }
        refresh();
    }

    function removeAt(idx) {
        const removed = state.files.splice(idx, 1)[0];
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        refresh();
    }

    function reset() {
        const e = getEls();
        for (const f of state.files) URL.revokeObjectURL(f.previewUrl);
        state.files = [];
        state.createdAt = null;
        state.bookIds = [];
        state.booksByName = {};
        e.body.value = '';
        e.layout.value = 'auto';
        e.status.textContent = '';
        refresh();
        refreshDate();
        refreshBooks();
    }

    async function submit() {
        const e = getEls();
        const body = e.body.value.trim();
        if (!body && state.files.length === 0) return;

        e.postBtn.disabled = true;
        e.status.textContent = 'sharing your moment…';

        try {
            const fd = new FormData();
            fd.append('body', body);
            fd.append('layout', e.layout.value || 'auto');
            if (state.createdAt) fd.append('created_at', state.createdAt.toISOString());
            for (const id of state.bookIds) fd.append('book_ids', id);
            for (const f of state.files) fd.append('images', f.file);

            const data = await window.api.upload('/api/posts', fd);
            reset();
            window.dispatchEvent(new CustomEvent('post-created', { detail: data.post }));
            window.toast?.info('Saved.');
        } catch (err) {
            console.error(err);
            window.toast?.error(err.message || 'Could not save your post.');
            e.status.textContent = '';
            e.postBtn.disabled = false;
        }
    }

    function init() {
        const e = getEls();
        e.addBtn.addEventListener('click', () => e.input.click());

        e.dateBtn.addEventListener('click', () => {
            window.datePicker.open({
                value: state.createdAt ?? new Date(),
                onConfirm: (dt) => {
                    state.createdAt = dt;
                    refreshDate();
                },
            });
        });
        e.dateClear.addEventListener('click', () => {
            state.createdAt = null;
            refreshDate();
        });
        refreshDate();

        e.booksBtn.addEventListener('click', () => {
            window.bookPicker.open({
                selectedIds: state.bookIds.slice(),
                onConfirm: async (ids) => {
                    state.bookIds = ids;
                    // Resolve names for the label by hitting the cached list endpoint.
                    try {
                        const data = await window.api.get('/api/books');
                        state.booksByName = {};
                        for (const b of data.items || []) state.booksByName[b.id] = b.name;
                    } catch { /* label may show count-only */ }
                    refreshBooks();
                },
            });
        });
        refreshBooks();
        e.input.addEventListener('change', (ev) => {
            addFiles(ev.target.files);
            e.input.value = '';
        });
        e.body.addEventListener('input', () => {
            e.body.style.height = 'auto';
            e.body.style.height = Math.min(e.body.scrollHeight, 320) + 'px';
            refresh();
        });
        e.postBtn.addEventListener('click', submit);

        // paste images directly into the textarea
        e.body.addEventListener('paste', (ev) => {
            const items = ev.clipboardData?.items || [];
            const files = [];
            for (const it of items) {
                if (it.kind === 'file') {
                    const f = it.getAsFile();
                    if (f && f.type.startsWith('image/')) files.push(f);
                }
            }
            if (files.length) {
                ev.preventDefault();
                addFiles(files);
            }
        });

        // drag & drop onto the composer
        const composer = document.getElementById('composer');
        ['dragenter', 'dragover'].forEach((evt) =>
            composer.addEventListener(evt, (ev) => {
                ev.preventDefault();
                composer.style.outline = '2px dashed var(--moss-soft)';
            })
        );
        ['dragleave', 'drop'].forEach((evt) =>
            composer.addEventListener(evt, (ev) => {
                ev.preventDefault();
                composer.style.outline = '';
                if (evt === 'drop' && ev.dataTransfer?.files) {
                    addFiles(ev.dataTransfer.files);
                }
            })
        );

        refresh();
    }

    return { init, reset };
})();
