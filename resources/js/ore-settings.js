/*
 * ORE Dashboard Filters v0.3.7: native OJS plugin Settings and flag designer.
 * Copyright (c) 2026 Anthony Finnerty.
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
  // The OJS admin page may load this editor before the icon library.
  // Resolve the library when icons are rendered, not when this file is loaded.
  const icons = {
    get names() {
      return window.oreDashboardFlagIcons?.names || ['flag'];
    },
    svg(...args) {
      return window.oreDashboardFlagIcons?.svg(...args) || document.createTextNode('⚑');
    },
  };
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
    ['oreFlagMultiSelect', 'Select multiple flags (any match)'],
    ['oreFlagSort', 'Sort submissions by flag name'],
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
    renderIndividualPermissions(root, state, section);
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

  function renderIndividualPermissions(root, state, section) {
    section.append(make('h3',{},'Individual user permissions'));
    section.append(make('p',{className:'ore-settings-hint'},
      'Override the role settings for individual users in this journal. Site Administrators and Journal Managers remain unrestricted. Native OJS access rights still apply.'));
    // Persisted overrides are listed immediately, independent of the search
    // box. Search is for finding another user; this table is for managing the
    // exceptions already stored against this journal.
    const overriddenUsers = Array.isArray(state.overriddenUsers) ? state.overriddenUsers : [];
    section.append(make('h4', {className: 'ore-user-overrides-heading'},
      `Users with custom permissions (${overriddenUsers.length})`));
    if (!overriddenUsers.length) {
      section.append(make('p', {className: 'ore-settings-hint'},
        'No individual overrides. All users currently follow their role settings.'));
    } else {
      const scroll = make('div', {className: 'ore-user-overrides-scroll', role:'region',
        'aria-label':'Saved individual user permissions', tabindex:'0'});
      const table = make('table', {className: 'ore-user-overrides-table'});
      const thead = make('thead');
      const headings = make('tr');
      for (const label of ['User', ...accessLabels.map(([, label]) => label), 'Actions']) {
        headings.append(make('th', {scope:'col'}, label));
      }
      thead.append(headings);
      table.append(thead);
      const tbody = make('tbody');
      for (const user of overriddenUsers) {
        const abilities = state.userOverrides?.[String(user.id)];
        if (!abilities) continue;
        const row = make('tr');
        const nameCell = make('td');
        nameCell.append(make('strong', {}, user.fullName || user.username || `User #${user.id}`));
        if (user.username) nameCell.append(make('span', {className:'ore-user-override-secondary'},
          `@${user.username}`));
        if (!user.inJournal) nameCell.append(make('span', {className:'ore-user-override-secondary'},
          'No longer assigned to this journal'));
        row.append(nameCell);
        for (const [ability] of accessLabels) {
          const value = !!abilities[ability];
          const cell = make('td', {className:'ore-user-override-ability'});
          cell.append(make('span', {className:value ? 'ore-user-override-yes' : 'ore-user-override-no'},
            value ? 'Yes' : 'No'));
          row.append(cell);
        }
        const actions = make('td', {className:'ore-user-override-actions'});
        actions.append(make('button', {type:'button', className:'ore-settings-button',
          disabled:state.busy || !user.inJournal,
          dataset:{oreAction:'select-override',userId:String(user.id)}}, 'Edit'));
        actions.append(make('button', {type:'button', className:'ore-settings-button',
          disabled:state.busy,
          dataset:{oreAction:'reset-override',userId:String(user.id)}}, 'Restore defaults'));
        row.append(actions);
        tbody.append(row);
      }
      table.append(tbody);
      scroll.append(table);
      section.append(scroll);
      section.append(make('p', {className: 'ore-settings-hint'},
        'These settings remain until you restore the user’s role defaults.'));
    }
    section.append(make('h4', {className:'ore-user-search-heading'}, 'Find another user'));
    const search = make('input',{type:'search',className:'ore-settings-input',
      placeholder:'Search by name, username or email (2+ characters)',
      'aria-label':'Search journal users',value:state.userSearch || '',
      dataset:{oreUserSearch:'1'}});
    section.append(search);
    const results=make('div',{className:'ore-user-search-results'});
    if (state.userSearch && state.userSearch.length >= 2) {
      if (state.searchLoading) results.append(make('p',{},'Searching…'));
      else if (!state.userMatches?.length) results.append(make('p',{},'No journal users found.'));
      for (const user of state.userMatches || []) {
        const row=make('div',{className:'ore-user-result'});
        row.append(make('span',{},`${user.fullName || user.username} · ${user.username} (${user.email})`));
        row.append(make('button',{type:'button',className:'ore-settings-button',
          disabled:state.busy,dataset:{oreAction:'select-user',userId:String(user.id)}},'Configure'));
        results.append(row);
      }
    }
    section.append(results);
    const selected = state.selectedUser;
    if (!selected) return;
    section.append(make('h4',{},`Permissions for ${selected.fullName || selected.username}`));
    const current = state.userDraft || {};
    const grid=make('div',{className:'ore-user-permission-grid'});
    for(const [ability,label] of accessLabels) {
      const wrapper=make('label',{className:'ore-settings-toggle'});
      const checkbox=make('input',{type:'checkbox',disabled:state.busy,
        dataset:{oreUserAbility:ability}});
      checkbox.checked=!!current[ability];
      wrapper.append(checkbox,make('span',{},label));grid.append(wrapper);
    }
    section.append(grid);
    const actions=make('div',{className:'ore-user-permission-actions'});
    actions.append(make('button',{type:'button',className:'ore-settings-button ore-settings-primary',
      dataset:{oreAction:'save-user'},disabled:state.busy},'Save user permissions'));
    if(state.userOverrides?.[String(selected.id)])
      actions.append(make('button',{type:'button',className:'ore-settings-button',
        dataset:{oreAction:'reset-user'},disabled:state.busy},'Restore role defaults'));
    section.append(actions);
    if (state.userMessage) section.append(make('p',{className:'ore-settings-hint'},state.userMessage));
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
      ['showWorkflowFlag','Show assigned flag in submission workflow view'],
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
      flagsDirty: false, preferencesDirty: false,
      userSearch:'', userMatches:[], userOverrides:{}, overriddenUsers:[], selectedUser:null, userDraft:null,
      searchLoading:false, userMessage:''};
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
      const data = await requestJSON(`${root.dataset.apiUrl}/user-permissions`);
      state.userOverrides = data.overrides || {};
      state.overriddenUsers = Array.isArray(data.overriddenUsers) ? data.overriddenUsers : [];
    } catch(error) {
      preferenceStatus(root,`Individual permissions unavailable: ${error.message}`,'error');
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

  async function searchUsers(root, query) {
    const state=instances.get(root);
    if(!state || state.busy) return;
    state.userSearch=query;
    if(query.length < 2) {state.userMatches=[];state.searchLoading=false;renderPreferences(root,state);return;}
    const requestId=state.userRequestId=(state.userRequestId||0)+1;
    state.searchLoading=true;
    try {
      const data=await requestJSON(`${root.dataset.apiUrl}/user-permissions?q=${encodeURIComponent(query)}`);
      if(requestId !== state.userRequestId) return;
      state.userMatches=data.users || [];
      state.userOverrides=data.overrides || {};
      state.overriddenUsers=Array.isArray(data.overriddenUsers) ? data.overriddenUsers : [];
    } catch(error) { if(requestId===state.userRequestId)state.userMessage=error.message; }
    finally {if(requestId===state.userRequestId){
      state.searchLoading=false;renderPreferences(root,state);
      const input=root.querySelector('[data-ore-user-search]');
      if(input && state.userSearch===query){input.focus();input.setSelectionRange(input.value.length,input.value.length);}
    }}
  }

  async function saveIndividual(root, reset=false, overrideUserId=null) {
    const state=instances.get(root);
    const userId=overrideUserId ?? state?.selectedUser?.id;
    if(!state || state.busy || !userId || (!reset && !state.selectedUser)) return;
    const token=window.pkp?.currentUser?.csrfToken;
    if(!token){state.userMessage='Missing OJS CSRF token';renderPreferences(root,state);return;}
    state.busy=true;
    try {
      const data=await requestJSON(`${root.dataset.apiUrl}/user-permissions`,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json',
          'X-Csrf-Token':token,'X-Http-Method-Override':'PUT'},
        body:JSON.stringify({userId,abilities:reset?null:state.userDraft}),
      });
      state.userOverrides=data.overrides || {};
      state.overriddenUsers=Array.isArray(data.overriddenUsers) ? data.overriddenUsers : [];
      if(reset && String(state.selectedUser?.id)===String(userId)) {
        state.selectedUser=null;state.userDraft=null;
      }
      state.userMessage=reset?'Role defaults restored.':'User permissions saved. Refresh the dashboard to apply.';
    } catch(error){state.userMessage=`Could not save: ${error.message}`;}
    finally{state.busy=false;renderPreferences(root,state);}
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
    if (action === 'save-user') return void saveIndividual(root);
    if (action === 'reset-user') {
      if (!window.confirm('Restore role defaults for this user?')) return;
      return void saveIndividual(root,true);
    }
    if (action === 'select-override') {
      const user=state.overriddenUsers.find(u=>String(u.id)===button.dataset.userId);
      if(!user || !user.inJournal)return;
      state.selectedUser=user;
      state.userDraft={...state.userOverrides[String(user.id)]};
      state.userMessage='Edit these permissions and save, or restore role defaults.';
      renderPreferences(root,state);
      root.querySelector('[data-ore-action="save-user"]')?.scrollIntoView?.({block:'nearest'});
      return;
    }
    if (action === 'reset-override') {
      const user=state.overriddenUsers.find(u=>String(u.id)===button.dataset.userId);
      if(!user)return;
      if(!window.confirm(`Restore role defaults for ${user.fullName || user.username || 'this user'}?`))return;
      return void saveIndividual(root,true,user.id);
    }
    if (action === 'select-user') {
      const user=state.userMatches.find(u=>String(u.id)===button.dataset.userId);
      if(!user)return;
      state.selectedUser=user;
      state.userDraft=state.userOverrides[String(user.id)]
        ? {...state.userOverrides[String(user.id)]}
        : {...(user.effective || {filters:false,viewColumns:false,viewFlags:false,editFlags:false})};
      state.userMessage='Tick the permitted capabilities and save.';
      renderPreferences(root,state);
      return;
    }
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
    const field=event.target;
    if(field.matches?.('[data-ore-user-search]')) {
      const root=field.closest(rootSelector),state=root&&instances.get(root);
      if(!state||state.busy)return;
      const query=field.value.trim();
      state.userSearch=query;
      clearTimeout(state.searchTimer);
      state.searchTimer=setTimeout(()=>void searchUsers(root,query),280);
      return;
    }
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
    if (field.dataset?.oreUserAbility) {
      const root=field.closest(rootSelector),state=root&&instances.get(root);
      if(!state?.userDraft || state.busy)return;
      const ability=field.dataset.oreUserAbility;
      if(!Object.hasOwn(state.userDraft,ability))return;
      state.userDraft[ability]=!!field.checked;
      if(ability==='viewFlags' && !field.checked)state.userDraft.editFlags=false;
      if(ability==='editFlags' && field.checked)state.userDraft.viewFlags=true;
      state.userMessage='Unsaved user permissions';
      renderPreferences(root,state);return;
    }
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
.ore-user-search-results{margin:8px 0 12px}.ore-user-result{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #e2e8f0}.ore-user-permission-grid{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:10px;padding:12px;background:#f8fafc}.ore-user-permission-actions{display:flex;gap:10px;flex-wrap:wrap}
.ore-user-overrides-heading{margin:16px 0 6px}.ore-user-search-heading{margin:16px 0 8px}.ore-user-overrides-scroll{overflow-x:auto;max-width:100%;border:1px solid #dce5ec;border-radius:6px}.ore-user-overrides-table{width:100%;border-collapse:collapse;font-size:12px;min-width:650px}.ore-user-overrides-table th{font-weight:700;background:#f1f5f9;color:#30445b;text-align:left;padding:9px 7px;border-bottom:1px solid #cad5e0}.ore-user-overrides-table td{padding:8px 7px;border-bottom:1px solid #e2e8f0;vertical-align:middle}.ore-user-overrides-table tbody tr:last-child td{border-bottom:0}.ore-user-overrides-table th:nth-child(n+2):nth-child(-n+5){text-align:center}.ore-user-override-secondary{display:block;color:#62748a;font-size:11px;margin-top:2px}.ore-user-override-ability{text-align:center}.ore-user-override-yes{color:#166534;font-weight:700}.ore-user-override-no{color:#64748b}.ore-user-override-actions{white-space:nowrap}.ore-user-override-actions button{margin:2px 3px 2px 0}
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
