window.scrollLock = (() => {
    let count = 0;
    let prevHtmlOverflow = '';
    let prevBodyOverflow = '';
    let prevBodyOverscroll = '';

    function lock() {
        count++;
        if (count > 1) return;
        const html = document.documentElement;
        const body = document.body;
        prevHtmlOverflow = html.style.overflow;
        prevBodyOverflow = body.style.overflow;
        prevBodyOverscroll = body.style.overscrollBehavior;
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'contain';
    }

    function unlock() {
        if (count === 0) return;
        count--;
        if (count > 0) return;
        const html = document.documentElement;
        const body = document.body;
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
        body.style.overscrollBehavior = prevBodyOverscroll;
    }

    return { lock, unlock };
})();
