/*
 * ORE Dashboard Filters v0.3.7: native OJS plugin Settings and flag designer.
 * Copyright (c) 2026 CERN. Original developer: Anthony Finnerty.
 * GPL-3.0-only; see the plugin LICENSE.
 */
(() => {
  'use strict';
  // When the same modal is opened more than once, jQuery may load this asset
  // more than once. Reuse the existing handlers and initialise new modal roots.
  if (typeof window.__oreDashboardNativeSettingsMount === 'function') {
    window.__oreDashboardNativeSettingsMount();
    return;
  }
  const rootSelector = '[data-ore-dashboard-settings]';
  const instances = new WeakMap();
  const palette = [
    ['Green', '#178346'], ['Red', '#b4232a'], ['Orange', '#b86b07'],
    ['Blue', '#2563eb'], ['Purple', '#7c3aed'], ['Teal', '#0d9488'],
    ['Grey', '#64748b'], ['Pink', '#db2777'], ['Yellow', '#ca8a04'],
  ];
  const icons = window.oreDashboardFlagIcons || {names:['flag'],svg:() => document.createTextNode('⚑')};
  const validColour = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);

  function make(tag, attrs = {}, text = null) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') element.className = value;
      else if (key === 'dataset') Object.assign(element.dataset, value);
      else if (key === 'disabled') element.disabled = Boolean(value);
      else if (key === 'value') element.value = value;
      else element.setAttribute(key, value);
    }
    if (text !== null) element.textContent = text;
    return element;
  }

  function status(root, message, kind = '') {
    const target = root.querySelector('[data-ore-status]');
    if (!target) return;
    target.textContent = message;
    target.dataset.kind = kind;
  }

  function actionButton(text, action, index, disabled = false) {
    const btn = make('button', {
      type: 'button', className: 'ore-settings-button',
      dataset: {oreAction: action, index: String(index)}, disabled,
    }, text);
    return btn;
  }

  function rowControl(index, flag, rowsLength, busy) {
    const row = make('div', {
      className: 'ore-settings-row', dataset: {oreRow: String(index)},
      draggable: String(!busy),
    });
    const drag = make('span', {className: 'ore-settings-grip', title: 'Drag to reorder'}, '☰');
    row.append(drag);

    const name = make('input', {
      type: 'text', maxLength: '80', value: flag.label,
      className: 'ore-settings-input', placeholder: 'Flag name',
      'aria-label': `Flag ${index + 1} name`, disabled: busy,
      dataset: {oreField: 'label'},
    });
    row.append(name);
    const short = make('input', {
      type: 'text', maxLength: '20', value: flag.shortLabel || '',
      className: 'ore-settings-input', placeholder: 'Short label (max 20)',
      'aria-label': `Flag ${index+1} short label`, disabled: busy,
      dataset: {oreField: 'shortLabel'},
    });
    row.append(short);

    const iconSection = make('div', {className: 'ore-settings-icon-section'});
    const iconRow = make('div', {className: 'ore-settings-icon-selected'});
    iconRow.append(icons.svg(flag.icon || 'flag', 18, flag.color || '#64748b'));
    iconRow.append(make('span', {}, flag.icon || 'flag'));
    const gallery = make('details', {className: 'ore-icon-gallery'});
    gallery.append(make('summary', {}, 'Choose icon'));
    const search = make('input', {type:'search', className:'ore-settings-input',
      placeholder:'Search icon names', 'aria-label':`Search icons for flag ${index+1}`,
      dataset:{oreIconSearch:String(index)}});
    gallery.append(search);
    const grid=make('div', {className:'ore-icon-grid'});
    for (const icon of icons.names) {
      const b=make('button',{type:'button',className:'ore-icon-choice',
        title:icon, 'aria-label':`Use ${icon} icon`,
        'aria-pressed':String(flag.icon===icon), disabled:busy,
        dataset:{oreAction:'icon',index:String(index),icon}});
      b.append(icons.svg(icon,18),make('span',{},icon.replace(/-/g,' ')));
      grid.append(b);
    }
    gallery.append(grid);
    iconSection.append(iconRow,gallery);
    row.append(iconSection);

    const enabledLabel = make('label',{className:'ore-settings-toggle'});
    const enabled = make('input',{type:'checkbox',disabled:busy,
      dataset:{oreField:'enabled'}});
    enabled.checked=flag.enabled!==false;
    enabledLabel.append(enabled,make('span',{},'Enabled in dropdown'));
    row.append(enabledLabel);

    const colours = make('div', {className: 'ore-settings-colours'});
    const preset = make('select', {
      className: 'ore-settings-input ore-settings-preset',
      'aria-label': `Flag ${index + 1} preset colour`,
      disabled: busy, dataset: {oreField: 'preset'},
    });
    const matchingPreset = palette.find(([, hex]) => hex === flag.color.toLowerCase());
    preset.append(make('option', {value: ''}, 'Custom'));
    for (const [name, hex] of palette) preset.append(make('option', {value: hex}, name));
    preset.value = matchingPreset ? matchingPreset[1] : '';
    colours.append(preset);

    const picker = make('input', {
      type: 'color', value: validColour(flag.color) ? flag.color : '#64748b',
      'aria-label': `Flag ${index + 1} custom colour`,
      disabled: busy, dataset: {oreField: 'picker'},
    });
    colours.append(picker);
    const hex = make('input', {
      type: 'text', value: flag.color, maxLength: '7',
      className: 'ore-settings-input ore-settings-hex',
      'aria-label': `Flag ${index + 1} hex colour`,
      disabled: busy, dataset: {oreField: 'hex'},
    });
    colours.append(hex);
    row.append(colours);

    const operations = make('div', {className: 'ore-settings-operations'});
    operations.append(
      actionButton('↑', 'up', index, busy || index === 0),
      actionButton('↓', 'down', index, busy || index === rowsLength - 1),
      actionButton('Remove', 'remove', index, busy),
    );
    row.append(operations);
    return row;
  }

  function render(root) {
    const state = instances.get(root);
    if (!state) return;
    const list = root.querySelector('[data-ore-rows]');
    list.replaceChildren();
    for (let index = 0; index < state.flags.length; index++) {
      list.append(rowControl(index, state.flags[index], state.flags.length, state.busy));
    }
    root.querySelector('[data-ore-action="add"]').disabled = state.busy || state.flags.length >= 30;
    root.querySelector('[data-ore-action="save"]').disabled = state.busy || !state.flags.length;
    renderPreferences(root, state);
  }

  const fixedRoles = [
    ['siteAdmin', 'Site Administrator'], ['manager', 'Journal Manager'],
  ];
  const roleLabels = [
    ['subEditor', 'Section Editor'], ['assistant', 'Editorial Assistant'],
    ['author', 'Author'], ['reviewer', 'Reviewer'],
    ['reader', 'Reader'], ['subscriptionManager', 'Subscription Manager'],
  ];
  const accessLabels = [
    ['filters', 'Use filters'], ['viewColumns', 'Extra columns'],
    ['viewFlags', 'View flags'], ['editFlags', 'Change flags'],
  ];
  const filterLabels = [
    ['oreVersionStage', 'Publication lifecycle (AO / PMUR / VoR)'],
    ['stageIds', 'Workflow stage'],
    ['oreSubmissionDate', 'Submission date and date range'],
    ['oreSubmissionTime', 'Submission time range'],
    ['oreTaskTitle', 'Editorial task / discussion title'],
    ['oreTaskStatus', 'Task / discussion open or closed'],
    ['oreFlag', 'Filter by submission flag'],
    ['oreSection', 'Section'], ['oreCategory', 'Category'],
  ];
  const columnLabels = [
    ['submitted', 'Submitted date and time'],
    ['lastUpdated', 'Last updated date and time'],
    ['publishingStage', 'Publishing stage (PMUR / VoR)'],
    ['flag', 'Flag column'],
  ];

  function preferenceStatus(root, message, kind = '') {
    const target = root.querySelector('[data-ore-preferences-status]');
    if (target) { target.textContent = message; target.dataset.kind = kind; }
  }

  function toggleControl(group, key, ability, label, checked, busy) {
    const wrapper = make('label', {className: 'ore-settings-toggle'});
    const checkbox = make('input', {type: 'checkbox', disabled: busy,
      dataset: {orePrefsGroup: group, orePrefsKey: key, orePrefsAbility: ability || ''},
    });
    checkbox.checked = !!checked;
    wrapper.append(checkbox, make('span', {}, label));
    return wrapper;
  }

  function renderPreferences(root, state) {
    const section = root.querySelector('[data-ore-preferences]');
    if (!section) return;
    section.replaceChildren();
    const prefs = state.preferences;
    if (!prefs) {
      section.append(make('p', {}, 'Loading role and dashboard settings…'));
      return;
    }
    section.append(make('h3', {}, 'Role permissions'));
    section.append(make('p', {className: 'ore-settings-hint'},
      'Site Administrators and Journal Managers always have full access (fixed). All other journal roles can be configured; access is still limited by native OJS submission permissions.'));
    const heading = make('div', {className: 'ore-role-headings'});
    heading.append(make('strong', {}, 'Editorial role'));
    for (const [, label] of accessLabels) heading.append(make('strong', {}, label));
    section.append(heading);
    for (const [role, label] of fixedRoles) {
      const row = make('div', {className: 'ore-role-row'});
      row.append(make('strong', {}, `${label} (fixed)`));
      for (const [ability, title] of accessLabels) {
        row.append(toggleControl('fixed', role, ability, title, true, true));
      }
      section.append(row);
    }
    for (const [role, label] of roleLabels) {
      const row = make('div', {className: 'ore-role-row'});
      row.append(make('strong', {}, label));
      for (const [ability, title] of accessLabels) {
        row.append(toggleControl('roles', role, ability, title,
          prefs.roles[role][ability], state.busy));
      }
      section.append(row);
    }
    const fixed = make('p', {className: 'ore-settings-hint'},
      'Defaults: Author, Reviewer, Reader and Subscription Manager have no plugin access. Grants do not add editorial-dashboard access; readers and subscription managers can access flags only for published submissions. Enable flag editing for these roles only if you explicitly intend to allow changes to those published records.');
    section.append(fixed);

    function group(title, groupName, options) {
      section.append(make('h3', {}, title));
      const grid = make('div', {className: 'ore-settings-options-grid'});
      for (const [key, label] of options) {
        grid.append(toggleControl(groupName, key, '', label,
          prefs[groupName][key], state.busy));
      }
      section.append(grid);
    }
    group('Available dashboard filters', 'features', filterLabels);
    group('Additional dashboard columns', 'columns', columnLabels);
    renderAppearance(root, state, section);
    section.append(make('p', {className: 'ore-settings-hint'},
      'These options control the plugin additions; native OJS navigation and access rights are unchanged.'));
    const saveButton = make('button', {type: 'button',
      className: 'ore-settings-button ore-settings-primary', disabled: state.busy,
      dataset: {oreAction: 'save-preferences'}}, 'Save permissions and dashboard options');
    section.append(saveButton);
  }

  function renderAppearance(root, state, section) {
    section.append(make('h3', {}, 'Dashboard appearance'));
    const a = state.appearance;
    if (!a) {
      section.append(make('p', {}, 'Loading layout preferences…'));
      return;
    }
    const controls = make('div', {className:'ore-appearance-grid'});
    const selectors = [
      ['layout','Layout',[['compact','Compact (recommended)'],['detailed','Detailed']]],
      ['dateFormat','Displayed updated date',[['short','17 Oct, 23:09'],['full','17 Oct 2026, 23:09']]],
      ['flagDisplay','Flag display',[['short','Icon + short label'],['icon','Icon only'],['full','Icon + full label']]],
    ];
    for(const [key,label,options] of selectors) {
      const wrapper=make('label',{className:'ore-appearance-select'});
      wrapper.append(make('span',{},label));
      const select=make('select',{className:'ore-settings-input',disabled:state.busy,
        dataset:{oreAppearanceKey:key}});
      for(const [value,title] of options) select.append(make('option',{value},title));
      select.value=a[key];
      wrapper.append(select);controls.append(wrapper);
    }
    const optional=[
      ['showSubmitted','Show separate Submitted column in compact mode'],
      ['showPublishingStage','Show separate Publishing stage column in compact mode'],
      ['showEditorialActivity','Show Editorial activity column in compact mode'],
    ];
    for(const [key,label] of optional) {
      const wrapper=make('label',{className:'ore-settings-toggle'});
      const checkbox=make('input',{type:'checkbox',disabled:state.busy,
        dataset:{oreAppearanceKey:key}});
      checkbox.checked=a[key];
      wrapper.append(checkbox,make('span',{},label));controls.append(wrapper);
    }
    section.append(controls,make('p',{className:'ore-settings-hint'},
      'Compact mode keeps Updated sortable, shows the submitted timestamp on hover/focus, and places the publication version beneath the title. Detailed mode uses the existing separate columns.'));
    section.append(make('button',{type:'button',className:'ore-settings-button ore-settings-primary',
      disabled:state.busy,dataset:{oreAction:'save-appearance'}},'Save dashboard appearance'));
  }

  async function requestJSON(url, options = {}) {
    const response = await fetch(url, {credentials: 'same-origin', ...options});
    let json = {};
    try { json = await response.json(); } catch (_ignored) { }
    if (!response.ok) throw new Error(json.errorMessage || json.error || `HTTP ${response.status}`);
    return json;
  }

  async function initialise(root) {
    if (instances.has(root)) return;
    const state = {flags: [], preferences: null, appearance: null, busy: true, dragIndex: null, dirty: false,
      flagsDirty: false, preferencesDirty: false};
    instances.set(root, state);
    render(root);
    try {
      const data = await requestJSON(`${root.dataset.apiUrl}/definitions`);
      if (!Array.isArray(data.flags)) throw new Error('Unexpected response from flag definitions API');
      state.flags = data.flags.map(flag => ({
        id: String(flag.id || ''),
        label: String(flag.label || ''),
        color: String(flag.color || '#64748b').toLowerCase(),
        shortLabel: String(flag.shortLabel || flag.label || '').slice(0,20),
        icon: icons.names.includes(flag.icon) ? flag.icon : 'flag',
        enabled: flag.enabled !== false,
      }));
      status(root, `${state.flags.length} flag definitions loaded.`, 'ok');
    } catch (error) {
      status(root, `Could not load flag settings: ${error.message}`, 'error');
    }
    try {
      const result = await requestJSON(`${root.dataset.apiUrl}/preferences`);
      if (!result.preferences?.roles || !result.preferences?.features || !result.preferences?.columns)
        throw new Error('Unexpected preferences response');
      state.preferences = result.preferences;
      preferenceStatus(root, 'Role permissions and dashboard options loaded.', 'ok');
    } catch (error) {
      preferenceStatus(root, `Could not load role settings: ${error.message}`, 'error');
    }
    try {
      const data = await requestJSON(`${root.dataset.apiUrl}/appearance`);
      if (!data.appearance) throw new Error('Appearance response missing');
      state.appearance = data.appearance;
    } catch(error) {
      preferenceStatus(root, `Could not load appearance: ${error.message}`, 'error');
    } finally {
      state.busy = false;
      render(root);
    }
  }

  function synchroniseColourInputs(row, hex) {
    const picker = row.querySelector('[data-ore-field="picker"]');
    const text = row.querySelector('[data-ore-field="hex"]');
    const select = row.querySelector('[data-ore-field="preset"]');
    text.value = hex;
    if (validColour(hex)) picker.value = hex;
    select.value = palette.some(([, value]) => value === hex) ? hex : '';
  }

  function validate(flags) {
    if (!flags.length || flags.length > 30) return 'Keep between 1 and 30 flags.';
    const names = new Set();
    for (const flag of flags) {
      const name = flag.label.trim();
      if (!name || name.length > 80) return 'Each flag must have a name of 1 to 80 characters.';
      if (!validColour(flag.color)) return 'Each colour must use the #RRGGBB format.';
      if (!flag.shortLabel?.trim() || flag.shortLabel.trim().length > 20) return 'Every flag needs a short label of 1–20 characters.';
      if (!icons.names.includes(flag.icon)) return 'Please choose an icon from the bundled library.';
      if (typeof flag.enabled !== 'boolean') return 'Invalid enabled setting.';
      if (names.has(name.toLocaleLowerCase())) return 'Flag names must be unique.';
      names.add(name.toLocaleLowerCase());
    }
    return null;
  }

  async function save(root) {
    const state = instances.get(root);
    if (!state || state.busy) return;
    const error = validate(state.flags);
    if (error) {
      status(root, error, 'error');
      return;
    }
    const csrf = window.pkp?.currentUser?.csrfToken;
    if (!csrf) {
      status(root, 'Your OJS CSRF token is missing. Reload the settings page.', 'error');
      return;
    }
    state.busy = true;
    render(root);
    status(root, 'Saving…');
    try {
      const data = await requestJSON(`${root.dataset.apiUrl}/definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Csrf-Token': csrf,
          'X-Http-Method-Override': 'PUT',
        },
        body: JSON.stringify({flags: state.flags.map(f => ({
          id: f.id, label: f.label.trim(), color: f.color.toLowerCase(),
          shortLabel: f.shortLabel.trim(), icon: f.icon, enabled: f.enabled,
        }))}),
      });
      if (!Array.isArray(data.flags)) throw new Error('Server returned no flag definitions.');
      state.flags = data.flags.map(f => ({...f}));
      state.flagsDirty = false;
      state.dirty = state.preferencesDirty;
      status(root, 'Flags saved. Reload the editorial dashboard to see the updated list.', 'ok');
    } catch (e) {
      status(root, `Could not save flags: ${e.message}`, 'error');
    } finally {
      state.busy = false;
      render(root);
    }
  }

  async function savePreferences(root) {
    const state = instances.get(root);
    if (!state || state.busy || !state.preferences) return;
    const csrf = window.pkp?.currentUser?.csrfToken;
    if (!csrf) {
      preferenceStatus(root, 'Your OJS session token is missing. Reload the settings window.', 'error');
      return;
    }
    state.busy = true;
    render(root);
    preferenceStatus(root, 'Saving role permissions and dashboard options…');
    try {
      const result = await requestJSON(`${root.dataset.apiUrl}/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'Accept': 'application/json',
          'X-Csrf-Token': csrf, 'X-Http-Method-Override': 'PUT',
        },
        body: JSON.stringify({preferences: state.preferences}),
      });
      if (!result.preferences) throw new Error('Server returned no preferences');
      state.preferences = result.preferences;
      state.preferencesDirty = false;
      state.dirty = state.flagsDirty;
      preferenceStatus(root, 'Saved. Reload the editorial dashboard to apply the new permissions.', 'ok');
    } catch (error) {
      preferenceStatus(root, `Could not save permissions: ${error.message}`, 'error');
    } finally {
      state.busy = false;
      render(root);
    }
  }

  async function saveAppearance(root) {
    const state=instances.get(root);
    if (!state || state.busy || !state.appearance) return;
    const csrf=window.pkp?.currentUser?.csrfToken;
    if (!csrf) { preferenceStatus(root,'Missing CSRF token','error'); return; }
    state.busy=true;
    try {
      const data=await requestJSON(`${root.dataset.apiUrl}/appearance`,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json',
          'X-Csrf-Token':csrf,'X-Http-Method-Override':'PUT'},
        body:JSON.stringify({appearance:state.appearance}),
      });
      state.appearance=data.appearance;
      state.dirty=state.flagsDirty || state.preferencesDirty;
      preferenceStatus(root,'Appearance saved. Refresh the dashboard to apply it.','ok');
    } catch(e) { preferenceStatus(root,`Appearance save failed: ${e.message}`,'error'); }
    finally {state.busy=false;render(root);}
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-ore-action]');
    const root = button?.closest(rootSelector);
    const state = root && instances.get(root);
    if (!button || !state || state.busy) return;
    const action = button.dataset.oreAction;
    const index = Number(button.dataset.index);
    event.preventDefault();
    if (action === 'save') return void save(root);
    if (action === 'save-preferences') return void savePreferences(root);
    if (action === 'save-appearance') return void saveAppearance(root);
    if (action === 'icon' && icons.names.includes(button.dataset.icon) && state.flags[index]) {
      state.flags[index].icon=button.dataset.icon;
      state.flagsDirty=true;state.dirty=true;
      status(root,'Unsaved changes');render(root);return;
    }
    if (action === 'add') {
      state.flags.push({id: '', label: '', shortLabel:'Flag',icon:'flag',enabled:true,color: '#64748b'});
    } else if (action === 'up' && index > 0) {
      [state.flags[index - 1], state.flags[index]] = [state.flags[index], state.flags[index - 1]];
    } else if (action === 'down' && index < state.flags.length - 1) {
      [state.flags[index + 1], state.flags[index]] = [state.flags[index], state.flags[index + 1]];
    } else if (action === 'remove' && index >= 0 && index < state.flags.length) {
      state.flags.splice(index, 1);
    } else {
      return;
    }
    state.flagsDirty = true;
    state.dirty = true;
    status(root, 'Unsaved changes');
    render(root);
  });

  document.addEventListener('input', event => {
    const field = event.target;
    const row = field.closest?.('[data-ore-row]');
    const root = row?.closest(rootSelector);
    const state = root && instances.get(root);
    if (!state || state.busy) return;
    const index = Number(row.dataset.oreRow);
    const flag = state.flags[index];
    if (!flag) return;
    const kind = field.dataset.oreField;
    if (kind === 'label') flag.label = field.value;
    else if (kind === 'shortLabel') flag.shortLabel=field.value;
    else if (kind === 'picker') {
      flag.color = field.value.toLowerCase();
      synchroniseColourInputs(row, flag.color);
    } else if (kind === 'hex') {
      flag.color = field.value;
      if (validColour(flag.color)) synchroniseColourInputs(row, flag.color.toLowerCase());
    } else if (kind === 'enabled') flag.enabled=!!field.checked;
    else return;
    state.flagsDirty = true;
    state.dirty = true;
    status(root, 'Unsaved changes');
  });

  document.addEventListener('change', event => {
    const field = event.target;
    if (field.dataset?.oreAppearanceKey) {
      const root=field.closest(rootSelector);const state=root && instances.get(root);
      if(!state || state.busy || !state.appearance) return;
      const key=field.dataset.oreAppearanceKey;
      if(!(key in state.appearance)) return;
      state.appearance[key]=field.type==='checkbox'?!!field.checked:field.value;
      state.dirty=true;
      preferenceStatus(root,'Unsaved appearance changes');
      return;
    }
    if (field.dataset?.orePrefsGroup) {
      const root = field.closest(rootSelector);
      const state = root && instances.get(root);
      if (!state || state.busy || !state.preferences) return;
      const group = field.dataset.orePrefsGroup;
      const key = field.dataset.orePrefsKey;
      const ability = field.dataset.orePrefsAbility;
      if (group === 'roles' && state.preferences.roles[key] && ability in state.preferences.roles[key]) {
        state.preferences.roles[key][ability] = !!field.checked;
        if (ability === 'viewFlags' && !field.checked) state.preferences.roles[key].editFlags = false;
        if (ability === 'editFlags' && field.checked) state.preferences.roles[key].viewFlags = true;
      } else if ((group === 'features' || group === 'columns') &&
          Object.prototype.hasOwnProperty.call(state.preferences[group], key)) {
        state.preferences[group][key] = !!field.checked;
      } else return;
      state.preferencesDirty = true;
      state.dirty = true;
      preferenceStatus(root, 'Unsaved permissions or dashboard options');
      renderPreferences(root, state);
      return;
    }
    if (field.matches?.('[data-ore-journal]')) {
      const root = field.closest(rootSelector);
      const state = root && instances.get(root);
      if (!state || state.busy || !field.value) return;
      if (state.dirty && !window.confirm('Discard unsaved changes for this journal?')) {
        field.value = root.dataset.apiUrl;
        return;
      }
      root.dataset.apiUrl = field.value;
      instances.delete(root);
      void initialise(root);
      return;
    }
    if (field.dataset.oreField === 'enabled') {
      const row=field.closest('[data-ore-row]');const root=row?.closest(rootSelector);
      const state=root && instances.get(root); if(!state || state.busy) return;
      const flag=state.flags[Number(row.dataset.oreRow)];if(!flag)return;
      flag.enabled=!!field.checked;state.flagsDirty=true;state.dirty=true;
      status(root,'Unsaved changes');return;
    }
    if (field.dataset.oreField !== 'preset') return;
    const row = field.closest('[data-ore-row]');
    const root = row?.closest(rootSelector);
    const state = root && instances.get(root);
    if (!state || state.busy || !field.value) return;
    const index = Number(row.dataset.oreRow);
    if (!state.flags[index]) return;
    state.flags[index].color = field.value;
    synchroniseColourInputs(row, field.value);
    state.flagsDirty = true;
    state.dirty = true;
    status(root, 'Unsaved changes');
  });

  document.addEventListener('input', event => {
    if(!event.target.matches?.('[data-ore-icon-search]'))return;
    const row=event.target.closest('[data-ore-row]');if(!row)return;
    const query=event.target.value.trim().toLowerCase();
    row.querySelectorAll('[data-ore-action="icon"]').forEach(button => {
      button.hidden=!button.dataset.icon.includes(query);
    });
  });

  document.addEventListener('dragstart', event => {
    const row = event.target.closest?.('[data-ore-row]');
    const root = row?.closest(rootSelector);
    const state = root && instances.get(root);
    if (!state || state.busy) return;
    state.dragIndex = Number(row.dataset.oreRow);
    event.dataTransfer?.setData('text/plain', 'ore-flag-order');
  });
  document.addEventListener('dragover', event => {
    if (event.target.closest?.('[data-ore-row]')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    const row = event.target.closest?.('[data-ore-row]');
    const root = row?.closest(rootSelector);
    const state = root && instances.get(root);
    if (!state || state.busy || state.dragIndex === null) return;
    event.preventDefault();
    const target = Number(row.dataset.oreRow);
    const item = state.flags.splice(state.dragIndex, 1)[0];
    state.flags.splice(target, 0, item);
    state.dragIndex = null;
    state.flagsDirty = true;
    state.dirty = true;
    status(root, 'Unsaved changes');
    render(root);
  });
  document.addEventListener('dragend', event => {
    const root = event.target.closest?.(rootSelector);
    const state = root && instances.get(root);
    if (state) state.dragIndex = null;
  });

  function injectStyles() {
    if (document.getElementById('ore-dashboard-native-settings-style')) return;
    const css = `
.ore-dashboard-settings{padding:12px 4px 18px;font-size:14px;color:#24313f;max-width:960px}
.ore-settings-intro{margin:0 0 14px}
.ore-settings-journal-label{display:flex;align-items:center;gap:9px;margin:12px 0;font-weight:600}
.ore-settings-journal-label select{padding:7px;border:1px solid #a8b6c5;border-radius:5px;min-width:170px}
.ore-settings-notice{margin:10px 0;padding:8px 10px;background:#f0f5f9;border-radius:4px}
.ore-settings-notice[data-kind="error"]{background:#fff1f2;color:#9f1239}
.ore-settings-notice[data-kind="ok"]{background:#f0fdf4;color:#166534}
.ore-settings-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0;padding:9px;border:1px solid #d9e1e8;border-radius:6px;background:white}.ore-settings-row>input.ore-settings-input{width:180px;flex:1 1 150px}
.ore-settings-grip{font-size:19px;color:#64748b;cursor:grab;user-select:none}
.ore-settings-input{box-sizing:border-box;padding:7px;min-width:0;width:100%;border:1px solid #a8b6c5;border-radius:5px;background:white;color:#17212e}
.ore-settings-colours,.ore-settings-operations{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ore-settings-icon-section{min-width:125px}.ore-settings-icon-selected{display:flex;align-items:center;gap:5px;color:#334155;font-size:12px}.ore-icon-gallery summary{cursor:pointer;color:#095b92;font-size:12px}.ore-icon-gallery[open]{min-width:230px}.ore-icon-grid{display:grid;grid-template-columns:repeat(5,minmax(38px,1fr));gap:3px;margin-top:5px;max-height:190px;overflow:auto}.ore-icon-choice{padding:4px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer;display:flex;align-items:center;flex-direction:column;font-size:9px}.ore-icon-choice[aria-pressed="true"]{border:2px solid #095b92;background:#eaf5fc}.ore-icon-choice[hidden]{display:none}
.ore-settings-colours input[type=color]{height:34px;width:43px;padding:1px;cursor:pointer}
.ore-settings-hex{max-width:95px}
.ore-settings-preset{max-width:105px}
.ore-settings-button,.ore-settings-footer button{border:1px solid #9db0c0;border-radius:5px;padding:6px 10px;cursor:pointer;background:#fff;color:#164e79}
.ore-settings-footer{margin-top:14px;display:flex;justify-content:space-between;gap:12px}
.ore-settings-footer button:last-child{background:#095b92;color:white}
 .ore-settings-footnote{font-size:12px;color:#607080;margin:14px 0 0}
.ore-settings-permissions{border-top:1px solid #cbd5e1;margin-top:24px;padding-top:14px}
.ore-settings-permissions h3{font-size:16px;font-weight:700;margin:16px 0 8px}
.ore-settings-hint{color:#526577;font-size:12px;margin:8px 0 12px}
.ore-role-headings,.ore-role-row{display:grid;grid-template-columns:minmax(130px,1.1fr) repeat(4,minmax(75px,1fr));gap:8px;padding:8px 6px;align-items:center;border-bottom:1px solid #e2e8f0}
.ore-role-headings{background:#f1f5f9;font-size:12px}
.ore-settings-toggle{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
.ore-settings-options-grid{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px;margin:12px 0}
.ore-settings-primary{margin:16px 0;background:#095b92!important;color:white!important}.ore-appearance-grid{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:9px}.ore-appearance-select{display:flex;flex-direction:column;gap:4px}
@media(max-width:640px){.ore-role-headings{display:none}.ore-role-row{grid-template-columns:1fr}.ore-settings-options-grid{grid-template-columns:1fr}}
.ore-dashboard-settings button:disabled,.ore-dashboard-settings input:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:730px){.ore-settings-row{grid-template-columns:26px 1fr;gap:7px}.ore-settings-colours,.ore-settings-operations{grid-column:2;flex-wrap:wrap}}
`;
    document.head.append(make('style', {id: 'ore-dashboard-native-settings-style'}, css));
  }

  function mount() {
    injectStyles();
    document.querySelectorAll(rootSelector).forEach(root => { void initialise(root); });
  }
  window.__oreDashboardNativeSettingsMount = mount;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
  const observer = new MutationObserver(mount);
  if (document.documentElement) observer.observe(document.documentElement, {childList: true, subtree: true});
})();
