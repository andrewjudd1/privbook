window.lightbox = (() => {
    const els = {};
    let urls = [];
    let index = 0;
    let touchStartX = null;
    let touchStartY = null;
    let wheelAccum = 0;
    let wheelLocked = false;
    let wheelResetTimer = null;
    let initialised = false;

    function pickEls() {
        els.root = document.getElementById('lightbox');
        els.img = document.getElementById('lightbox-img');
        els.close = document.getElementById('lightbox-close');
        els.prev = document.getElementById('lightbox-prev');
        els.next = document.getElementById('lightbox-next');
    }

    function render() {
        els.img.src = urls[index] || '';
        const multi = urls.length > 1;
        if (els.prev) els.prev.hidden = !multi;
        if (els.next) els.next.hidden = !multi;
    }

    function open(list, startIndex = 0) {
        if (!initialised) init();
        urls = Array.isArray(list) ? list.slice() : [list];
        index = Math.max(0, Math.min(startIndex | 0, urls.length - 1));
        render();
        els.root.classList.add('open');
    }

    function close() {
        els.root.classList.remove('open');
        els.img.src = '';
        urls = [];
        index = 0;
    }

    function go(delta) {
        if (urls.length < 2) return;
        index = (index + delta + urls.length) % urls.length;
        render();
    }

    function onTouchStart(e) {
        if (e.touches.length !== 1) { touchStartX = null; return; }
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }

    function onTouchEnd(e) {
        if (touchStartX == null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
        go(dx < 0 ? 1 : -1);
    }

    function scheduleWheelReset() {
        if (wheelResetTimer) clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(() => {
            wheelAccum = 0;
            wheelLocked = false;
            wheelResetTimer = null;
        }, 180);
    }

    function onWheel(e) {
        if (urls.length < 2) return;
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        scheduleWheelReset();
        if (wheelLocked) return;
        wheelAccum += e.deltaX;
        if (Math.abs(wheelAccum) >= 80) {
            go(wheelAccum > 0 ? 1 : -1);
            wheelAccum = 0;
            wheelLocked = true;
        }
    }

    function init() {
        pickEls();
        if (!els.root) return;
        initialised = true;

        els.close?.addEventListener('click', close);
        els.root.addEventListener('click', (e) => {
            if (e.target === els.root) close();
        });
        els.prev?.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
        els.next?.addEventListener('click', (e) => { e.stopPropagation(); go(1); });

        document.addEventListener('keydown', (e) => {
            if (!els.root.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
        });

        els.root.addEventListener('touchstart', onTouchStart, { passive: true });
        els.root.addEventListener('touchend', onTouchEnd);
        els.root.addEventListener('wheel', onWheel, { passive: false });
    }

    document.addEventListener('DOMContentLoaded', init);

    return { open, close };
})();
