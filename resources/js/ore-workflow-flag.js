/**
 * ORE Dashboard Filters: editorial flag inside the OJS workflow drawer.
 * Copyright (c) 2026 Anthony Finnerty. GPL-3.0-only.
 */
(() => {
  'use strict';
  if (window.__oreWorkflowFlagMounted) return;
  // Bundled with the dashboard; only run when the user may see flags and
  // the journal shows them in the workflow.
  const initialConfig = window.oreDashboardFiltersV3Config;
  if (initialConfig?.access?.viewFlags !== true ||
      initialConfig.appearance?.showWorkflowFlag === false) return;
  window.__oreWorkflowFlagMounted = true;

  let activeId = null;
  let loadedId = null;
  let pendingId = null;
  let requestToken = 0;
  let flagData = null;
  let retryAfter = 0;
  let lastError = '';
  let scheduled = false;
  let timer = null;

  function workflowId() {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get('workflowSubmissionId');
      if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null;
      const id = Number(raw);
      return Number.isSafeInteger(id) ? id : null;
    } catch (_) {
      return null;
    }
  }

  function config() {
    // OJS scripts and the workflow drawer are mounted independently. Never
    // cache configuration before the inline dashboard config is available.
    const cfg = window.oreDashboardFiltersV3Config;
    if (!cfg || !cfg.access || !cfg.flagsApiUrl) return null;
    if (cfg.access.viewFlags !== true || cfg.appearance?.showWorkflowFlag === false) return null;
    return cfg;
  }

  function removeBadges(except = null) {
    document.querySelectorAll('[data-ore-workflow-flag]').forEach(el => {
      if (el !== except) el.remove();
    });
  }

  function visible(element) {
    if (!element?.isConnected || !element.getClientRects().length) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function chooseContainer(element) {
    // OJS 3.6 renders Publication controls in two separate flex items:
    // left for submission language/version, right for actions (for example,
    // Schedule for Publication). The former absolute positioning could climb
    // to the shared container and overlap buttons in the right-hand item.
    // Place the badge IN FLOW within the language component instead.
    const publicationLeft = element.closest('[data-cy="workflow-controls-left"]');
    if (publicationLeft) {
      const languageLine = element.parentElement;
      return {element: languageLine && publicationLeft.contains(languageLine)
        ? languageLine : publicationLeft, inline: true};
    }

    let parent = element;
    // Use the actual submission-language row when it is available. In the OJS
    // workflow drawer the row expands across the main content pane, but it is
    // not guaranteed to have the same markup as the test fixture.
    for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
      if (!visible(parent)) continue;
      const rect = parent.getBoundingClientRect();
      if (rect.width >= 360 && rect.height >= 24 && rect.height <= 155) {
        return {element: parent, inline: false};
      }
    }
    // Fallback: place the label directly after the language field rather than
    // silently failing when the workflow theme has narrower markup.
    return {element: element.parentElement || element, inline: true};
  }

  function findTarget() {
    if (!document.body) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const text = textNode.nodeValue?.replace(/\s+/g, ' ').trim() || '';
      if (!/current\s+submission\s+language\s*:/i.test(text) || text.length > 130) continue;
      const element = textNode.parentElement;
      if (!visible(element) || element.closest('[data-ore-workflow-flag]')) continue;
      return chooseContainer(element);
    }
    // On some OJS themes the language label is omitted or translated. Use
    // the workflow-stage heading, not the main dashboard header, as a visible
    // fallback. Only a submission opened with workflowSubmissionId is eligible.
    const headings = document.querySelectorAll('h1,h2,h3,h4,[role="heading"]');
    for (const heading of headings) {
      if (!visible(heading)) continue;
      if (/^\s*workflow\s*:/i.test(heading.textContent || '')) {
        return {element: heading, inline: true};
      }
    }
    return null;
  }

  function flagIcon(name, colour) {
    if (window.oreDashboardFlagIcons?.svg) {
      return window.oreDashboardFlagIcons.svg(name, 16, colour);
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({
      viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none',
      stroke: colour, 'stroke-width': '2', 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'aria-hidden': 'true',
    })) svg.setAttribute(key, value);
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', 'M4 22V4m0 0c4-3 8 3 12 0v12c-4 3-8-3-12 0');
    svg.append(shape);
    return svg;
  }

  function ensureStyles() {
    if (document.getElementById('ore-workflow-flag-styles')) return;
    const sheet = document.createElement('style');
    sheet.id = 'ore-workflow-flag-styles';
    sheet.textContent = `
      .ore-workflow-flag-badge {display:inline-flex;align-items:center;gap:6px;
        padding:5px 9px;font-size:13px;font-weight:600;line-height:1.4;
        color:var(--ore-workflow-flag-color,#64748b);background:#fff;
        border:1px solid currentColor;border-radius:6px;white-space:nowrap;
        max-width:min(44%,360px);overflow:hidden;text-overflow:ellipsis;z-index:3;}
      .ore-workflow-flag-badge svg{flex-shrink:0;}
      .ore-workflow-flag-badge span{overflow:hidden;text-overflow:ellipsis;}
      .ore-workflow-flag-badge select {border:0;background:transparent;outline-offset:2px;
        color:inherit;font:inherit;font-weight:600;cursor:pointer;max-width:210px;
        min-width:74px;padding:0 4px;}
      .ore-workflow-flag-badge select:disabled {cursor:wait;opacity:.65;}
      .ore-workflow-flag-error {color:#b4232a;font-size:12px;margin-left:8px;}

      .ore-workflow-flag-badge.ore-workflow-flag-absolute {position:absolute;
        top:50%;right:12px;transform:translateY(-50%);}
      .ore-workflow-flag-badge.ore-workflow-flag-inline {position:relative;
        display:inline-flex;margin-left:16px;vertical-align:middle;transform:none;
        max-width:calc(100% - 24px);}
      @media(max-width:800px){
        .ore-workflow-flag-badge{max-width:100%;}
        .ore-workflow-flag-badge.ore-workflow-flag-absolute{position:static;
          transform:none;margin:8px 0 0 12px;}
      }
    `;
    (document.head || document.documentElement).append(sheet);
  }

  function paint() {
    const id = workflowId();
    if (!id || !config() || !flagData || loadedId !== id) {
      removeBadges();
      return;
    }
    const target = findTarget();
    if (!target) return; // OJS hasn't mounted the workflow drawer yet.
    const def = flagData.definitions.find(item => String(item.id) === flagData.key);
    const colour = /^#[0-9a-f]{6}$/i.test(def?.color || '') ? def.color : '#64748b';
    const label = def?.label || 'No flag';
    // The journal's editFlags capability controls whether the editor is shown.
    // The POST endpoint independently authorises the particular submission.
    // `editableIds` from a bulk GET is a UI hint, not an additional gate.
    const editable = config()?.access?.editFlags === true;
    const existing = target.element.querySelector('[data-ore-workflow-flag]');
    if (existing && existing.dataset.flagKey === flagData.key &&
        existing.dataset.flagLabel === label &&
        existing.dataset.editable === String(editable) &&
        existing.dataset.inline === String(target.inline)) {
      removeBadges(existing);
      return;
    }
    removeBadges();
    ensureStyles();
    const badge = document.createElement(editable ? 'div' : 'span');
    badge.dataset.oreWorkflowFlag = '1';
    badge.dataset.editable = String(editable);
    badge.dataset.flagKey = flagData.key;
    badge.dataset.flagLabel = label;
    badge.dataset.inline = String(target.inline);
    badge.setAttribute('aria-label', `Submission flag: ${label}`);
    badge.className = 'ore-workflow-flag-badge ' +
      (target.inline ? 'ore-workflow-flag-inline' : 'ore-workflow-flag-absolute');
    badge.style.setProperty('--ore-workflow-flag-color', colour);
    badge.append(flagIcon(def?.icon || 'flag', colour));
    if (editable) {
      const caption = document.createElement('span');
      caption.textContent = 'Flag:';
      badge.append(caption);
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Change flag for submission ${id}`);
      const definitions = [{id: '', label: 'No flag', enabled: true},
        ...flagData.definitions.filter(item => item.enabled !== false || item.id === flagData.key)];
      for (const item of definitions) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        select.append(option);
      }
      select.value = flagData.key;
      select.addEventListener('change', () => void saveFlag(id, select));
      badge.append(select);
    } else {
      const caption = document.createElement('span');
      caption.textContent = `Flag: ${label}`;
      badge.append(caption);
    }
    if (!target.inline && window.getComputedStyle(target.element).position === 'static') {
      target.element.style.position = 'relative';
    }
    target.element.append(badge);
  }

  // Uses the same endpoint and CSRF token as the dashboard flag selector.
  // The server independently checks editFlags and this submission assignment.
  async function saveFlag(id, select) {
    const cfg = config();
    if (!cfg?.access?.editFlags || loadedId !== id ||
        workflowId() !== id || select.disabled) return;
    const previous = flagData.key;
    const next = select.value;
    if (previous === next) return;
    const token = window.pkp?.currentUser?.csrfToken;
    if (!token) {
      select.value = previous;
      showSaveError(select, 'Cannot save: CSRF token unavailable.');
      return;
    }
    select.disabled = true;
    const requestVersion = requestToken;
    try {
      const response = await fetch(cfg.flagsApiUrl.replace(/\/$/, ''), {
        method: 'POST', credentials: 'same-origin',
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json',
          'X-Csrf-Token': token},
        body: JSON.stringify({submissionId: id, flag: next}),
      });
      let data = {};
      try { data = await response.json(); } catch (_) { /* report HTTP status */ }
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (requestVersion !== requestToken || workflowId() !== id) return;
      flagData.key = String(data.flag ?? next);
      // Update the list as well when the workflow is open over the dashboard.
      const dashboard = window.pkp?.registry?.getPiniaStore?.('dashboard');
      if (dashboard?.oreFlags) dashboard.oreFlags[id] = flagData.key;
      removeBadges();
      paint();
    } catch (error) {
      if (requestVersion !== requestToken || workflowId() !== id) return;
      select.value = previous;
      showSaveError(select, `Flag not saved: ${String(error.message || error)}`);
    } finally {
      select.disabled = false;
    }
  }

  function showSaveError(select, message) {
    const badge = select.closest('[data-ore-workflow-flag]');
    if (!badge) return;
    const existing = badge.querySelector('.ore-workflow-flag-error');
    if (existing) existing.remove();
    const error = document.createElement('span');
    error.className = 'ore-workflow-flag-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    badge.append(error);
  }

  async function load(id, cfg) {
    const token = ++requestToken;
    pendingId = id;
    try {
      const base = cfg.flagsApiUrl.replace(/\/$/, '');
      const [flagsResponse, definitionsResponse] = await Promise.all([
        fetch(`${base}?ids=${encodeURIComponent(id)}`, {
          credentials: 'same-origin', headers: {Accept: 'application/json'},
        }),
        fetch(`${base}/definitions`, {
          credentials: 'same-origin', headers: {Accept: 'application/json'},
        }),
      ]);
      if (!flagsResponse.ok || !definitionsResponse.ok) {
        const status = `${flagsResponse.status}/${definitionsResponse.status}`;
        const error = new Error(`Flag endpoint returned HTTP ${status}`);
        error.forbidden = flagsResponse.status === 403 || definitionsResponse.status === 403;
        throw error;
      }
      const [flags, definitions] = await Promise.all([
        flagsResponse.json(), definitionsResponse.json(),
      ]);
      if (token !== requestToken || workflowId() !== id) return;
      if (!flags || typeof flags.flags !== 'object' ||
          !Array.isArray(definitions?.flags)) throw new Error('Unexpected flag API response');
      const key = String(flags.flags?.[id] || '');
      loadedId = id;
      const editable = Array.isArray(flags.editableIds) &&
        flags.editableIds.some(value => Number(value) === id);
      flagData = {key, definitions: definitions.flags, editable};
      retryAfter = 0;
      lastError = '';
      paint();
    } catch (error) {
      if (token !== requestToken) return;
      flagData = null;
      loadedId = null;
      removeBadges();
      const message = String(error?.message || error);
      if (message !== lastError) {
        console.warn('[ORE Dashboard Filters] Workflow flag unavailable:', message);
        lastError = message;
      }
      // Never bypass OJS permissions: an explicit 403 stays hidden until the
      // user reloads or navigates to another submission.
      retryAfter = error?.forbidden ? Number.POSITIVE_INFINITY : Date.now() + 10000;
    } finally {
      if (token === requestToken) pendingId = null;
    }
  }

  function tick() {
    scheduled = false;
    timer = null;
    const id = workflowId();
    const cfg = config();
    if (id !== activeId) {
      activeId = id;
      loadedId = null;
      flagData = null;
      pendingId = null;
      retryAfter = 0;
      lastError = '';
      requestToken++;
      removeBadges();
    }
    if (!id || !cfg) {
      removeBadges();
      return;
    }
    if (loadedId === id) {
      paint();
      return;
    }
    if (pendingId !== id && Date.now() >= retryAfter) void load(id, cfg);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    timer = window.setTimeout(tick, 80);
  }

  function start() {
    if (!document.body) return;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList: true, subtree: true});
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    // OJS uses history.pushState when View opens the workflow drawer. This
    // also checks for late config, data fetch and DOM re-renders.
    window.setInterval(schedule, 850);
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})();
