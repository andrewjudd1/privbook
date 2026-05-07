/**
 * A small, dependency-free date+time picker.
 *
 *   window.datePicker.open({ value, minYear, onConfirm })
 *
 * Views:
 *   - days:   the calendar grid for a single month
 *   - months: pick a month in the chosen year
 *   - years:  scrollable grid going back to minYear (default 1900)
 */
window.datePicker = (() => {
    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    function pad(n) { return String(n).padStart(2, '0'); }

    function open({ value, minYear = 1900, onConfirm } = {}) {
        const initial = value ? new Date(value) : new Date();
        if (isNaN(initial.getTime())) initial.setTime(Date.now());

        const state = {
            year: initial.getFullYear(),
            month: initial.getMonth(),       // 0..11
            day: initial.getDate(),
            hours: initial.getHours(),
            minutes: initial.getMinutes(),
            view: 'days',                    // 'days' | 'months' | 'years'
            yearPageStart: Math.floor(initial.getFullYear() / 12) * 12,
        };

        // ---------- DOM ----------
        const overlay = document.createElement('div');
        overlay.className = 'dp-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Pick a date and time');

        const card = document.createElement('div');
        card.className = 'dp-card';
        overlay.appendChild(card);

        const header = document.createElement('div');
        header.className = 'dp-header';
        const prev = document.createElement('button');
        prev.type = 'button'; prev.className = 'dp-nav'; prev.setAttribute('aria-label', 'Previous');
        prev.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
        const title = document.createElement('button');
        title.type = 'button'; title.className = 'dp-title';
        const next = document.createElement('button');
        next.type = 'button'; next.className = 'dp-nav'; next.setAttribute('aria-label', 'Next');
        next.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        header.appendChild(prev);
        header.appendChild(title);
        header.appendChild(next);
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'dp-body';
        card.appendChild(body);

        const timeRow = document.createElement('div');
        timeRow.className = 'dp-time';
        const timeLabel = document.createElement('span');
        timeLabel.className = 'dp-time-label';
        timeLabel.textContent = 'Time';
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.className = 'dp-time-input';
        timeInput.value = `${pad(state.hours)}:${pad(state.minutes)}`;
        timeRow.appendChild(timeLabel);
        timeRow.appendChild(timeInput);
        card.appendChild(timeRow);

        const footer = document.createElement('div');
        footer.className = 'dp-footer';
        const todayBtn = document.createElement('button');
        todayBtn.type = 'button'; todayBtn.className = 'dp-link';
        todayBtn.textContent = 'Now';
        const spacer = document.createElement('div'); spacer.style.flex = '1';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button'; cancelBtn.className = 'btn btn-ghost btn-sm';
        cancelBtn.textContent = 'Cancel';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button'; saveBtn.className = 'btn btn-primary btn-sm';
        saveBtn.textContent = 'Save';
        footer.appendChild(todayBtn);
        footer.appendChild(spacer);
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        card.appendChild(footer);

        document.body.appendChild(overlay);
        // delay so transition catches
        requestAnimationFrame(() => overlay.classList.add('open'));

        // ---------- rendering ----------
        function render() {
            body.innerHTML = '';
            if (state.view === 'days') {
                title.textContent = `${MONTHS[state.month]} ${state.year}`;
                renderDays();
            } else if (state.view === 'months') {
                title.textContent = String(state.year);
                renderMonths();
            } else {
                const end = state.yearPageStart + 11;
                title.textContent = `${state.yearPageStart} – ${end}`;
                renderYears();
            }
        }

        function renderDays() {
            const grid = document.createElement('div');
            grid.className = 'dp-grid dp-grid-days';

            for (const w of WEEKDAYS) {
                const h = document.createElement('div');
                h.className = 'dp-weekday';
                h.textContent = w;
                grid.appendChild(h);
            }

            const firstDay = new Date(state.year, state.month, 1).getDay(); // 0=Sun
            const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
            const today = new Date();

            for (let i = 0; i < firstDay; i++) {
                const blank = document.createElement('div');
                blank.className = 'dp-day dp-day-blank';
                grid.appendChild(blank);
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'dp-day';
                cell.textContent = d;
                if (
                    today.getFullYear() === state.year &&
                    today.getMonth() === state.month &&
                    today.getDate() === d
                ) cell.classList.add('is-today');
                if (state.day === d) cell.classList.add('is-selected');
                cell.addEventListener('click', () => {
                    state.day = d;
                    render();
                });
                grid.appendChild(cell);
            }
            body.appendChild(grid);
        }

        function renderMonths() {
            const grid = document.createElement('div');
            grid.className = 'dp-grid dp-grid-months';
            MONTHS_SHORT.forEach((m, i) => {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'dp-chip';
                cell.textContent = m;
                if (i === state.month) cell.classList.add('is-selected');
                cell.addEventListener('click', () => {
                    state.month = i;
                    const last = new Date(state.year, state.month + 1, 0).getDate();
                    if (state.day > last) state.day = last;
                    state.view = 'days';
                    render();
                });
                grid.appendChild(cell);
            });
            body.appendChild(grid);
        }

        function renderYears() {
            const grid = document.createElement('div');
            grid.className = 'dp-grid dp-grid-years';
            const nowYear = new Date().getFullYear();
            for (let i = 0; i < 12; i++) {
                const y = state.yearPageStart + i;
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'dp-chip';
                cell.textContent = y;
                if (y < minYear || y > nowYear + 1) {
                    cell.disabled = true;
                    cell.classList.add('is-disabled');
                }
                if (y === state.year) cell.classList.add('is-selected');
                cell.addEventListener('click', () => {
                    state.year = y;
                    state.view = 'months';
                    render();
                });
                grid.appendChild(cell);
            }
            body.appendChild(grid);
        }

        // ---------- nav ----------
        prev.addEventListener('click', () => {
            if (state.view === 'days') {
                state.month -= 1;
                if (state.month < 0) { state.month = 11; state.year -= 1; }
                const last = new Date(state.year, state.month + 1, 0).getDate();
                if (state.day > last) state.day = last;
            } else if (state.view === 'months') {
                state.year -= 1;
            } else {
                state.yearPageStart -= 12;
            }
            if (state.year < minYear) state.year = minYear;
            render();
        });
        next.addEventListener('click', () => {
            const nowYear = new Date().getFullYear();
            if (state.view === 'days') {
                state.month += 1;
                if (state.month > 11) { state.month = 0; state.year += 1; }
                const last = new Date(state.year, state.month + 1, 0).getDate();
                if (state.day > last) state.day = last;
            } else if (state.view === 'months') {
                state.year += 1;
            } else {
                state.yearPageStart += 12;
            }
            if (state.year > nowYear + 1) state.year = nowYear + 1;
            render();
        });
        title.addEventListener('click', () => {
            if (state.view === 'days') {
                state.view = 'years';
                state.yearPageStart = Math.floor(state.year / 12) * 12;
            } else if (state.view === 'years') {
                state.view = 'months';
            } else {
                state.view = 'days';
            }
            render();
        });

        // ---------- time ----------
        timeInput.addEventListener('change', () => {
            const [h, m] = timeInput.value.split(':').map((n) => parseInt(n, 10));
            if (!isNaN(h)) state.hours = h;
            if (!isNaN(m)) state.minutes = m;
        });

        todayBtn.addEventListener('click', () => {
            const n = new Date();
            state.year = n.getFullYear();
            state.month = n.getMonth();
            state.day = n.getDate();
            state.hours = n.getHours();
            state.minutes = n.getMinutes();
            state.view = 'days';
            timeInput.value = `${pad(state.hours)}:${pad(state.minutes)}`;
            render();
        });

        // ---------- close / save ----------
        function close() {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 160);
            document.removeEventListener('keydown', onKey);
        }
        function save() {
            const dt = new Date(state.year, state.month, state.day, state.hours, state.minutes, 0, 0);
            close();
            try { onConfirm?.(dt); } catch (err) { console.error(err); }
        }
        function onKey(e) {
            if (e.key === 'Escape') close();
            else if (e.key === 'Enter' && document.activeElement !== timeInput) save();
        }
        document.addEventListener('keydown', onKey);
        cancelBtn.addEventListener('click', close);
        saveBtn.addEventListener('click', save);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        render();
    }

    return { open };
})();
