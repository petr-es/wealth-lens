// Portfolio projection widget — vanilla JS, mirrors the React handoff design.
// Depends on: safeStorage (lang-init.js), LANG (ui.js), fmtCzk / fmtDate /
//             animateNumber (portfolio.js). Receives current portfolio total
//             via the 'wl:render' custom event dispatched from portfolio.js.
(function () {
  'use strict';

  // ── State (persisted to localStorage) ─────────────────────────────────────
  let _currentTotal = 0;
  let _prevFV = 0;

  function _defaultDate() {
    return '2037-08-29';
  }

  const S = {
    get date()       { return safeStorage.get('wl.proj.date') || _defaultDate(); },
    set date(v)      { safeStorage.set('wl.proj.date', v); },
    get rate()       { return parseFloat(safeStorage.get('wl.proj.rate')) || 8; },
    set rate(v)      { safeStorage.set('wl.proj.rate', String(v)); },
    get contribOn()  { return safeStorage.get('wl.proj.contribOn') === 'true'; },
    set contribOn(v) { safeStorage.set('wl.proj.contribOn', String(v)); },
    get monthly()        { return parseInt(safeStorage.get('wl.proj.monthly')) || 5000; },
    set monthly(v)       { safeStorage.set('wl.proj.monthly', String(v)); },
    get withdrawalRate() { return parseFloat(safeStorage.get('wl.proj.wr')) || 4; },
    set withdrawalRate(v){ safeStorage.set('wl.proj.wr', String(v)); },
    get targetOn()       { const v = safeStorage.get('wl.proj.targetOn'); return v === null ? true : v === 'true'; },
    set targetOn(v)      { safeStorage.set('wl.proj.targetOn', String(v)); },
    get targetAmount()   { return parseInt(safeStorage.get('wl.proj.target')) || 20000000; },
    set targetAmount(v)  { safeStorage.set('wl.proj.target', String(v)); },
  };

  // ── Compound growth calculation ────────────────────────────────────────────
  function _calc(PV, dateStr, rate, contribOn, monthly) {
    const target = new Date(dateStr);
    const now    = new Date();
    const n = Math.max(0,
      (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth()   - now.getMonth())
    );
    const r   = rate / 100 / 12;
    const PMT = contribOn ? (monthly || 0) : 0;
    let FV;
    if (r === 0 || n === 0) { FV = PV + PMT * n; }
    else { FV = PV * Math.pow(1 + r, n) + PMT * ((Math.pow(1 + r, n) - 1) / r); }
    FV = Math.round(FV);
    const totalContrib   = PMT * n;
    const interestEarned = Math.max(0, FV - PV - totalContrib);
    return { FV, n, totalContrib, interestEarned };
  }

  // ── Duration label (locale-aware) ──────────────────────────────────────────
  function _durLabel(n) {
    if (n <= 0) return LANG.projSelectFuture;
    const yrs = Math.floor(n / 12);
    const mos = n % 12;
    function yrStr(y) {
      if (LANG.locale === 'cs') {
        return y === 1 ? LANG.projYears[0] : y < 5 ? LANG.projYears[1] : LANG.projYears[2];
      }
      return y === 1 ? LANG.projYears[0] : LANG.projYears[1];
    }
    function moStr(m) {
      if (LANG.locale === 'cs') {
        return m === 1 ? LANG.projMonths[0] : m < 5 ? LANG.projMonths[1] : LANG.projMonths[2];
      }
      return m === 1 ? LANG.projMonths[0] : LANG.projMonths[1];
    }
    const parts = [];
    if (yrs > 0) parts.push(`${yrs} ${yrStr(yrs)}`);
    if (mos > 0) parts.push(`${mos} ${moStr(mos)}`);
    return parts.join(' ');
  }

  // ── YYYY-MM-DD helper ──────────────────────────────────────────────────────
  function _ymd(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  // ── DOM element factory ────────────────────────────────────────────────────
  function _el(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  // ── Formatted number input helpers ─────────────────────────────────────────
  function _parseInputNum(str) {
    return Math.max(0, parseInt(str.replace(/[^\d]/g, ''), 10) || 0);
  }

  function _mkFormattedInput(rawValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.className = 'proj-number';
    input.value = rawValue > 0 ? rawValue.toLocaleString(_loc()) : '';

    input.addEventListener('focus', () => {
      const n = _parseInputNum(input.value);
      input.value = n > 0 ? String(n) : '';
    });

    input.addEventListener('blur', () => {
      const n = _parseInputNum(input.value);
      input.value = n > 0 ? n.toLocaleString(_loc()) : '';
    });

    return input;
  }

  // ── Card DOM refs ──────────────────────────────────────────────────────────
  let _cardEl, _resultEl, _paramsEl, _barEl, _legendEl, _goalEl;

  // ── Render card ────────────────────────────────────────────────────────────
  function renderCard() {
    if (!_resultEl) return;

    const PV = _currentTotal;
    const { FV, n, totalContrib, interestEarned } = _calc(PV, S.date, S.rate, S.contribOn, S.monthly);
    const stackTotal = PV + totalContrib + interestEarned || 1;
    const valid = n > 0 && FV > PV;
    const ccy = LANG.currency;

    // ── Goal block ──────────────────────────────────────────────────────────
    if (_goalEl) {
      if (S.targetOn && S.targetAmount > 0) {
        _goalEl.hidden = false;
        _goalEl.innerHTML = '';

        const target = S.targetAmount;
        const pct = Math.min(100, PV / target * 100);
        const onTrack = valid && FV >= target;
        const goalColor = onTrack ? 'var(--accent)' : '#fb923c';
        const monthlyWithdraw = Math.round(target * (S.withdrawalRate / 100) / 12);

        const goalRow = _el('div', 'proj-goal-row');
        const pctSpan = _el('span', 'proj-goal-pct');
        pctSpan.textContent = pct.toFixed(1) + '%';
        pctSpan.style.color = goalColor;
        goalRow.appendChild(pctSpan);

        if (valid) {
          const statusEl = _el('span', 'proj-goal-status ' + (onTrack ? 'on-track' : 'behind'));
          statusEl.textContent = onTrack ? LANG.projOnTrack : LANG.projBehind;
          goalRow.appendChild(statusEl);
        }
        _goalEl.appendChild(goalRow);

        const secEl = _el('div', 'proj-goal-secondary');
        secEl.textContent = `${LANG.projGoalLabel}: ${fmtCzk(target)} ${ccy} · ${LANG.projGoalWithdraw}: ${fmtCzk(monthlyWithdraw)} ${LANG.projPerMo}`;
        _goalEl.appendChild(secEl);

        const goalBar = _el('div', 'proj-goal-bar');
        if (pct > 0) {
          const fillEl = _el('div', 'proj-goal-fill');
          fillEl.style.flex = String(pct / 100);
          fillEl.style.background = goalColor;
          fillEl.style.boxShadow = glowShadow(goalColor);
          goalBar.appendChild(fillEl);
        }
        if (pct < 100) {
          const emptyEl = _el('div', 'proj-goal-empty');
          emptyEl.style.flex = String(1 - pct / 100);
          goalBar.appendChild(emptyEl);
        }
        _goalEl.appendChild(goalBar);
      } else {
        _goalEl.hidden = true;
      }
    }

    // ── Value line ──────────────────────────────────────────────────────────
    _resultEl.innerHTML = '';
    const row = _el('div', 'proj-result-row');

    const fvEl = _el('span', 'proj-fv num-anim');
    fvEl.textContent = fmtCzk(FV);
    row.appendChild(fvEl);

    const ccyEl = _el('span', 'proj-result-ccy');
    ccyEl.textContent = ccy;
    row.appendChild(ccyEl);

    if (valid) {
      row.appendChild(_mkSlash());

      const swrEl = _el('span', 'proj-swr-val num-anim');
      swrEl.textContent = fmtCzk(Math.round(FV * (S.withdrawalRate / 100) / 12));
      row.appendChild(swrEl);

      const swrCcyEl = _el('span', 'proj-swr-ccy');
      swrCcyEl.textContent = ccy;
      row.appendChild(swrCcyEl);
    }

    _resultEl.appendChild(row);

    // Animate main FV number when data is present
    if (PV > 0) animateNumber(fvEl, _prevFV, FV, 900, fmtCzk);
    _prevFV = FV;

    // ── Params line ─────────────────────────────────────────────────────────
    const rate = S.rate;
    const parts = [];
    if (n > 0) parts.push(_durLabel(n));
    parts.push((rate % 1 === 0 ? rate : rate.toFixed(1)) + ' ' + LANG.projPa);
    if (S.contribOn && S.monthly > 0) {
      parts.push(fmtCzk(S.monthly) + ' ' + LANG.currency);
    }
    _paramsEl.textContent = parts.join(' · '); // middle dot

    // ── Stacked bar ─────────────────────────────────────────────────────────
    _barEl.innerHTML = '';
    _barEl.hidden = !valid;
    if (valid) {
      _mkSeg(_barEl, PV / stackTotal,             'var(--accent)');
      if (S.contribOn && totalContrib > 0) {
        _mkSeg(_barEl, totalContrib / stackTotal,  '#a78bfa');
      }
      if (interestEarned > 0) {
        _mkSeg(_barEl, interestEarned / stackTotal, '#f472b6');
      }
    }

    // ── Legend ──────────────────────────────────────────────────────────────
    _legendEl.innerHTML = '';
    _legendEl.hidden = !valid;
    if (valid) {
      _mkLegend(_legendEl, 'var(--accent)', LANG.projNowLegend,      fmtCzk(Math.round(PV)) + ' ' + ccy);
      if (S.contribOn && totalContrib > 0) {
        _mkLegend(_legendEl, '#a78bfa', LANG.projContribsLegend, fmtCzk(Math.round(totalContrib)) + ' ' + ccy);
      }
      if (interestEarned > 0) {
        _mkLegend(_legendEl, '#f472b6', LANG.projGrowthLegend,   fmtCzk(Math.round(interestEarned)) + ' ' + ccy);
      }
    }
  }

  function _mkSlash() {
    const s = _el('span', 'proj-slash');
    s.textContent = '/';
    return s;
  }

  function _mkSeg(bar, flex, bg) {
    const seg = _el('div', 'proj-seg');
    seg.style.flex       = flex;
    seg.style.background = bg;
    seg.style.boxShadow  = glowShadow(bg);
    bar.appendChild(seg);
  }

  function _mkLegend(container, color, name, val) {
    const item = _el('div', 'proj-legend-item');
    const dot  = _el('span', 'proj-ldot');
    dot.style.background = color;
    dot.style.boxShadow  = glowShadow(color);
    const lname = _el('span', 'proj-lname');
    lname.textContent = name;
    const lval = _el('span', 'proj-lval');
    lval.textContent = val;
    item.append(dot, lname, lval);
    container.appendChild(item);
  }

  // ── Build card skeleton ────────────────────────────────────────────────────
  function _buildCard() {
    _cardEl = document.getElementById('proj-card');
    if (!_cardEl) return false;

    _cardEl.innerHTML = `
      <div class="card-label">
        <span id="proj-card-title">${LANG.projCard}</span>
        <button class="settings-btn" id="proj-settings-btn" type="button">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="2"/>
            <path d="M8 1v2M8 13v2M3 8H1M15 8h-2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>
          </svg>
          <span id="proj-settings-label">${LANG.projSettings}</span>
        </button>
      </div>
      <div id="proj-goal" class="proj-goal-block" hidden></div>
      <div id="proj-result" class="proj-result-wrap"></div>
      <div id="proj-params" class="proj-params"></div>
      <div id="proj-bar"    class="proj-bar-stack" hidden></div>
      <div id="proj-legend" class="proj-legend proj-legend-inline" hidden></div>
    `;

    _goalEl   = document.getElementById('proj-goal');
    _resultEl = document.getElementById('proj-result');
    _paramsEl = document.getElementById('proj-params');
    _barEl    = document.getElementById('proj-bar');
    _legendEl = document.getElementById('proj-legend');

    document.getElementById('proj-settings-btn').addEventListener('click', _openModal);
    return true;
  }

  // ── Modal state ────────────────────────────────────────────────────────────
  let _backdropEl        = null;
  let _calEl             = null;   // .proj-cal-inline inside current modal
  let _calTriggerBtn     = null;   // the trigger button, needed for cleanup
  let _calOutsideHandler = null;   // mousedown listener for click-outside-calendar
  let _calViewYear, _calViewMonth;

  const _escHandler = (e) => { if (e.key === 'Escape') _closeModal(); };

  function _openModal() {
    _buildModal();
    _backdropEl.style.display = 'flex';
    document.addEventListener('keydown', _escHandler);
  }

  function _closeModal() {
    if (!_backdropEl) return;
    _collapseCalendar();               // clean up any open calendar + its listener
    _backdropEl.style.display = 'none';
    document.removeEventListener('keydown', _escHandler);
  }

  // Open the inline calendar and register a document mousedown handler so that
  // clicking anywhere outside the trigger row + calendar panel collapses it.
  function _openCalendar() {
    if (!_calEl) return;
    _calEl.hidden = false;
    if (_calTriggerBtn) _calTriggerBtn.classList.add('active');

    _calOutsideHandler = (e) => {
      if (!_calEl || _calEl.hidden) return;
      const trigRow = _calTriggerBtn && _calTriggerBtn.closest('.proj-cal-trigger-row');
      const insideCal     = _calEl.contains(e.target);
      const insideTrigger = trigRow && trigRow.contains(e.target);
      if (!insideCal && !insideTrigger) _collapseCalendar();
    };
    // Use setTimeout so this mousedown doesn't immediately fire for the
    // same click that opened the calendar.
    setTimeout(() => document.addEventListener('mousedown', _calOutsideHandler), 0);
  }

  function _collapseCalendar() {
    if (_calEl) _calEl.hidden = true;
    if (_calTriggerBtn) _calTriggerBtn.classList.remove('active');
    if (_calOutsideHandler) {
      document.removeEventListener('mousedown', _calOutsideHandler);
      _calOutsideHandler = null;
    }
  }

  // Always builds fresh so locale changes are picked up on next open.
  function _buildModal() {
    const old = document.getElementById('proj-modal-backdrop');
    if (old) old.remove();

    const backdrop = _el('div', 'proj-modal-backdrop');
    backdrop.id = 'proj-modal-backdrop';
    backdrop.style.display = 'none';
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) _closeModal(); });

    const modal = _el('div', 'proj-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Header
    const header = _el('div', 'proj-modal-header');
    const titleEl = _el('span', 'proj-modal-title');
    titleEl.textContent = LANG.projSettingsTitle;
    const closeBtn = _el('button', 'proj-modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg>';
    closeBtn.addEventListener('click', _closeModal);
    header.append(titleEl, closeBtn);

    const body = _el('div', 'proj-modal-body');
    body.append(_buildDateField(), _buildRateField(), _buildWithdrawalField(), _buildContribField(), _buildTargetField());

    modal.append(header, body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    _backdropEl = backdrop;
  }

  // ── Date field with inline calendar ───────────────────────────────────────
  function _buildDateField() {
    const field = _el('div', 'proj-field');

    const label = _el('div', 'proj-field-label');
    label.textContent = LANG.projTargetDate;
    field.appendChild(label);

    const triggerRow = _el('div', 'proj-cal-trigger-row');

    const triggerBtn = _el('button', 'proj-cal-trigger');
    triggerBtn.type = 'button';
    triggerBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="12" height="12" rx="2"/>
        <path d="M5 1v2M11 1v2M2 7h12"/>
      </svg>
    `;
    const trigLabelEl = _el('span', '');
    trigLabelEl.id = 'proj-cal-trigger-label';
    trigLabelEl.textContent = fmtDate(new Date(S.date));
    triggerBtn.appendChild(trigLabelEl);

    const durEl = _el('span', 'proj-duration');
    durEl.id = 'proj-duration';
    durEl.textContent = _calcDurText(S.date);
    triggerRow.append(triggerBtn, durEl);
    field.appendChild(triggerRow);

    // Inline calendar (collapsed by default)
    const calEl = _el('div', 'proj-cal-inline');
    calEl.hidden = true;
    field.appendChild(calEl);
    _calEl = calEl;

    _calTriggerBtn = triggerBtn;   // store ref for collapse/cleanup

    const selDate = new Date(S.date);
    _calViewYear  = selDate.getFullYear();
    _calViewMonth = selDate.getMonth();
    _renderModalCal();

    triggerBtn.addEventListener('click', () => {
      if (_calEl.hidden) _openCalendar();
      else _collapseCalendar();
    });

    return field;
  }

  function _calcDurText(dateStr) {
    const now = new Date();
    const d   = new Date(dateStr);
    const n   = Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
    return n > 0 ? _durLabel(n) : '';
  }

  // ── Rate field ─────────────────────────────────────────────────────────────
  function _buildRateField() {
    const field = _el('div', 'proj-field');

    const headerRow = _el('div', 'proj-field-label proj-rate-header');
    const labelSpan = _el('span', '');
    labelSpan.textContent = LANG.projReturn;
    const badge = _el('span', 'proj-rate-badge');
    const r = S.rate;
    badge.textContent = (r % 1 === 0 ? r : r.toFixed(1)) + '%';
    headerRow.append(labelSpan, badge);
    field.appendChild(headerRow);

    const sliderWrap = _el('div', 'proj-slider-wrap');
    const tick1 = _el('span', 'proj-slider-tick');
    tick1.textContent = '3%';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'proj-slider';
    slider.min = '3'; slider.max = '20'; slider.step = '0.5';
    slider.value = String(S.rate);
    _syncSliderFill(slider);

    slider.addEventListener('input', () => {
      S.rate = parseFloat(slider.value);
      _syncSliderFill(slider);
      badge.textContent = (S.rate % 1 === 0 ? S.rate : S.rate.toFixed(1)) + '%';
      renderCard();
    });

    const tick2 = _el('span', 'proj-slider-tick');
    tick2.textContent = '20%';
    sliderWrap.append(tick1, slider, tick2);
    field.appendChild(sliderWrap);

    return field;
  }

  function _syncSliderFill(slider) {
    const pct = ((parseFloat(slider.value) - 3) / 17 * 100).toFixed(1);
    slider.style.setProperty('--pct', pct + '%');
  }

  // ── Withdrawal rate field ──────────────────────────────────────────────────
  function _buildWithdrawalField() {
    const field = _el('div', 'proj-field');

    const headerRow = _el('div', 'proj-field-label proj-rate-header');
    const labelSpan = _el('span', '');
    labelSpan.textContent = LANG.projWithdrawal;
    const badge = _el('span', 'proj-rate-badge');
    const wr = S.withdrawalRate;
    badge.textContent = (wr % 1 === 0 ? wr : wr.toFixed(1)) + '%';
    headerRow.append(labelSpan, badge);
    field.appendChild(headerRow);

    const sliderWrap = _el('div', 'proj-slider-wrap');
    const tick1 = _el('span', 'proj-slider-tick');
    tick1.textContent = '1%';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'proj-slider';
    slider.min = '1'; slider.max = '10'; slider.step = '0.5';
    slider.value = String(S.withdrawalRate);
    _syncWRFill(slider);

    slider.addEventListener('input', () => {
      S.withdrawalRate = parseFloat(slider.value);
      _syncWRFill(slider);
      badge.textContent = (S.withdrawalRate % 1 === 0 ? S.withdrawalRate : S.withdrawalRate.toFixed(1)) + '%';
      renderCard();
    });

    const tick2 = _el('span', 'proj-slider-tick');
    tick2.textContent = '10%';
    sliderWrap.append(tick1, slider, tick2);
    field.appendChild(sliderWrap);

    return field;
  }

  function _syncWRFill(slider) {
    const pct = ((parseFloat(slider.value) - 1) / 9 * 100).toFixed(1);
    slider.style.setProperty('--pct', pct + '%');
  }

  // ── Contributions field ────────────────────────────────────────────────────
  function _buildContribField() {
    const field = _el('div', 'proj-field');

    const toggleRow = _el('div', 'proj-toggle-row');
    const labelSpan = _el('span', 'proj-field-label');
    labelSpan.textContent = LANG.projContribsToggle;
    const toggle = _el('button', 'proj-toggle' + (S.contribOn ? ' on' : ''));
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Toggle monthly contributions');
    const knob = _el('span', 'proj-toggle-knob');
    toggle.appendChild(knob);
    toggleRow.append(labelSpan, toggle);
    field.appendChild(toggleRow);

    const contribRow = _el('div', 'proj-contrib-row');
    contribRow.style.display = S.contribOn ? 'flex' : 'none';

    const numInput = _mkFormattedInput(S.monthly);

    const ccyLabel = _el('span', 'proj-ccy');
    ccyLabel.textContent = LANG.projContribUnit;

    numInput.addEventListener('input', () => {
      S.monthly = _parseInputNum(numInput.value);
      renderCard();
    });

    toggle.addEventListener('click', () => {
      S.contribOn = !S.contribOn;
      toggle.classList.toggle('on', S.contribOn);
      contribRow.style.display = S.contribOn ? 'flex' : 'none';
      renderCard();
    });

    contribRow.append(numInput, ccyLabel);
    field.appendChild(contribRow);

    return field;
  }

  // ── Target amount field ────────────────────────────────────────────────────
  function _buildTargetField() {
    const field = _el('div', 'proj-field');

    const toggleRow = _el('div', 'proj-toggle-row');
    const labelSpan = _el('span', 'proj-field-label');
    labelSpan.textContent = LANG.projTargetToggle;
    const toggle = _el('button', 'proj-toggle' + (S.targetOn ? ' on' : ''));
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Toggle target amount');
    const knob = _el('span', 'proj-toggle-knob');
    toggle.appendChild(knob);
    toggleRow.append(labelSpan, toggle);
    field.appendChild(toggleRow);

    const targetRow = _el('div', 'proj-contrib-row');
    targetRow.style.display = S.targetOn ? 'flex' : 'none';

    const numInput = _mkFormattedInput(S.targetAmount);

    const ccyLabel = _el('span', 'proj-ccy');
    ccyLabel.textContent = LANG.projTargetUnit;

    numInput.addEventListener('input', () => {
      S.targetAmount = _parseInputNum(numInput.value);
      renderCard();
    });

    toggle.addEventListener('click', () => {
      S.targetOn = !S.targetOn;
      toggle.classList.toggle('on', S.targetOn);
      targetRow.style.display = S.targetOn ? 'flex' : 'none';
      renderCard();
    });

    targetRow.append(numInput, ccyLabel);
    field.appendChild(targetRow);

    return field;
  }

  // ── Inline calendar rendering ──────────────────────────────────────────────
  function _renderModalCal() {
    if (!_calEl) return;
    const todayStr = _ymd(new Date());
    const selStr   = S.date;

    _calEl.innerHTML = '';

    // Month navigation header (reuses .cal-head, .cal-title from app CSS)
    const head = _el('div', 'cal-head');

    const prev = _el('button', '');
    prev.type = 'button';
    prev.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5L4 6l3.5 3.5"/></svg>';
    prev.title = LANG.calPrev;
    const today = new Date();
    const viewFirst = new Date(_calViewYear, _calViewMonth, 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (viewFirst <= thisMonth) prev.disabled = true;
    prev.addEventListener('click', () => {
      if (_calViewMonth === 0) { _calViewMonth = 11; _calViewYear--; }
      else _calViewMonth--;
      _renderModalCal();
    });

    const titleEl = _el('div', 'cal-title');
    titleEl.textContent = LANG.calMonths[_calViewMonth] + ' ' + _calViewYear;

    const next = _el('button', '');
    next.type = 'button';
    next.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>';
    next.title = LANG.calNext;
    next.addEventListener('click', () => {
      if (_calViewMonth === 11) { _calViewMonth = 0; _calViewYear++; }
      else _calViewMonth++;
      _renderModalCal();
    });

    head.append(prev, titleEl, next);
    _calEl.appendChild(head);

    // Day-of-week row + 42 day cells (Monday-first)
    const grid = _el('div', 'cal-grid');
    LANG.calDow.forEach(dw => {
      const dow = _el('div', 'cal-dow');
      dow.textContent = dw;
      grid.appendChild(dow);
    });

    const firstOfMonth = new Date(_calViewYear, _calViewMonth, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // Mon=0
    const gridStart = new Date(_calViewYear, _calViewMonth, 1 - offset);

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = _ymd(d);
      const isCurrentMonth = d.getMonth() === _calViewMonth && d.getFullYear() === _calViewYear;
      const isPast     = key < todayStr;
      const isSelected = key === selStr;

      const cell = _el('button', 'cal-day');
      cell.type = 'button';
      if (!isCurrentMonth) cell.classList.add('other-month');
      if (isSelected)      cell.classList.add('active');
      if (!isPast)         cell.classList.add('has-entry'); // enables hover style
      cell.textContent = d.getDate();
      cell.disabled = isPast;

      if (!isPast) {
        const captured = new Date(d); // avoid closure over loop var
        cell.addEventListener('click', () => {
          S.date = key;
          _calViewYear  = captured.getFullYear();
          _calViewMonth = captured.getMonth();

          // Update trigger label + duration text
          const lblEl = document.getElementById('proj-cal-trigger-label');
          if (lblEl) lblEl.textContent = fmtDate(captured);
          const durEl = document.getElementById('proj-duration');
          if (durEl) durEl.textContent = _calcDurText(key);

          _renderModalCal();
          renderCard();
          _collapseCalendar(); // close calendar after a date is picked
        });
      }

      grid.appendChild(cell);
    }

    _calEl.appendChild(grid);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function _init() {
    if (!_buildCard()) return;
    renderCard();
  }

  // Receive current portfolio total after each render
  document.addEventListener('wl:render', (e) => {
    const prev = _currentTotal;
    _currentTotal = (e.detail && e.detail.totalCzk) || 0;
    if (prev === 0) _prevFV = 0; // start animation from zero on first load
    renderCard();
  });

  // Re-render card text + rebuild modal if open when locale changes
  document.addEventListener('wl:locale-change', () => {
    const titleEl = document.getElementById('proj-card-title');
    if (titleEl) titleEl.textContent = LANG.projCard;
    const settingsLabel = document.getElementById('proj-settings-label');
    if (settingsLabel) settingsLabel.textContent = LANG.projSettings;

    renderCard();

    if (_backdropEl && !_backdropEl.hidden) {
      _buildModal();
      _backdropEl.hidden = false;
      document.addEventListener('keydown', _escHandler);
    }
  });

  _init();
})();
