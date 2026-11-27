/**
 * ORE Dashboard Filters, settings presentation refinement for OJS 3.6.
 * Presentation only: does not intercept Save, change flag IDs, or write API data.
 * Intended to load as a backend asset from the existing oreDashboardFilters plugin.
 */
(function () {
  'use strict';
  // The settings modal may load this bundle again each time it opens.
  if (window.ORESettingsRefinementV6) { window.ORESettingsRefinementV6.refresh(); return; }
  const NS = 'ore-settings-v6';
  const STYLE_ID = `${NS}-style`;
  const FIELD_NAMES = ['Full name', 'Short label'];
  const SECTION_DESCRIPTIONS = {
    'Available dashboard filters': 'Choose which filters are available to editors. These options do not change the submissions themselves.',
    'Additional dashboard columns': 'Choose the information available in the submission list. Compact mode can place details beneath the title instead of adding extra width.',
    'Dashboard appearance': 'Control how much information appears in each row. Select Save dashboard appearance to apply these settings.',
    'Role access': 'Decide which roles can view filters, see flags or edit flag assignments.',
    'Role permissions': 'Decide which roles can view filters, see flags or edit flag assignments.'
  };
  let scheduled = false;
  let observer;
  let frameCount = 0;
  const safeText = value => String(value == null ? '' : value).trim();
  const textEquals = (el, value) => safeText(el?.textContent).replace(/\s+/g, ' ').toLowerCase() === value.toLowerCase();
  const create = (tag, cls, content) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  };
  function isVisible(el) {
    if (!el?.isConnected) return false;
    if (!el.getClientRects().length) return false;
    const computed = getComputedStyle(el);
    return computed.display !== 'none' && computed.visibility !== 'hidden';
  }
  function hasSettingsTitle() {
    return Array.from(document.querySelectorAll('h1,h2,h3,.pkpFormTitle,[role="heading"],.pkpModal__title,.modal-title,.pkpModal__header'))
      .some(el => textEquals(el, 'ORE Dashboard Filters'));
  }
  function settingsContext() {
    if (!hasSettingsTitle()) return false;
    // Do not change dashboard rendering, publication forms, or unrelated plugins.
    return !!Array.from(document.querySelectorAll('h2,h3,h4,h5,strong,legend'))
      .find(el => textEquals(el, 'Dashboard appearance') || textEquals(el, 'Available dashboard filters'))
      || document.body.textContent.includes('Enabled in dropdown')
      || document.body.textContent.includes('Choose icon');
  }
  function findHeadings() {
    const names = Object.keys(SECTION_DESCRIPTIONS);
    return Array.from(document.querySelectorAll('h2,h3,h4,h5,legend,strong,.pkpForm__title,.pkpFormField__heading'))
      .filter(el => names.some(name => textEquals(el, name)) && isVisible(el))
      .filter(el => !el.closest(`.${NS}-helper`));
  }
  function decorateSectionHeadings() {
    for (const heading of findHeadings()) {
      heading.classList.add(`${NS}-heading`);
      if (!heading.id) heading.id = `${NS}-${heading.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (!heading.nextElementSibling?.classList.contains(`${NS}-hint`)) {
        const desc = SECTION_DESCRIPTIONS[heading.textContent.trim()];
        if (desc) {
          const hint = create('p', `${NS}-hint`, desc);
          heading.insertAdjacentElement('afterend', hint);
        }
      }
    }
    const appearance = Array.from(document.querySelectorAll('label,span,div'))
      .filter(el => el.childElementCount === 0 && textEquals(el, 'Flag display'));
    for (const el of appearance) {
      const parent = el.parentElement;
      if (!parent || parent.querySelector(`.${NS}-flag-display-hint`)) continue;
      const hint = create('div', `${NS}-flag-display-hint ${NS}-helper`,
        'Icon only shows the symbol; Icon + short label uses the Short label field; Icon + full name uses the Full name field. Menus always use full names.');
      // Append to the same field group without replacing or moving the existing control.
      parent.appendChild(hint);
    }
  }
  function isChooseIcon(el) {
    const text = safeText(el.textContent).replace(/\s+/g, ' ');
    return /^\s*(?:▸|▶|►|\u25b8)?\s*Choose icon\s*$/i.test(text) || text === 'Choose icon';
  }
  function findChooseLinks() {
    return Array.from(document.querySelectorAll('button,a,summary,span'))
      .filter(el => isVisible(el) && isChooseIcon(el))
      .filter(el => !Array.from(el.children).some(child => isChooseIcon(child)));
  }
  function cardCandidate(link) {
    for (let node = link.parentElement, depth = 0; node && depth < 9; node = node.parentElement, depth++) {
      const inputs = Array.from(node.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]):not([type="color"]),textarea'));
      const textInputs = inputs.filter(el => el.matches('input[type="text"],input:not([type]),textarea'));
      const chooseCount = Array.from(node.querySelectorAll('button,a,summary,span'))
        .filter(isChooseIcon).filter(el => !Array.from(el.children).some(isChooseIcon)).length;
      const hasRemove = Array.from(node.querySelectorAll('button')).some(el => textEquals(el, 'Remove'));
      if (textInputs.length >= 2 && textInputs.length <= 4 && chooseCount === 1 && hasRemove) return node;
    }
    return null;
  }
  function flagNameInputs(card) {
    const all = Array.from(card.querySelectorAll('input,textarea'))
      .filter(el => el.matches('input[type="text"],input:not([type]),textarea'))
      .filter(el => !/^#[a-f\d]{3,8}$/i.test(safeText(el.value)) &&
        !/colou?r|hex/i.test(`${el.name || ''} ${el.id || ''}`));
    return all.slice(0, 2);
  }
  function pickColour(card) {
    const colorInput = card.querySelector('input[type="color"]');
    const hex = Array.from(card.querySelectorAll('input[type="text"],input:not([type])'))
      .find(el => /^#[a-f\d]{3,8}$/i.test(safeText(el.value)));
    const candidates = [colorInput?.value, hex?.value];
    for (const value of candidates) {
      if (/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value || '')) return value;
    }
    return '#2c5777';
  }
  function addFieldHint(input, name, message) {
    if (!input) return;
    input.setAttribute('aria-label', name);
    input.setAttribute('title', message);
    input.dataset.oreSettingsV6Field = name.toLowerCase().replace(/\s+/g, '-');
  }
  function flagCards() {
    const seen = new Set();
    const cards = [];
    for (const link of findChooseLinks()) {
      const card = cardCandidate(link);
      if (card && !seen.has(card)) { cards.push(card); seen.add(card); }
    }
    return cards;
  }
  function createFlagLegend(card, index) {
    const legend = create('div', `${NS}-flag-legend ${NS}-helper`);
    legend.dataset.oreSettingsV6Legend = 'true';
    const number = create('span', `${NS}-number`, `FLAG ${String(index + 1).padStart(2, '0')}`);
    const name = create('strong', `${NS}-card-name`, 'Flag');
    const preview = create('span', `${NS}-live-preview`);
    const swatch = create('span', `${NS}-preview-swatch`);
    swatch.setAttribute('aria-hidden', 'true');
    const previewText = create('span', `${NS}-preview-text`);
    preview.append(swatch, previewText);
    legend.append(number, name, preview);
    return legend;
  }
  function createFlagHelp(card) {
    const hint = create('div', `${NS}-flag-key ${NS}-helper`);
    hint.innerHTML = '<span><b>Full name</b><small>Dropdowns &amp; hover help</small></span>' +
      '<span><b>Short label</b><small>Compact dashboard</small></span>' +
      '<span><b>Icon</b><small>Visual indicator</small></span>' +
      '<span><b>Visibility</b><small>Available for selection</small></span>' +
      '<span><b>Colour</b><small>Flag appearance</small></span>';
    return hint;
  }
  function decorateCard(card, index) {
    card.classList.add(`${NS}-flag-card`);
    card.dataset.oreSettingsV6Card = String(index + 1);
    const [nameInput, shortInput] = flagNameInputs(card);
    if (!nameInput || !shortInput) return;
    addFieldHint(nameInput, 'Full flag name', 'Full name: shown in the flag dropdown and detailed hover panel. Example: Needs checking.');
    addFieldHint(shortInput, 'Short flag label', 'Short label: shown next to the icon when compact display is selected. Example: Check.');
    const checkbox = card.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.title = 'When enabled, this flag can be selected for new assignments.';
    const colourControl = Array.from(card.querySelectorAll('input[type="text"],input:not([type])'))
      .find(el => /^#[a-f\d]{3,8}$/i.test(safeText(el.value)));
    if (colourControl) colourControl.title = 'Flag colour as a hexadecimal value, for example #178346.';
    if (!card.querySelector(`[data-ore-settings-v6-legend="true"]`)) {
      card.prepend(createFlagLegend(card, index), createFlagHelp(card));
    }
    const name = safeText(nameInput.value) || 'Unnamed flag';
    const short = safeText(shortInput.value) || name;
    const colour = pickColour(card);
    const title = card.querySelector(`.${NS}-card-name`);
    const preview = card.querySelector(`.${NS}-preview-text`);
    if (title && title.textContent !== name) title.textContent = name;
    if (preview) { const display = `Full: ${name}   ·   Short: ${short}`; if (preview.textContent !== display) preview.textContent = display; }
    card.style.setProperty('--ore-settings-v6-colour', colour);
    const num = card.querySelector(`.${NS}-number`);
    if (num) num.textContent = `FLAG ${String(index + 1).padStart(2,'0')}`;
  }
  function addIntro(cards) {
    if (!cards.length) return;
    const first = cards[0];
    if (document.getElementById(`${NS}-intro`)) return;
    const intro = create('section', `${NS}-intro ${NS}-helper`);
    intro.id = `${NS}-intro`;
    const h = create('h3', '', 'Flag definitions');
    const desc = create('p', '', 'Use the full name to identify a flag in menus and help panels. Use the short label to keep the dashboard compact. Both names belong to the same flag, so changing them does not change its assignment.');
    const nav = create('nav', `${NS}-nav`);
    nav.setAttribute('aria-label', 'Dashboard Filters settings sections');
    const sections = [
      ['Flags', () => intro],
      ['Filters', () => findHeadings().find(el => textEquals(el, 'Available dashboard filters'))],
      ['Columns', () => findHeadings().find(el => textEquals(el, 'Additional dashboard columns'))],
      ['Appearance', () => findHeadings().find(el => textEquals(el, 'Dashboard appearance'))],
      ['Roles', () => findHeadings().find(el => /role (access|permissions)/i.test(safeText(el.textContent)))],
    ];
    for (const [name, findTarget] of sections) {
      const target = findTarget();
      if (!target && name !== 'Flags') continue;
      const control = create('button', '', name);
      control.type = 'button';
      control.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        findTarget()?.scrollIntoView({block:'start', behavior:'smooth'});
      });
      nav.appendChild(control);
    }
    const example = create('div', `${NS}-example`);
    const full = create('div', `${NS}-example-cell`);
    full.append(create('b', '', 'Full name'), create('span', '', 'Needs checking'));
    const short = create('div', `${NS}-example-cell`);
    short.append(create('b', '', 'Short label'), create('span', '', 'Check'));
    const usage = create('div', `${NS}-example-cell`);
    usage.append(create('b', '', 'Display example'), create('span', '', '◉  Check'));
    example.append(full, short, usage);
    intro.append(h, desc, example, nav);
    first.parentElement.insertBefore(intro, first);
  }
  function apply() {
    if (!settingsContext()) return;
    installStyle();
    decorateSectionHeadings();
    const cards = flagCards();
    addIntro(cards);
    cards.forEach(decorateCard);
    // Add semantic labels to any settings control with ambiguous caption.
    const appearanceHeading = findHeadings().find(el => textEquals(el, 'Dashboard appearance'));
    if (appearanceHeading) appearanceHeading.setAttribute('aria-label', 'Dashboard appearance and density');
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  }
  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = create('style', '');
    style.id = STYLE_ID;
    style.textContent = `
      .${NS}-intro { background:#f5f8fc; border:1px solid #cad6e3; border-radius:8px; padding:16px 18px; margin:16px 0 14px; color:#1d3853; }
      .${NS}-intro h3 { font-size:17px; line-height:1.3; margin:0 0 5px; font-weight:700; }
      .${NS}-intro p { font-size:13px; line-height:1.55; margin:0 0 12px; max-width:72em; }
      .${NS}-example { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
      .${NS}-example-cell { min-width:0; background:white; border:1px solid #d6e0ea; border-radius:6px; padding:9px 11px; display:flex; flex-direction:column; gap:4px; }
      .${NS}-example-cell b { color:#586b83; font-size:11px; font-weight:700; }
      .${NS}-example-cell span { color:#123a5a; font-size:13px; font-weight:600; }
      .${NS}-nav { display:flex; flex-wrap:wrap; gap:7px; margin-top:13px; padding-top:12px; border-top:1px solid #dce5ee; }
      .${NS}-nav button { border:1px solid #bdcfdd; border-radius:999px; background:#fff; color:#155279; padding:5px 12px; font:600 11px/1.4 inherit; cursor:pointer; }
      .${NS}-nav button:hover, .${NS}-nav button:focus-visible { background:#e4f0fa; outline-offset:2px; }
      .${NS}-heading { scroll-margin-top:24px; }
      .${NS}-flag-card { box-sizing:border-box; border:1px solid #d4dfe9 !important; border-left:3px solid var(--ore-settings-v6-colour,#335d7f) !important; background:#fff; border-radius:8px !important; margin-bottom:12px !important; padding:13px 14px !important; box-shadow:0 1px 2px rgba(10,34,55,.04); }
      .${NS}-flag-legend { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 10px; padding-bottom:10px; border-bottom:1px solid #e7edf3; min-height:22px; }
      .${NS}-number { color:#65788b; font-size:10px; font-weight:700; letter-spacing:.1em; }
      .${NS}-card-name { color:#173b54; font-size:14px; line-height:1.4; }
      .${NS}-live-preview { display:inline-flex; flex-wrap:wrap; align-items:center; gap:6px; margin-left:auto; font-size:11px; color:#3c5164; max-width:100%; }
      .${NS}-preview-swatch { flex:none; width:11px; height:11px; border-radius:3px; background:var(--ore-settings-v6-colour); box-shadow:0 0 0 1px rgba(0,0,0,.09); }
      .${NS}-preview-text { overflow-wrap:anywhere; }
      .${NS}-flag-key { display:grid; grid-template-columns:1.13fr 1.13fr 1fr 1fr .9fr; gap:9px; margin:0 0 9px; padding:0 3px; }
      .${NS}-flag-key > span { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .${NS}-flag-key b { color:#203e56; font-size:11px; font-weight:700; }
      .${NS}-flag-key small { font-size:10px; line-height:1.25; color:#66788b; }
      .${NS}-flag-card input[type="text"], .${NS}-flag-card select { max-width:100%; }
      .${NS}-flag-card button { border-radius:5px; }
      .${NS}-heading { font-size:16px !important; line-height:1.4 !important; font-weight:700 !important; color:#173d56 !important; border-top:1px solid #dae3ec; padding-top:20px !important; margin-top:25px !important; margin-bottom:5px !important; }
      .${NS}-hint { font-size:12px; line-height:1.55; color:#60758b; margin:3px 0 13px; max-width:72em; }
      .${NS}-flag-display-hint { font-size:11px; line-height:1.5; color:#66788b; margin:6px 0 0; max-width:38em; }
      @media(max-width:760px) { .${NS}-example { grid-template-columns:1fr; } .${NS}-flag-key { grid-template-columns:repeat(2,minmax(0,1fr)); row-gap:8px; } .${NS}-live-preview { margin-left:0; flex-basis:100%; } }
    `;
    document.head.appendChild(style);
  }
  function init() {
    // OJS opens Settings in an AJAX modal; wait for it and re-apply to new content.
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList:true,subtree:true});
    document.addEventListener('input', ev => {
      if (ev.target?.closest?.(`.${NS}-flag-card`)) schedule();
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target?.closest?.(`.${NS}-flag-card`)) schedule();
    }, true);
    window.addEventListener('resize', schedule, {passive:true});
    apply();
    window.ORESettingsRefinementV6 = {
      refresh: schedule,
      report() { return {active: settingsContext(), cards: flagCards().length, sections: findHeadings().length, styleLoaded: !!document.getElementById(STYLE_ID)}; }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
