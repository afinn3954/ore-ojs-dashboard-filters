/*
 * ORE Dashboard Filters v0.2.0, October OJS 3.6 prototype.
 * Copyright (c) 2026 CERN. Original developer: Anthony Finnerty.
 * GPL-3.0-only. The original v0.1.2 filter bundle remains in place.
 */
(() => {
  'use strict';
  if (typeof pkp === 'undefined' || !pkp.registry ||
      typeof pkp.registry.storeExtend !== 'function' ||
      typeof pkp.registry.registerComponent !== 'function') return;

  const vue = pkp.modules?.vue;
  if (!vue?.watch || !vue?.h || !vue?.reactive) return;
  const {h, watch, reactive} = vue;
  const configuration = window.oreDashboardFiltersV2Config || {};
  const apiUrl = configuration.flagsApiUrl || '';
  const flagLabels = {
    '': 'No flag',
    completed: 'Completed',
    check: 'Needs checking',
    in_progress: 'In progress',
  };
  const flagColours = {
    completed: {colour: '#176c3a', background: '#e7f7ec'},
    check: {colour: '#a12626', background: '#ffeaea'},
    in_progress: {colour: '#935500', background: '#fff1d4'},
    '': {colour: '#525d66', background: 'transparent'},
  };

  function field(name, label, entries, component = 'field-options') {
    return {
      name, component, label, groupId: 'default',
      isRequired: false, isMultilingual: false, isInert: false,
      value: [], selected: [],
      ...(component === 'field-options' ? {type: 'radio', isOrderable: false, allowOnlySorting: false} : {}),
      options: [{value: [], label: 'All / any'}, ...entries],
    };
  }

  function scalar(value) {
    if (Array.isArray(value)) value = value.find(v => v !== '' && v != null);
    return value === undefined || value === null || value === '' ? null : String(value);
  }
  function getField(store, name) {
    return store.filtersForm?.fields?.find(f => f.name === name);
  }
  function updateField(field, value, label) {
    const expected = value == null ? [] : value;
    const selected = value == null ? [] : [{value, label}];
    if (JSON.stringify(field.value) !== JSON.stringify(expected)) field.value = expected;
    if (JSON.stringify(field.selected) !== JSON.stringify(selected)) field.selected = selected;
  }
  function reconcile(store, names) {
    names.forEach(name => {
      const f = getField(store, name);
      if (!f) return;
      const value = scalar(f.value);
      const option = f.options?.find(o => !Array.isArray(o.value) && String(o.value) === value);
      updateField(f, option?.value ?? null, option?.label ?? null);
    });
  }

  const optionsTime = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      optionsTime.push({value, label: value});
    }
  }
  optionsTime.push({value: '23:59', label: '23:59'});
  const names = ['oreTaskTitle', 'oreTaskStatus', 'oreFlag', 'oreTimeFrom', 'oreTimeTo'];

  // These are global Vue components. The dashboard's native Table supports
  // registered component names in columns, without a core/UI-library patch.
  pkp.registry.registerComponent('OreDashboardCellSubmitted', {
    props: {item: {type: Object, required: true}},
    setup(props) {
      return () => {
        const raw = props.item.dateSubmitted || props.item.date_submitted;
        const parsed = raw ? new Date(raw.replace(' ', 'T')) : null;
        const label = parsed && !Number.isNaN(parsed.getTime())
          ? new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(parsed)
          : '—';
        return h('td', {class: 'p-2 border-b text-sm', title: raw || ''}, label);
      };
    },
  });

  pkp.registry.registerComponent('OreDashboardCellFlag', {
    props: {item: {type: Object, required: true}},
    setup(props) {
      const isSaving = vue.ref(false);
      const error = vue.ref('');
      const store = pkp.registry.getPiniaStore('dashboard');
      const change = async event => {
        event.stopPropagation();
        if (!apiUrl || isSaving.value) return;
        const id = Number(props.item.id);
        const previous = store.oreFlags[id] || '';
        const flag = event.target.value;
        isSaving.value = true;
        error.value = '';
        try {
          const resp = await fetch(apiUrl, {
            method: 'POST', credentials: 'same-origin',
            headers: {'Content-Type': 'application/json', 'Accept': 'application/json',
              'X-Csrf-Token': pkp.currentUser?.csrfToken || ''},
            body: JSON.stringify({submissionId: id, flag}),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          store.oreFlags[id] = flag;
        } catch (e) {
          store.oreFlags[id] = previous;
          error.value = `Save failed: ${e.message}`;
        } finally {
          isSaving.value = false;
        }
      };
      return () => {
        const flag = store.oreFlags[props.item.id] || '';
        const colour = flagColours[flag] || flagColours[''];
        return h('td', {class: 'p-2 border-b text-sm', style: `border-left: 4px solid ${flag ? colour.colour : 'transparent'}`}, [
          h('select', {
            value: flag, onChange: change, disabled: isSaving.value || !apiUrl,
            'aria-label': `Editorial flag for submission ${props.item.id}`,
            title: flagLabels[flag],
            style: `color: ${colour.colour}; background: ${colour.background}; border: 1px solid ${flag ? colour.colour : '#a0a7b1'}; border-radius: 5px; padding: 4px; max-width: 160px; font-weight: 600;`,
          }, Object.entries(flagLabels).map(([value, label]) => h('option', {value}, label))),
          error.value ? h('div', {role: 'alert', style: 'color: #a12626; font-size: 11px'}, error.value) : null,
        ]);
      };
    },
  });

  pkp.registry.storeExtend('dashboard', ({store}) => {
    if (store.dashboardPage !== 'editorialDashboard' || !store.filtersForm?.fields) return;

    store.oreFlags = reactive({});
    store.extender.extendFn('getColumns', columns => {
      if (columns.some(c => c.id === 'oreFlag')) return columns;
      const copy = [...columns];
      const actionsAt = copy.findIndex(c => c.id === 'actions');
      const insertAt = actionsAt < 0 ? copy.length : actionsAt;
      copy.splice(insertAt, 0,
        {id: 'oreSubmitted', header: 'Submitted', component: 'OreDashboardCellSubmitted', sortable: false},
        {id: 'oreFlag', header: 'Flag', component: 'OreDashboardCellFlag', sortable: false});
      return copy;
    });

    const taskOptions = Array.isArray(configuration.taskTitles) ? configuration.taskTitles : [];
    const fields = [
      field('oreTaskTitle', 'Editorial task', taskOptions.map(title => ({value: title, label: title})), 'field-select'),
      field('oreTaskStatus', 'Editorial task status', [
        {value: 'open', label: 'Open'}, {value: 'closed', label: 'Closed'},
      ]),
      field('oreFlag', 'Submission flag', [
        {value: 'unflagged', label: 'No flag'},
        {value: 'completed', label: 'Completed (green)'},
        {value: 'check', label: 'Needs checking (red)'},
        {value: 'in_progress', label: 'In progress (orange)'},
      ]),
      field('oreTimeFrom', 'Submitted after (time)', optionsTime, 'field-select'),
      field('oreTimeTo', 'Submitted before (time)', optionsTime, 'field-select'),
    ];
    const query = new URLSearchParams(window.location.search);
    for (const f of fields) {
      const initial = query.get(f.name);
      const match = f.options.find(o => !Array.isArray(o.value) && String(o.value) === initial);
      if (match) updateField(f, match.value, match.label);
    }
    const currentForm = store.filtersForm;
    const unregisteredFields = fields.filter(f => !currentForm.fields.some(x => x.name === f.name));
    if (unregisteredFields.length) {
      store.updateFiltersForm({...currentForm, fields: [...currentForm.fields, ...unregisteredFields]});
    }
    watch(
      () => names.map(name => [getField(store, name)?.value, getField(store, name)?.selected]),
      () => reconcile(store, names),
      {deep: true, immediate: true, flush: 'sync'}
    );

    let lastRequest = 0;
    watch(
      () => (store.submissions || []).map(s => Number(s.id)).join(','),
      async ids => {
        if (!apiUrl || !ids) return;
        const token = ++lastRequest;
        try {
          const resp = await fetch(`${apiUrl}?ids=${encodeURIComponent(ids)}`, {credentials: 'same-origin', headers: {'Accept': 'application/json'}});
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (token !== lastRequest) return;
          for (const id of ids.split(',')) store.oreFlags[id] = data.flags?.[id] || '';
        } catch (e) {
          console.error('[ORE Dashboard Filters] Failed to load flags', e);
        }
      }, {immediate: true}
    );
  });
})();
