/**
 * Timeline rendering: load posts in pages, render each post with images
 * laid out per its `layout` field, support delete + lightbox.
 */
(() => {
    const PAGE_SIZE = 20;

    const state = {
        nextCursor: null,
        loading: false,
        done: false,
        bookFilter: null,
        gen: 0,
    };

    const els = {};

    function pickEls() {
        els.timeline = document.getElementById('timeline');
        els.loadMore = document.getElementById('load-more-row');
        els.greeting = document.getElementById('greeting');
        els.signOut = document.getElementById('signout-btn');
        els.booksStrip = document.getElementById('books-strip');
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now - d;
        const min = 60 * 1000;
        const hour = 60 * min;
        const day = 24 * hour;

        if (diffMs < min) return 'just now';
        if (diffMs < hour) return `${Math.floor(diffMs / min)} min`;
        if (diffMs < 6 * hour) return `${Math.floor(diffMs / hour)} h`;

        const sameYear = d.getFullYear() === now.getFullYear();
        const opts = sameYear
            ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
        return d.toLocaleString(undefined, opts);
    }

    function pickLayout(post) {
        const n = post.images?.length ?? 0;
        if (n <= 1) return 'single';
        if (post.layout === 'auto') return n === 4 ? 'collage' : 'grid';
        return post.layout;
    }

    function countClass(n) {
        if (n === 2) return 'count-2';
        if (n === 3) return 'count-3';
        if (n === 4) return 'count-4';
        return 'count-many';
    }

    function avatarLetter() {
        const u = window.Clerk?.user;
        if (!u) return '·';
        const name = u.firstName || u.username || u.primaryEmailAddress?.emailAddress || '';
        return (name[0] || '·').toUpperCase();
    }

    function userDisplayName() {
        const u = window.Clerk?.user;
        if (!u) return 'You';
        return u.firstName || u.username || u.primaryEmailAddress?.emailAddress || 'You';
    }

    function renderImages(post) {
        const n = post.images.length;
        if (n === 0) return null;

        const wrap = document.createElement('div');
        const layout = pickLayout(post);
        wrap.className = `post-images layout-${layout} ${countClass(n)}`;

        const visibleMax = layout === 'grid' && n > 9 ? 9 : (layout === 'collage' && n > 5 ? 5 : n);
        const visible = post.images.slice(0, visibleMax);
        const allUrls = post.images.map((im) => im.url);

        visible.forEach((img, i) => {
            const el = document.createElement('img');
            el.src = img.url;
            el.alt = '';
            el.loading = 'lazy';
            el.addEventListener('click', () => window.lightbox.open(allUrls, i));
            if (i === visibleMax - 1 && n > visibleMax) {
                const wrapper = document.createElement('div');
                wrapper.className = 'more-overlay';
                wrapper.dataset.extra = String(n - visibleMax);
                wrapper.appendChild(el);
                wrap.appendChild(wrapper);
            } else {
                wrap.appendChild(el);
            }
        });
        return wrap;
    }

    function renderPost(post) {
        const article = document.createElement('article');
        article.className = 'post';
        article.dataset.id = post.id;
        article.dataset.createdAt = post.created_at;

        const head = document.createElement('div');
        head.className = 'post-head';
        const av = document.createElement('div');
        av.className = 'avatar';
        av.textContent = avatarLetter();
        const meta = document.createElement('div');
        meta.className = 'post-meta';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = userDisplayName();
        const when = document.createElement('button');
        when.type = 'button';
        when.className = 'when';
        when.title = 'Edit date';
        when.textContent = fmtDate(post.created_at);
        when.addEventListener('click', () => editPostDate(post, article, when));
        meta.appendChild(name);
        meta.appendChild(when);

        const menu = document.createElement('button');
        menu.className = 'post-menu';
        menu.title = 'Delete';
        menu.setAttribute('aria-label', 'Delete post');
        menu.innerHTML =
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
        menu.addEventListener('click', () => confirmDelete(post.id, article));

        head.appendChild(av);
        head.appendChild(meta);
        if ((post.images?.length ?? 0) > 1) {
            head.appendChild(renderLayoutEditor(post, article));
        }
        head.appendChild(menu);
        article.appendChild(head);

        if (post.body) {
            const body = document.createElement('div');
            body.className = 'post-body';
            body.textContent = post.body;
            article.appendChild(body);
        }

        const images = renderImages(post);
        if (images) article.appendChild(images);

        const books = renderBooks(post, article);
        article.appendChild(books);

        return article;
    }

    const LAYOUT_OPTIONS = [
        ['auto', 'Layout: auto'],
        ['grid', 'Grid'],
        ['collage', 'Collage'],
        ['single', 'Stack'],
    ];

    function renderLayoutEditor(post, article) {
        const sel = document.createElement('select');
        sel.className = 'layout-select post-layout-select';
        sel.title = 'How to lay out these photos';
        for (const [val, label] of LAYOUT_OPTIONS) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = label;
            sel.appendChild(opt);
        }
        sel.value = post.layout || 'auto';

        sel.addEventListener('change', async () => {
            const next = sel.value;
            const prev = post.layout || 'auto';
            if (next === prev) return;
            sel.disabled = true;
            try {
                const data = await window.api.patch(`/api/posts/${post.id}`, { layout: next });
                post.layout = data.post.layout;
                const oldImages = article.querySelector('.post-images');
                const fresh = renderImages(post);
                if (oldImages && fresh) oldImages.replaceWith(fresh);
                window.toast?.info('Layout updated.');
            } catch (err) {
                sel.value = prev;
                window.toast?.error(err.message || 'Could not update layout.');
            } finally {
                sel.disabled = false;
            }
        });

        return sel;
    }

    function renderBooks(post, article) {
        const wrap = document.createElement('div');
        wrap.className = 'post-books';

        const list = document.createElement('div');
        list.className = 'post-books-list';
        for (const b of post.books || []) {
            const chip = document.createElement('span');
            chip.className = 'post-book-chip';
            chip.textContent = b.name;
            list.appendChild(chip);
        }
        wrap.appendChild(list);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'post-books-edit';
        const hasBooks = (post.books || []).length > 0;
        editBtn.textContent = hasBooks ? 'Edit' : '+ Add to book';
        editBtn.addEventListener('click', () => editPostBooks(post, article));
        wrap.appendChild(editBtn);

        return wrap;
    }

    function editPostBooks(post, node) {
        const currentIds = (post.books || []).map((b) => b.id);
        window.bookPicker.open({
            selectedIds: currentIds,
            onConfirm: async (ids) => {
                const same =
                    ids.length === currentIds.length &&
                    ids.every((id) => currentIds.includes(id));
                if (same) return;
                try {
                    const data = await window.api.put(`/api/posts/${post.id}/books`, { book_ids: ids });
                    post.books = data.books;
                    refreshPostBooks(node, post);
                    window.dispatchEvent(new CustomEvent('books-changed'));
                } catch (err) {
                    window.toast?.error(err.message || 'Could not update books.');
                }
            },
        });
    }

    function refreshPostBooks(article, post) {
        const old = article.querySelector('.post-books');
        if (!old) return;
        const fresh = renderBooks(post, article);
        old.replaceWith(fresh);
    }

    function editPostDate(post, node, whenEl) {
        window.datePicker.open({
            value: post.created_at,
            onConfirm: async (dt) => {
                const iso = dt.toISOString();
                try {
                    const data = await window.api.patch(`/api/posts/${post.id}`, { created_at: iso });
                    const updated = data.post;
                    post.created_at = updated.created_at;
                    whenEl.textContent = fmtDate(post.created_at);
                    reorderPost(node, post.created_at);
                    window.toast?.info('Date updated.');
                } catch (err) {
                    window.toast?.error(err.message || 'Could not update date.');
                }
            },
        });
    }

    function reorderPost(node, createdAt) {
        const ts = new Date(createdAt).getTime();
        const siblings = Array.from(els.timeline.querySelectorAll('.post')).filter((n) => n !== node);
        let target = null;
        for (const s of siblings) {
            const sTs = new Date(s.dataset.createdAt).getTime();
            if (ts > sTs) { target = s; break; }
        }
        node.dataset.createdAt = createdAt;
        if (target) els.timeline.insertBefore(node, target);
        else els.timeline.appendChild(node);
    }

    async function confirmDelete(id, node) {
        if (!confirm('Delete this post? This can’t be undone.')) return;
        try {
            await window.api.del(`/api/posts/${id}`);
            node.style.transition = 'opacity 200ms ease, transform 200ms ease';
            node.style.opacity = '0';
            node.style.transform = 'scale(0.98)';
            setTimeout(() => node.remove(), 220);
            window.toast?.info('Removed.');
            ensureEmptyState();
        } catch (err) {
            window.toast?.error(err.message || 'Could not delete.');
        }
    }

    function ensureEmptyState() {
        if (els.timeline.querySelector('.post')) return;
        els.timeline.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
            <h3>Your timeline is empty</h3>
            <p>Write something small, share a photo, save a moment. It will live here for you.</p>
        `;
        els.timeline.appendChild(empty);
    }

    function clearEmptyState() {
        const empty = els.timeline.querySelector('.empty-state');
        if (empty) empty.remove();
    }

    async function loadPage() {
        if (state.loading || state.done) return;
        const gen = state.gen;
        state.loading = true;
        els.loadMore.hidden = false;
        try {
            const data = await window.api.get('/api/posts', {
                cursor: state.nextCursor,
                limit: PAGE_SIZE,
                book_id: state.bookFilter,
            });
            if (gen !== state.gen) return;
            for (const p of data.items) {
                els.timeline.appendChild(renderPost(p));
            }
            state.nextCursor = data.nextCursor;
            if (!data.nextCursor) state.done = true;
            if (els.timeline.children.length === 0) ensureEmptyState();
        } catch (err) {
            if (gen !== state.gen) return;
            console.error(err);
            window.toast?.error(err.message || 'Could not load timeline.');
        } finally {
            if (gen === state.gen) {
                state.loading = false;
                els.loadMore.hidden = true;
            }
        }
    }

    function resetTimeline() {
        state.gen += 1;
        state.nextCursor = null;
        state.done = false;
        state.loading = false;
        els.loadMore.hidden = true;
        els.timeline.innerHTML = '';
    }

    function attachInfiniteScroll() {
        const obs = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) loadPage();
            }
        }, { rootMargin: '400px' });

        const sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        document.querySelector('main').appendChild(sentinel);
        obs.observe(sentinel);
    }

    async function start() {
        pickEls();

        // header
        const u = window.Clerk?.user;
        if (u) {
            const name = u.firstName || u.username || '';
            els.greeting.textContent = name ? `Hi, ${name}` : '';
        }

        els.signOut.addEventListener('click', async () => {
            await window.Clerk.signOut();
            window.location.href = '/';
        });

        // composer wiring
        window.composer.init();

        // books strip
        window.booksStrip.init(els.booksStrip);
        window.addEventListener('book-filter-changed', async (ev) => {
            state.bookFilter = ev.detail?.bookId || null;
            resetTimeline();
            await loadPage();
        });

        window.addEventListener('post-created', (ev) => {
            const post = ev.detail;
            // If a filter is active and the new post isn't in that book, skip rendering it.
            if (state.bookFilter) {
                const inFilter = (post.books || []).some((b) => b.id === state.bookFilter);
                if (!inFilter) return;
            }
            clearEmptyState();
            const node = renderPost(post);
            els.timeline.prepend(node);
            reorderPost(node, post.created_at);
        });

        await loadPage();
        attachInfiniteScroll();
    }

    window.privbook.onAuthReady(start);
})();
