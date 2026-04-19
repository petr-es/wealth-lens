// Calendar picker for history entries.
// - "Now" button at the top -> live prices.
// - Month grid. Days with at least one history entry are clickable; others disabled.
// - On click: renders that entry and hides the delta tag.

(function () {
  const btn       = document.getElementById('scope-btn');
  const label     = document.getElementById('scope-label');
  const popover   = document.getElementById('cal-popover');
  const scopeWrap = btn && btn.parentElement;

  // State
  let open = false;
  let viewYear, viewMonth;             // month currently rendered
  let selectedEntryIdx = null;         // null = "live"
  // entriesByDay: { 'YYYY-MM-DD': [entry, entry, …] } — entries sorted oldest→newest within a day
  let entriesByDay = {};
  // sortedEntries: oldest→newest, with added `idx` pointing back to original PRICE_HISTORY order
  let sortedEntries = [];

  function _ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function _rebuildIndex() {
    entriesByDay = {};
    sortedEntries = [];
    if (!window.PRICE_HISTORY) return;
    const list = PRICE_HISTORY.map((entry, idx) => ({ entry, idx })).sort(
      (a, b) => new Date(a.entry.ts) - new Date(b.entry.ts)
    );
    sortedEntries = list;
    list.forEach(({ entry }) => {
      const key = _ymd(new Date(entry.ts));
      (entriesByDay[key] = entriesByDay[key] || []).push(entry);
    });
  }

  function _availableRange() {
    if (!sortedEntries.length) return null;
    const first = new Date(sortedEntries[0].entry.ts);
    const last  = new Date(sortedEntries[sortedEntries.length - 1].entry.ts);
    return { first, last };
  }

  function _formatEntryLabel(entry) {
    const d = new Date(entry.ts);
    const loc = _dateLoc();
    const tz = { timeZone: 'Europe/Prague' };
    const date = d.toLocaleDateString(loc, { ...tz, day: 'numeric', month: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString(loc, { ...tz, hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }

  function updateLabel() {
    if (selectedEntryIdx == null) {
      label.textContent = LANG.selectNow;
    } else {
      const entry = PRICE_HISTORY[selectedEntryIdx];
      if (entry) label.textContent = _formatEntryLabel(entry);
    }
  }

  function _selectEntry(idx) {
    selectedEntryIdx = idx;
    updateLabel();
    closePopover();
    if (idx == null) {
      // Live view
      if (window.PRICES) {
        render(decorateLivePrices(window.PRICES), ASSETS, { animate: true, isLive: true });
      }
    } else {
      const entry = PRICE_HISTORY[idx];
      if (!entry) return;
      render(buildPricesFromEntry(entry), buildAssetsFromEntry(entry), { animate: true, isLive: false, anchorTs: entry.ts });
    }
  }

  function _monthTitle(year, month) {
    const months = LANG.calMonths;
    return `${months[month]} ${year}`;
  }

  function _sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function _renderCalendar() {
    const range = _availableRange();
    popover.innerHTML = '';

    // "Now" button
    const nowBtn = document.createElement('button');
    nowBtn.className = 'cal-now' + (selectedEntryIdx == null ? ' active' : '');
    nowBtn.textContent = LANG.selectNow;
    nowBtn.addEventListener('click', () => _selectEntry(null));
    popover.appendChild(nowBtn);

    // Header
    const head = document.createElement('div');
    head.className = 'cal-head';
    const prev = document.createElement('button');
    prev.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5L4 6l3.5 3.5"/></svg>';
    prev.title = LANG.calPrev;
    const title = document.createElement('div');
    title.className = 'cal-title';
    title.textContent = _monthTitle(viewYear, viewMonth);
    const next = document.createElement('button');
    next.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>';
    next.title = LANG.calNext;

    // Prev/next limits based on available range
    if (range) {
      const firstMonth = new Date(range.first.getFullYear(), range.first.getMonth(), 1);
      const lastMonth  = new Date(range.last.getFullYear(),  range.last.getMonth(), 1);
      const viewFirst  = new Date(viewYear, viewMonth, 1);
      if (viewFirst <= firstMonth) prev.disabled = true;
      if (viewFirst >= lastMonth)  next.disabled = true;
    }
    prev.addEventListener('click', () => {
      if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; }
      else viewMonth -= 1;
      _renderCalendar();
    });
    next.addEventListener('click', () => {
      if (viewMonth === 11) { viewMonth = 0; viewYear += 1; }
      else viewMonth += 1;
      _renderCalendar();
    });
    head.appendChild(prev); head.appendChild(title); head.appendChild(next);
    popover.appendChild(head);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    LANG.calDow.forEach(dw => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = dw;
      grid.appendChild(el);
    });

    // Determine grid start: Monday-first.
    const first = new Date(viewYear, viewMonth, 1);
    let startDow = first.getDay(); // 0=Sun..6=Sat
    let offset = (startDow + 6) % 7; // how many leading cells from previous month
    const gridStart = new Date(viewYear, viewMonth, 1 - offset);

    // Selected entry date for highlighting
    const selectedDate = selectedEntryIdx != null
      ? _ymd(new Date(PRICE_HISTORY[selectedEntryIdx].ts))
      : null;

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = _ymd(d);
      const entries = entriesByDay[key] || [];
      const cell = document.createElement('button');
      cell.className = 'cal-day' + (entries.length ? ' has-entry' : '');
      if (!_sameMonth(d, new Date(viewYear, viewMonth, 1))) cell.classList.add('other-month');
      if (entries.length && selectedDate === key) cell.classList.add('active');
      cell.textContent = d.getDate();
      if (entries.length) {
        cell.addEventListener('click', () => {
          // If there are multiple entries on the same day, pick the latest one.
          const latest = entries[entries.length - 1];
          const idx = PRICE_HISTORY.indexOf(latest);
          if (idx >= 0) _selectEntry(idx);
        });
      } else {
        cell.disabled = true;
      }
      grid.appendChild(cell);
    }
    popover.appendChild(grid);
  }

  // Backdrop element (created once, reused)
  let backdrop = null;
  function _ensureBackdrop() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'cal-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', closePopover);
    (document.getElementById('app') || document.body).appendChild(backdrop);
    return backdrop;
  }

  function openPopover() {
    _rebuildIndex();
    const range = _availableRange();
    if (selectedEntryIdx != null) {
      const d = new Date(PRICE_HISTORY[selectedEntryIdx].ts);
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
    } else if (range) {
      viewYear = range.last.getFullYear(); viewMonth = range.last.getMonth();
    } else {
      const n = new Date();
      viewYear = n.getFullYear(); viewMonth = n.getMonth();
    }
    _renderCalendar();
    popover.hidden = false;
    _positionPopover();
    _ensureBackdrop().hidden = false;
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    open = true;
    setTimeout(() => document.addEventListener('mousedown', _onDocMouseDown), 0);
    document.addEventListener('keydown', _onKeyDown);
  }

  function _positionPopover() {
    const r = btn.getBoundingClientRect();
    const isMobile = window.innerWidth <= 520;
    const margin = 8;
    if (isMobile) {
      const w = Math.min(300, window.innerWidth - margin * 2);
      popover.style.width = w + 'px';
      popover.style.top  = (r.bottom + margin) + 'px';
      popover.style.left = ((window.innerWidth - w) / 2) + 'px';
    } else {
      popover.style.width = '';
      const pw = popover.offsetWidth || 260;
      let left = r.right - pw;
      if (left < margin) left = margin;
      if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
      popover.style.top  = (r.bottom + margin) + 'px';
      popover.style.left = left + 'px';
    }
  }

  function closePopover() {
    popover.hidden = true;
    popover.style.top = popover.style.left = popover.style.width = '';
    if (backdrop) backdrop.hidden = true;
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
    open = false;
    document.removeEventListener('mousedown', _onDocMouseDown);
    document.removeEventListener('keydown', _onKeyDown);
  }

  function _onDocMouseDown(e) {
    if (scopeWrap && scopeWrap.contains(e.target)) return;
    closePopover();
  }
  function _onKeyDown(e) { if (e.key === 'Escape') closePopover(); }

  btn.addEventListener('click', () => {
    if (open) closePopover(); else openPopover();
  });

  // Public: called by ui.js to re-render label on locale switch, and by
  // updater.js to reset to live view after a successful refresh.
  window.CalendarPicker = {
    reset() {
      selectedEntryIdx = null;
      updateLabel();
    },
    refresh() {
      _rebuildIndex();
      updateLabel();
      if (open) _renderCalendar();
    },
    isLive() { return selectedEntryIdx == null; },
    // Re-render the current selection (live or historical) with given options.
    rerender({ animate = false } = {}) {
      if (selectedEntryIdx == null) {
        if (window.PRICES) {
          render(decorateLivePrices(window.PRICES), ASSETS, { animate, isLive: true });
        }
      } else {
        const entry = PRICE_HISTORY[selectedEntryIdx];
        if (entry) render(buildPricesFromEntry(entry), buildAssetsFromEntry(entry), { animate, isLive: false, anchorTs: entry.ts });
      }
    },
  };

  // Initial label
  updateLabel();
})();
