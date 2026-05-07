window.toast = (() => {
    function show(message, kind = 'info', ms = 2800) {
        const stack = document.getElementById('toast-stack');
        if (!stack) {
            console[kind === 'error' ? 'error' : 'log'](message);
            return;
        }
        const el = document.createElement('div');
        el.className = 'toast' + (kind === 'error' ? ' error' : '');
        el.textContent = message;
        stack.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity 240ms ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 260);
        }, ms);
    }
    return {
        info: (m) => show(m, 'info'),
        error: (m) => show(m, 'error', 4000),
    };
})();
