/**
 * Read-only timeline view of a friend, scoped to whichever access they granted.
 *
 *   /friend/<userId>
 *
 * Server enforces the share scope; the client mirrors the same UX as
 * /timeline (books strip + timeline + lightbox) but without the composer
 * and without delete/edit affordances.
 */
(() => {
    const PAGE_SIZE = 20;
    const els = {};
    const state = {
        userId: null,
        nextCursor: null,
        loading: false,
        done: false,
        bookFilter: null,
        gen: 0,
        books: [],
    };

    function userIdFromPath() {
        const m = window.location.pathname.match(/^\/friend\/([^\/?#]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function pickEls() {
        els.title = document.getElementById('friend-title');
        els.sub = document.getElementById('friend-sub');
        els.timeline = document.getElementById('timeline');
        els.loadMore = document.getElementById('load-more-row');
        els.lightbox = document.getElementById('lightbox');
        els.lightboxImg = document.getElementById('lightbox-img');
        els.lightboxClose = document.getElementById('lightbox-close');
        els.booksStrip = document.getElementById('books-strip');
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now - d;
        const min = 60 * 1000;
        const hour = 60 * min;
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

    function renderImages(post) {
        const n = post.images.length;
        if (n === 0) return null;
        const wrap = document.createElement('div');
        const layout = pickLayout(post);
        wrap.className = `post-images layout-${layout} ${countClass(n)}`;
        const visibleMax = layout === 'grid' && n > 9 ? 9 : (layout === 'collage' && n > 5 ? 5 : n);
        const visible = post.images.slice(0, visibleMax);
        visible.forEach((img, i) => {
            const el = document.createElement('img');
            el.src = img.url; el.alt = ''; el.loading = 'lazy';
            el.addEventListener('click', () => openLightbox(img.url));
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

    function renderPost(post, friend) {
        const article = document.createElement('article');
        article.className = 'post';
        article.dataset.id = post.id;

        const head = document.createElement('div');
        head.className = 'post-head';
        const av = document.createElement('div');
        av.className = 'avatar';
        av.textContent = (friend?.display_name?.[0] || '·').toUpperCase();
        const meta = document.createElement('div');
        meta.className = 'post-meta';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = friend?.display_name || 'Friend';
        const when = document.createElement('span');
        when.className = 'when when-static';
        when.textContent = fmtDate(post.created_at);
        meta.appendChild(name);
        meta.appendChild(when);
        head.appendChild(av);
        head.appendChild(meta);
        article.appendChild(head);

        if (post.body) {
            const body = document.createElement('div');
            body.className = 'post-body';
            body.textContent = post.body;
            article.appendChild(body);
        }

        const images = renderImages(post);
        if (images) article.appendChild(images);

        if (post.books?.length) {
            const wrap = document.createElement('div');
            wrap.className = 'post-books';
            const list = document.createElement('div');
            list.className = 'post-books-list';
            for (const b of post.books) {
                const chip = document.createElement('span');
                chip.className = 'post-book-chip';
                chip.textContent = b.name;
                list.appendChild(chip);
            }
            wrap.appendChild(list);
            article.appendChild(wrap);
        }

        return article;
    }

    function openLightbox(url) {
        els.lightboxImg.src = url;
        els.lightbox.classList.add('open');
    }
    function closeLightbox() {
        els.lightbox.classList.remove('open');
        els.lightboxImg.src = '';
    }

    function ensureEmptyState() {
        if (els.timeline.querySelector('.post')) return;
        els.timeline.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `<h3>Nothing to see yet</h3><p>This friend hasn't posted anything you can view.</p>`;
        els.timeline.appendChild(empty);
    }

    let friendCache = null;

    async function loadFriendInfo() {
        const data = await window.api.get(`/api/friends/${state.userId}`);
        friendCache = data.friend;
        els.title.textContent = friendCache?.display_name || 'Friend';
        els.sub.textContent = data.scope === 'all' ? 'Their full timeline' : 'Selected books only';
    }

    async function loadBooks() {
        try {
            const data = await window.api.get(`/api/friends/${state.userId}/books`);
            state.books = data.items || [];
            renderBooksStrip();
        } catch (err) {
            console.error(err);
        }
    }

    function renderBooksStrip() {
        const r = els.booksStrip;
        r.innerHTML = '';
        const row = document.createElement('div');
        row.className = 'books-strip-row';

        function pill(label, active, onClick) {
            const wrap = document.createElement('span'); wrap.className = 'book-pill-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'book-pill' + (active ? ' is-active' : '');
            btn.textContent = label;
            btn.addEventListener('click', onClick);
            wrap.appendChild(btn);
            return wrap;
        }

        row.appendChild(pill('All', state.bookFilter === null, () => setFilter(null)));
        for (const b of state.books) {
            const label = b.post_count != null && b.post_count > 0 ? `${b.name} · ${b.post_count}` : b.name;
            row.appendChild(pill(label, state.bookFilter === b.id, () => setFilter(b.id)));
        }
        r.appendChild(row);
    }

    function setFilter(id) {
        state.bookFilter = id;
        resetTimeline();
        renderBooksStrip();
        loadPage();
    }

    function resetTimeline() {
        state.gen += 1;
        state.nextCursor = null;
        state.done = false;
        state.loading = false;
        els.loadMore.hidden = true;
        els.timeline.innerHTML = '';
    }

    async function loadPage() {
        if (state.loading || state.done) return;
        const gen = state.gen;
        state.loading = true;
        els.loadMore.hidden = false;
        try {
            const data = await window.api.get(`/api/friends/${state.userId}/posts`, {
                cursor: state.nextCursor,
                limit: PAGE_SIZE,
                book_id: state.bookFilter,
            });
            if (gen !== state.gen) return;
            for (const p of data.items) {
                els.timeline.appendChild(renderPost(p, friendCache));
            }
            state.nextCursor = data.nextCursor;
            if (!data.nextCursor) state.done = true;
            if (els.timeline.children.length === 0) ensureEmptyState();
        } catch (err) {
            if (gen !== state.gen) return;
            console.error(err);
            if (err.status === 403) {
                els.timeline.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'empty-state';
                div.innerHTML = '<h3>No access</h3><p>This friend hasn’t shared their privbook with you.</p>';
                els.timeline.appendChild(div);
                state.done = true;
            } else {
                window.toast?.error(err.message || 'Could not load timeline.');
            }
        } finally {
            if (gen === state.gen) {
                state.loading = false;
                els.loadMore.hidden = true;
            }
        }
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
        const id = userIdFromPath();
        if (!id) {
            document.querySelector('main').innerHTML = '<p style="text-align:center;color:var(--muted)">Friend not found.</p>';
            return;
        }
        state.userId = id;
        pickEls();

        els.lightboxClose.addEventListener('click', closeLightbox);
        els.lightbox.addEventListener('click', (e) => { if (e.target === els.lightbox) closeLightbox(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.lightbox.classList.contains('open')) closeLightbox();
        });

        try {
            await loadFriendInfo();
        } catch (err) {
            els.title.textContent = 'No access';
            els.sub.textContent = 'You don’t have access to this friend.';
            return;
        }
        await Promise.all([loadBooks(), loadPage()]);
        attachInfiniteScroll();
    }

    window.addEventListener('auth-ready', start);
})();
