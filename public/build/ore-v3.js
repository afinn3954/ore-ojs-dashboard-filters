/*
 * ORE Dashboard Filters for OJS 3.6.
 * Copyright (c) 2026 Anthony Finnerty.
 * GPL-3.0-only, see the plugin LICENSE.
 */
(() => {
  'use strict';

  if (typeof pkp === 'undefined' || !pkp.registry ||
      typeof pkp.registry.storeExtend !== 'function' ||
      typeof pkp.registry.registerComponent !== 'function') return;
  const vue = pkp.modules?.vue;
  if (!vue?.watch || !vue?.h || !vue?.reactive || !vue?.ref) return;
  const {h, ref, reactive, watch} = vue;
  const config = window.oreDashboardFiltersV3Config || {};
  const apiUrl = config.flagsApiUrl || '';
  const access = config.access || {filters: false, viewColumns: false, viewFlags: false, editFlags: false};
  const features = config.features || {};
  const configuredColumns = config.columns || {};
  const appearance = config.appearance || {
    layout:'compact',dateFormat:'short',flagDisplay:'short',showSubmitted:false,
    showPublishingStage:false,showEditorialActivity:true,
  };
  const compact = appearance.layout !== 'detailed';
  const iconLibrary = window.oreDashboardFlagIcons || {data:{flag:[]}};
  const svgIcon = (name, colour, size=16) => h('svg', {
    viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:colour,
    'stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round',
    'aria-hidden':'true',style:{display:'inline-block',flexShrink:0},
  }, (iconLibrary.data[name] || iconLibrary.data.flag || []).map(([tag,attrs]) => h(tag,attrs)));
  if (compact) document.documentElement.classList.add('ore-dashboard-compact');

  const defaults = [
    {id:'completed',label:'Completed',shortLabel:'Done',icon:'check-circle',enabled:true,color:'#178346'},
    {id:'check',label:'Needs checking',shortLabel:'Check',icon:'circle-alert',enabled:true,color:'#b4232a'},
    {id:'in_progress',label:'In progress',shortLabel:'WIP',icon:'clock',enabled:true,color:'#b86b07'},
  ];
  const optionNames = ['oreTaskTitle', 'oreTaskStatus', 'oreFlag', 'oreTimeFrom', 'oreTimeTo'];

  function makeField(name, label, values, component = 'field-options') {
    return {
      name, component, label, groupId: 'default', isRequired: false,
      isMultilingual: false, isInert: false, value: [], selected: [],
      ...(component === 'field-options' ? {
        type: 'radio', isOrderable: false, allowOnlySorting: false,
      } : {}),
      options: [{value: [], label: 'All / any'}, ...values],
    };
  }

  function firstScalar(value) {
    if (Array.isArray(value)) value = value.find(v => v !== '' && v != null);
    return value === undefined || value === null || value === '' ? null : String(value);
  }

  function getField(store, name) {
    return store.filtersForm?.fields?.find(field => field.name === name);
  }

  function updateField(field, value, label) {
    const actualValue = value == null ? [] : value;
    const selected = value == null ? [] : [{value, label}];
    if (JSON.stringify(field.value) !== JSON.stringify(actualValue)) field.value = actualValue;
    if (JSON.stringify(field.selected) !== JSON.stringify(selected)) field.selected = selected;
  }

  function reconcile(store) {
    optionNames.forEach(name => {
      const field = getField(store, name);
      if (!field) return;
      const raw = firstScalar(field.value);
      const option = field.options?.find(o => !Array.isArray(o.value) && String(o.value) === raw);
      updateField(field, option?.value ?? null, option?.label ?? null);
    });
  }

  function getDefinitions(store) {
    return Array.isArray(store?.oreDefinitions) ? store.oreDefinitions : defaults;
  }

  function applyDefinitionOptions(store) {
    const field = getField(store, 'oreFlag');
    if (!field) return;
    field.options = [
      {value: [], label: 'All submission flags'},
      {value: 'unflagged', label: 'No flag'},
      ...getDefinitions(store).filter(f => f.enabled !== false).map(f => ({value: f.id, label: f.label})),
    ];
    reconcile(store);
  }

  function selectedDefinition(store, key) {
    return getDefinitions(store).find(def => def.id === key);
  }

  function hexIsValid(value) {
    return typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value);
  }

  function tint(color) {
    if (!hexIsValid(color)) return '#f1f5f9';
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);
    return `rgb(${Math.round(238 + r * 0.065)}, ${Math.round(238 + g * 0.065)}, ${Math.round(238 + b * 0.065)})`;
  }

  function safeDisplayDate(raw, forceFull = false) {
    if (typeof raw !== 'string' || !raw) return '—';
    const parsed = new Date(raw.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', ...((appearance.dateFormat === 'full' || forceFull) ? {year: 'numeric'} : {}),
      hour: '2-digit', minute: '2-digit',
    }).format(parsed);
  }

  function publishingStage(item) {
    const pubs = Array.isArray(item?.publications) ? item.publications : [];
    if (!pubs.length) return 'Unassigned';
    const currentId = Number(item.currentPublicationId);
    const current = pubs.find(pub => Number(pub.id) === currentId);
    // Only published PMUR/VoR counts; an unpublished draft is not yet a
    // published stage. Fall back to the latest published version if needed.
    const published = pubs.filter(pub => Number(pub.status) === 3);
    const candidate = current && Number(current.status) === 3
      ? current
      : published.slice().sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (!candidate) return 'Unassigned';
    const kind = String(candidate.versionStage || '').toUpperCase();
    if (kind !== 'PMUR' && kind !== 'VOR') return 'Unassigned';
    const major = Number(candidate.versionMajor);
    const minor = Number(candidate.versionMinor);
    const match = String(candidate.versionString || '').match(/(\d+)(?:\.(\d+))?/);
    const version = Number.isInteger(major) && major > 0
      ? `v${major}.${Number.isInteger(minor) && minor >= 0 ? minor : 0}`
      : (match ? `v${match[1]}.${match[2] || '0'}` : '');
    return `${kind === 'VOR' ? 'VoR' : 'PMUR'} ${version}`.trim();
  }

  async function fetchJson(url, options = {}) {
    const headers = {'Accept': 'application/json', ...options.headers};
    const response = await fetch(url, {
      credentials: 'same-origin', ...options, headers,
    });
    let data = {};
    try { data = await response.json(); } catch (_ignore) { /* include status */ }
    if (!response.ok) throw new Error(data.error || data.errorMessage || `HTTP ${response.status}`);
    return data;
  }

  function withCsrf(method, body) {
    return {
      method: method === 'PUT' ? 'POST' : method,
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': pkp.currentUser?.csrfToken || '',
        ...(method === 'PUT' ? {'X-Http-Method-Override': 'PUT'} : {}),
      },
      body: JSON.stringify(body),
    };
  }

  pkp.registry.registerComponent('OreDashboardCellSubmitted', {
    props: {item: {type: Object, required: true}},
    setup(props) {
      return () => h('td', {
        class: 'border-b border-light p-2 text-start text-base-normal ore-dashboard-date-cell',
        'data-ore-cell': 'submitted',
        title: props.item.dateSubmitted || props.item.date_submitted || '',
      }, safeDisplayDate(props.item.dateSubmitted || props.item.date_submitted));
    },
  });

  // PKP includes lastModified in the standard submissions-list API response.
  // It is the last modification to the submission or related objects, not
  // dateLastActivity (which is used by the native DAYS column).
  pkp.registry.registerComponent('OreDashboardCellLastUpdated', {
    props: {item:{type:Object,required:true}},
    setup(props) {
      return () => {
        const submitted=safeDisplayDate(props.item.dateSubmitted || props.item.date_submitted);
        const updated=safeDisplayDate(props.item.lastModified);
        const tip=`Submitted: ${safeDisplayDate(props.item.dateSubmitted || props.item.date_submitted,true)}\nLast updated: ${safeDisplayDate(props.item.lastModified,true)}`;
        return h('td',{
          class:'border-b border-light p-2 text-start text-base-normal ore-dashboard-date-cell',
          'data-ore-cell':'last-modified',title:tip,tabIndex:0,
          'aria-label':`Updated ${updated}. Submitted ${submitted}.`,
        },updated);
      };
    },
  });

  // In compact mode the title gets the publishing version beneath it rather
  // than adding a wide permanent column. Keep all user-supplied text inert.
  pkp.registry.registerComponent('OreDashboardCellTitleCompact',{
    props:{item:{type:Object,required:true}},
    setup(props) {
      return () => {
        const item=props.item;
        const pubs=Array.isArray(item.publications)?item.publications:[];
        const pub=pubs.find(p=>Number(p.id)===Number(item.currentPublicationId)) || pubs[0] || {};
        const rawTitle=pub.fullTitle || pub.title || item.title || '';
        const label=typeof rawTitle==='string'?rawTitle:rawTitle?.[pub.locale]||rawTitle?.en||'';
        const clean=String(label).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
        const authors=String(pub.authorsStringShort||'');
        const full=`${authors?authors+' — ':''}${clean}`;
        const version=publishingStage(item);
        return h('td',{'data-ore-cell':'compact-title',
          class:'border-b border-light p-2 text-start text-base-normal ore-compact-title-cell',
          title:full},[
            h('div',{class:'ore-compact-title-text'},[
              authors?h('strong',{},authors+' — '):null,clean,
            ]),
            h('div',{class:'ore-compact-title-meta',title:`Publishing stage: ${version}`},version),
          ]);
      };
    },
  });

  pkp.registry.registerComponent('OreDashboardCellPublishingStage', {
    props: {item: {type: Object, required: true}},
    setup(props) {
      return () => {
        const label = publishingStage(props.item);
        return h('td', {
          class: 'border-b border-light p-2 text-start text-base-normal ore-dashboard-version-cell',
          'data-ore-cell': 'publishing-stage',
        },
          h('span', {
            title: `Current published version: ${label}`,
            style: {
              display: 'inline-block', padding: '3px 7px', borderRadius: '4px',
              background: label === 'Unassigned' ? '#f1f5f9' : '#e6f1fa',
              color: label === 'Unassigned' ? '#475569' : '#164e79',
            },
          }, label));
      };
    },
  });

  pkp.registry.registerComponent('OreDashboardCellFlag', {
    props:{item:{type:Object,required:true}},
    setup(props) {
      const busy=ref(false);
      const error=ref('');
      const store=pkp.registry.getPiniaStore('dashboard');
      const save=async event=>{
        event.stopPropagation();
        if(busy.value||!apiUrl||!access.editFlags||!store.oreCanEdit?.[props.item.id])return;
        const submissionId=Number(props.item.id);
        const prior=store.oreFlags[submissionId]||'';
        const next=event.target.value;
        busy.value=true;error.value='';
        try{await fetchJson(apiUrl,withCsrf('POST',{submissionId,flag:next}));store.oreFlags[submissionId]=next;}
        catch(e){store.oreFlags[submissionId]=prior;error.value=`Save failed: ${e.message}`;}
        finally{busy.value=false;}
      };
      return () => {
        const key=store.oreFlags[props.item.id]||'';
        const def=selectedDefinition(store,key);
        const colour=def&&hexIsValid(def.color)?def.color:'#64748b';
        const mayEdit=Boolean(access.editFlags&&store.oreCanEdit?.[props.item.id]);
        const mode=appearance.flagDisplay||'short';
        const text=def?(mode==='full'?def.label:(def.shortLabel||def.label)):'No flag';
        const icon=svgIcon(def?.icon||'flag',key?colour:'#64748b',17);
        const name=def?.label||'No flag';
        const outerStyle={display:'inline-flex',alignItems:'center',gap:'5px',
          padding:'4px 5px',borderRadius:'5px',background:key?tint(colour):'#fff',
          border:`1px solid ${key?colour:'#b8c2cc'}`,maxWidth:'100%',boxSizing:'border-box'};
        const select=mayEdit?h('select',{
          value:key,onChange:save,disabled:busy.value||!apiUrl,
          title:name,'aria-label':`Editorial flag for submission ${props.item.id}: ${name}`,
          class:'ore-compact-flag-select',
          style:{color:'#17212e',background:'transparent',border:'none',fontWeight:600,
            cursor:'pointer',width:mode==='icon'?'28px':(mode==='full'?'145px':'76px'),
            minWidth:0,maxWidth:'100%',fontSize:'13px'},
        },[
          h('option',{value:''},mode==='icon'?'—':'No flag'),
          ...getDefinitions(store).filter(f=>f.enabled!==false||f.id===key).map(f=>
            h('option',{value:f.id},f.id===key?(mode==='icon'?'':(mode==='full'?f.label:f.shortLabel||f.label)):f.label)),
        ]): h('span',{style:{fontSize:'13px',fontWeight:600,color:key?colour:'#64748b'}},
          mode==='icon'?'':text);
        return h('td',{
          class:'border-b border-light p-2 text-start text-base-normal ore-dashboard-flag-cell',
          'data-ore-cell':'flag',title:name,
        },[
          h('span',{class:'ore-compact-flag',style:outerStyle,title:name},[icon,select]),
          error.value?h('div',{role:'alert',style:{fontSize:'11px',color:'#b4232a'}},error.value):null,
        ]);
      };
    },
  });


  pkp.registry.storeExtend('dashboard', ({store}) => {
    if (store.dashboardPage !== 'editorialDashboard' || !store.filtersForm?.fields) return;
    if (!access.filters && !access.viewFlags && !access.viewColumns) return;
    store.oreFlags = reactive({});
    store.oreCanEdit = reactive({});
    store.oreDefinitions = reactive(defaults.map(f => ({...f})));

    // Disable plugin-owned filter fields when switched off in Settings.
    // Core OJS author/reviewer filters are outside this extension.
    const baseFieldFeatures = {
      oreVersionStage: 'oreVersionStage', stageIds: 'stageIds',
      oreSubmissionDate: 'oreSubmissionDate', oreDateFrom: 'oreSubmissionDate',
      oreDateTo: 'oreSubmissionDate', sectionIds: 'oreSection', categoryIds: 'oreCategory',
    };
    const baseFields = store.filtersForm.fields.filter(field =>
      !baseFieldFeatures[field.name] ||
      (access.filters && features[baseFieldFeatures[field.name]] !== false));
    if (baseFields.length !== store.filtersForm.fields.length) {
      store.updateFiltersForm({...store.filtersForm, fields: baseFields});
    }

    // v0.1.2 named the native OJS Copyediting stage 'Editorial checks'.
    // Restore OJS 3.6's default UI term, without changing stage ID 4.
    const nativeStages = getField(store, 'stageIds');
    if (nativeStages) {
      for (const choice of nativeStages.options || []) {
        if (String(choice.value) === '4' && choice.label === 'Editorial checks') {
          choice.label = 'Copyediting';
        }
      }
      for (const selected of nativeStages.selected || []) {
        if (String(selected.value) === '4' && selected.label === 'Editorial checks') {
          selected.label = 'Copyediting';
        }
      }
    }

    store.extender.extendFn('getColumns', columns => {
      const output = [...columns];
      if(compact) {
        const titleColumn=output.find(col=>col.id==='title');
        if(titleColumn)titleColumn.component='OreDashboardCellTitleCompact';
        if(appearance.showEditorialActivity===false) {
          const index=output.findIndex(col=>col.id==='editorialActivity');
          if(index>=0)output.splice(index,1);
        }
      }

      if (access.viewColumns && (!compact || appearance.showPublishingStage) && configuredColumns.publishingStage !== false && !output.some(column => column.id === 'orePublishingStage')) {
        const stage = output.findIndex(column => column.id === 'stage');
        output.splice(stage >= 0 ? stage + 1 : 2, 0, {
          id: 'orePublishingStage', header: 'Publishing stage',
          component: 'OreDashboardCellPublishingStage', sortable: false,
        });
      }
      // Submitted and Last updated belong with identifying submission
      // metadata. Keep Stage and Publishing stage together to their right.
      // The OJS 3.6 _submissions API natively accepts these exact sort keys.
      // Using them here delegates sorting (including pagination) to OJS.
      if (access.viewColumns && (!compact || appearance.showSubmitted) && configuredColumns.submitted !== false && !output.some(column => column.id === 'dateSubmitted')) {
        const title = output.findIndex(column => column.id === 'title');
        output.splice(title >= 0 ? title + 1 : 1, 0,
          {id: 'dateSubmitted', header: 'Submitted', component: 'OreDashboardCellSubmitted', sortable: true});
      }
      if (access.viewColumns && configuredColumns.lastUpdated !== false && !output.some(column => column.id === 'lastModified')) {
        const submitted = output.findIndex(column => column.id === 'dateSubmitted');
        const title = output.findIndex(column => column.id === 'title');
        output.splice(submitted >= 0 ? submitted + 1 : title >= 0 ? title + 1 : 2, 0,
          {id: 'lastModified', header: 'Last updated', component: 'OreDashboardCellLastUpdated', sortable: true});
      }
      if (configuredColumns.flag !== false && access.viewFlags && !output.some(column => column.id === 'oreFlag')) {
        const actions = output.findIndex(column => column.id === 'actions');
        output.splice(actions >= 0 ? actions : output.length, 0,
          {id: 'oreFlag', header: 'Flag', component: 'OreDashboardCellFlag', sortable: false});
      }
      return output;
    });

    const taskTitles = Array.isArray(config.taskTitles) ? config.taskTitles : [];
    const timeOptions = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        timeOptions.push({value: time, label: time});
      }
    }
    timeOptions.push({value: '23:59', label: '23:59'});
    const added = [
      makeField('oreTaskTitle', 'Editorial task or discussion',
        taskTitles.map(title => ({value: title, label: title})), 'field-select'),
      makeField('oreTaskStatus', 'Task / discussion status', [
        {value: 'open', label: 'Open'}, {value: 'closed', label: 'Closed'},
      ]),
      makeField('oreFlag', 'Submission flag', [
        {value: 'unflagged', label: 'No flag'},
        ...defaults.map(f => ({value: f.id, label: f.label})),
      ]),
      makeField('oreTimeFrom', 'Submitted after (time)', timeOptions, 'field-select'),
      makeField('oreTimeTo', 'Submitted before (time)', timeOptions, 'field-select'),
    ].filter(field => {
      if (!access.filters && field.name !== 'oreFlag') return false;
      if (field.name === 'oreFlag') return access.filters && access.viewFlags && features.oreFlag !== false;
      if (field.name === 'oreTimeFrom' || field.name === 'oreTimeTo')
        return features.oreSubmissionTime !== false;
      return features[field.name] !== false;
    });
    const params = new URLSearchParams(window.location.search);
    for (const field of added) {
      const value = params.get(field.name);
      const match = field.options.find(option => !Array.isArray(option.value) && String(option.value) === value);
      if (match) updateField(field, match.value, match.label);
    }
    const original = store.filtersForm;
    const extra = added.filter(field => !original.fields.some(existing => existing.name === field.name));
    if (extra.length) store.updateFiltersForm({...original, fields: [...original.fields, ...extra]});
    watch(() => optionNames.map(name => [getField(store, name)?.value, getField(store, name)?.selected]),
      () => reconcile(store), {deep: true, immediate: true, flush: 'sync'});

    if (!apiUrl || !access.viewFlags) return;
    fetchJson(`${apiUrl}/definitions`).then(data => {
      if (Array.isArray(data.flags)) {
        store.oreDefinitions = data.flags;
        applyDefinitionOptions(store);
      }
    }).catch(error => console.error('[ORE Dashboard Filters] Could not load flag definitions', error));

    let last = 0;
    watch(() => (store.submissions || []).map(item => Number(item.id)).join(','), async ids => {
      if (!ids) return;
      const token = ++last;
      try {
        const response = await fetchJson(`${apiUrl}?ids=${encodeURIComponent(ids)}`);
        if (token !== last) return;
        const editable = new Set((response.editableIds || []).map(Number));
        for (const id of ids.split(',')) {
          store.oreFlags[id] = response.flags?.[id] || '';
          store.oreCanEdit[id] = editable.has(Number(id));
        }
      } catch (e) {
        console.error('[ORE Dashboard Filters] Could not load flags', e);
      }
    }, {immediate: true});
  });
})();

/* ORE dashboard enhancement: begin */
/*
 * ORE Dashboard Filters 0.3.9, stock OJS 3.6 compact layout, accessible icon-only flag menu, lifecycle-safe overlays.
 * Dashboard presentation enhancement. Read-only authenticated submission API lookup on title hover; no persistent storage or database changes.
 * Keeps original interactive flag and review buttons in their original cells.
 */
(() => {
  'use strict';
  const KEY = 'OREDashboardWidthFix043';
  if (window[KEY]?.installed) return;
  const PREFIX = 'ore041';
  const STYLE_ID = `${PREFIX}-style`;
  const isDashboard = document.body?.classList.contains('pkp_page_dashboard') ||
    /\/dashboard\/editorial\b/.test(location.pathname);
  if (!isDashboard && document.readyState !== 'loading') return;

  const CSS = `
    /* Stock OJS 3.6's flex page must shrink instead of following table min-content. */
    body.pkp_page_dashboard .app__body { min-width: 0 !important; max-width: 100% !important; }
    body.pkp_page_dashboard .app__body > main.app__main {
      flex: 1 1 0% !important; width: 0 !important; min-width: 0 !important;
      max-width: 100% !important;
    }
    body.pkp_page_dashboard .app__main .app__page,
    body.pkp_page_dashboard .app__main .width--full {
      min-width: 0 !important; max-width: 100% !important; width: 100% !important;
      box-sizing: border-box !important;
    }
    /* OJS's table wrapper must not clip Headless UI popovers. */
    .${PREFIX}-host,
    .${PREFIX}-escape {
      max-width: 100% !important; min-width: 0 !important;
      overflow: visible !important; overflow-x: visible !important;
      overflow-y: visible !important;
      clip-path: none !important;
    }
    .${PREFIX}-host { width: 100% !important; }
    table.${PREFIX}-table {
      width: 100% !important; max-width: 100% !important; min-width: 0 !important;
      table-layout: fixed !important; border-collapse: separate !important;
      overflow: visible !important;
    }
    table.${PREFIX}-table > thead > tr > *,
    table.${PREFIX}-table > tbody > tr > * {
      box-sizing: border-box !important; min-width: 0 !important;
      max-width: none !important; padding-left: 6px !important; padding-right: 6px !important;
      vertical-align: middle !important;
    }
    table.${PREFIX}-table .${PREFIX}-hidden { display: none !important; }
    /* The submission column expands into spare space on wide screens. */
    table.${PREFIX}-table .${PREFIX}-col-submissions {
      max-width: none !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-submissions .ore-compact-title-text,
    table.${PREFIX}-table .${PREFIX}-col-submissions .text-base-normal {
      max-width: 100% !important;
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    /* Explicit widths are measured against the table. Title is the residual column. */
    table.${PREFIX}-table .${PREFIX}-col-id { width: var(--ore041-w-id, 52px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-submissions { width: var(--ore041-w-submissions, 320px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-updated { width: var(--ore041-w-updated, 125px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-days { width: var(--ore041-w-days, 58px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-activity { width: var(--ore041-w-activity, 260px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-flag { width: var(--ore041-w-flag, 150px) !important; }
    table.${PREFIX}-table .${PREFIX}-col-actions { width: var(--ore041-w-actions, 75px) !important; }
    table.${PREFIX}-table thead th {
      font-size: 11px !important; overflow: visible !important;
      text-overflow: clip !important; white-space: normal !important;
      line-height: 1.35 !important;
    }
    table.${PREFIX}-table thead .${PREFIX}-col-updated { overflow-wrap: normal !important; }
    table.${PREFIX}-table thead .${PREFIX}-col-activity,
    table.${PREFIX}-table thead .${PREFIX}-col-actions { white-space: nowrap !important; }
    table.${PREFIX}-table .${PREFIX}-col-id,
    table.${PREFIX}-table .${PREFIX}-col-days,
    table.${PREFIX}-table .${PREFIX}-col-updated {
      white-space: nowrap !important; overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    table.${PREFIX}-table tbody .${PREFIX}-col-submissions {
      overflow: hidden !important; text-overflow: ellipsis !important;
      white-space: nowrap !important; line-height: 1.3 !important;
    }
    table.${PREFIX}-table tbody .${PREFIX}-col-submissions > span,
    table.${PREFIX}-table tbody .${PREFIX}-col-submissions > a { min-width: 0 !important; }
    table.${PREFIX}-table .${PREFIX}-meta {
      display: flex !important; align-items: center; gap: 7px; margin-top: 4px;
      min-width: 0; max-width: 100%; overflow: hidden !important;
      font-size: 11px !important; line-height: 17px !important;
      font-weight: 400; color: #667085; white-space: nowrap !important;
    }
    table.${PREFIX}-table .${PREFIX}-stage {
      display: inline-flex; align-items: center; min-width: 0; max-width: 48%;
      overflow: hidden; flex-shrink: 1; white-space: nowrap;
    }
    table.${PREFIX}-table .${PREFIX}-stage > * { min-width: 0; max-width: 100%; }
    table.${PREFIX}-table .${PREFIX}-stage .whitespace-nowrap,
    table.${PREFIX}-table .${PREFIX}-stage span {
      overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }
    table.${PREFIX}-table .${PREFIX}-stage .rounded-full { flex-shrink: 0; }
    table.${PREFIX}-table .${PREFIX}-pub {
      display: inline-block; min-width: 0; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
      background: #eff6ff; color: #365b79; padding: 1px 5px; border-radius: 4px;
    }
    table.${PREFIX}-table .${PREFIX}-sub-meta,
    table.${PREFIX}-table .${PREFIX}-days-meta,
    table.${PREFIX}-table .${PREFIX}-id-meta { display: none; }
    /* Never suppress a configured flag label. The old v1 patch made it font-size:0. */
    table.${PREFIX}-table .${PREFIX}-col-flag {
      overflow: visible !important; position: relative !important;
      z-index: 2 !important;
    }
    table.${PREFIX}-table .${PREFIX}-flag-control {
      box-sizing: border-box !important; width: 100% !important;
      min-width: 0 !important; max-width: 100% !important;
      height: auto !important; min-height: 32px !important;
      padding: 4px 7px !important; display: inline-flex !important;
      flex-wrap: nowrap !important; align-items: center !important;
      justify-content: flex-start !important; gap: 5px !important;
      overflow: hidden !important; white-space: nowrap !important;
      line-height: 1.35 !important; font-size: 12px !important;
    }
    table.${PREFIX}-table .${PREFIX}-flag-control span,
    table.${PREFIX}-table .${PREFIX}-flag-control strong {
      font-size: 12px !important; line-height: 1.35 !important;
      min-width: 0 !important; text-overflow: ellipsis !important;
    }
    table.${PREFIX}-table .${PREFIX}-flag-control svg,
    table.${PREFIX}-table .${PREFIX}-flag-control img,
    table.${PREFIX}-table .${PREFIX}-flag-control i {
      flex-shrink: 0 !important;
    }
    /* Icon-only must not hide the only meaningful icon/text on a selected flag.
       Only text leaves explicitly tagged by JS are hidden when a genuine
       visual icon exists. The dropdown remains unchanged. */
    table.${PREFIX}-table.${PREFIX}-icon-only .${PREFIX}-flag-control {
      justify-content: center !important; gap: 2px !important;
      font-size: 12px !important;
    }
    table.${PREFIX}-table.${PREFIX}-icon-only .${PREFIX}-flag-control.${PREFIX}-has-icon .${PREFIX}-flag-label {
      display: none !important;
    }
    table.${PREFIX}-table.${PREFIX}-icon-only .${PREFIX}-flag-control:not(.${PREFIX}-has-icon) {
      justify-content: flex-start !important;
      font-size: 11px !important;
    }
    table.${PREFIX}-table.${PREFIX}-icon-only .${PREFIX}-flag-control:not(.${PREFIX}-has-icon) .${PREFIX}-flag-label {
      overflow: hidden !important; white-space: nowrap !important; text-overflow: ellipsis !important;
      font-size: 11px !important;
    }
    /* A native select's option list must never inherit an icon-only zero font. */
    table.${PREFIX}-table .${PREFIX}-col-flag select option {
      font-size: 13px !important; color: initial !important;
      visibility: visible !important; display: block !important;
    }
    /* Icon-only uses a controlled menu on macOS rather than the native
       selected-option snapshot, which can silently omit the active label. */
    table.${PREFIX}-table .ore042-flag-trigger {
      position: absolute !important; inset: 0 !important; width: 100% !important;
      height: 100% !important; z-index: 12 !important;
      border: 0 !important; padding: 0 !important; background: transparent !important;
      cursor: pointer !important; box-shadow: none !important;
    }
    table.${PREFIX}-table .ore042-flag-trigger:focus-visible {
      outline: 2px solid #2563eb !important; outline-offset: -2px !important;
    }
    /* Only the existing hover card grows; no dashboard column widths change. */
    .ore043-stage-section { margin-top: 10px; }
    .ore043-stage-section:first-child { margin-top: 0; }
    .ore043-stage-section [data-ore-tip-heading] { margin-bottom: 4px; }
    .ore043-stage-list { display: flex; flex-direction: column; gap: 3px; }
    .ore043-stage-person { font-size: 13px; line-height: 1.45; color: #243547; overflow-wrap: anywhere; }
    .ore043-stage-person--muted { font-size: 12px; color: #617084; }
    .ore043-stage-badge { font-size: 11px; font-weight: normal; color: #617084; }
    .ore042-flag-menu {
      position: fixed !important; z-index: 40020 !important;
      width: min(270px, calc(100vw - 24px)) !important;
      max-height: min(360px, calc(100vh - 24px)) !important;
      overflow-y: auto !important; overflow-x: hidden !important;
      padding: 5px !important; border: 1px solid #bdc9d6 !important;
      border-radius: 9px !important; background: #fff !important;
      box-shadow: 0 10px 30px rgba(22,36,52,.24) !important;
      color: #243547 !important; font: 13px system-ui, -apple-system, sans-serif !important;
    }
    .ore042-flag-menu button[role="option"] {
      display: flex !important; width: 100% !important; align-items: center !important;
      gap: 9px !important; min-height: 36px !important; padding: 7px 9px !important;
      border: none !important; border-radius: 5px !important;
      background: transparent !important; color: #243547 !important;
      text-align: left !important; font: 13px system-ui, -apple-system, sans-serif !important;
      cursor: pointer !important;
    }
    .ore042-flag-menu button[role="option"]:hover,
    .ore042-flag-menu button[role="option"]:focus-visible {
      background: #eef4fc !important; outline: 1px solid #9dc2fa !important;
    }
    .ore042-flag-menu button[role="option"][aria-selected="true"] {
      background: #e8f0ff !important; font-weight: 700 !important;
    }
    .ore042-flag-menu button[role="option"]:disabled { opacity: .45; cursor: not-allowed !important; }
    .ore042-flag-check { min-width: 15px; font-weight: bold; text-align: center; color: #0369a1; }
    .ore042-flag-dot { display: inline-block; flex: 0 0 auto; width: 12px; height: 12px;
      border-radius: 50%; background: var(--ore042-flag-colour, #9ca3af);
      border: 1px solid rgba(0,0,0,.12); }
    .ore042-flag-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .${PREFIX}-title-tip.ore042-flag-tip {
      border-left: 4px solid var(--ore042-flag-colour, #9ca3af) !important;
    }
    .ore042-flag-chip { display: inline-flex; align-items: center; gap: 8px;
      padding: 5px 9px; border-radius: 5px;
      background: color-mix(in srgb, var(--ore042-flag-colour,#9ca3af) 12%, white);
      color: #243547; font-weight: 650; }
    .${PREFIX}-title-tip {
      position: fixed !important; z-index: 20000 !important;
      box-sizing: border-box !important; min-width: 260px;
      width: min(470px, calc(100vw - 24px)) !important;
      max-height: min(55vh, 420px) !important; overflow: auto !important;
      background: #ffffff !important; color: #263646 !important;
      border: 1px solid #a6b4c5 !important; border-radius: 7px !important;
      box-shadow: 0 7px 26px rgba(11, 28, 45, 0.2) !important;
      padding: 14px 16px !important; font: 13px/1.5 system-ui, -apple-system, sans-serif !important;
      text-align: left !important; white-space: normal !important;
    }
    .${PREFIX}-title-tip [data-ore-tip-heading] {
      font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important;
      color: #526277 !important; margin: 0 0 4px !important;
    }
    .${PREFIX}-title-tip [data-ore-tip-title] {
      font-size: 14px !important; font-weight: 600 !important;
      overflow-wrap: anywhere !important; margin-bottom: 12px !important;
    }
    .${PREFIX}-title-tip [data-ore-tip-person] {
      margin-top: 8px !important; overflow-wrap: anywhere !important;
    }
    .${PREFIX}-title-tip a { color: #0369a1 !important; text-decoration: underline !important; }
    .${PREFIX}-title-tip [data-ore-tip-status] { color: #667085 !important; font-size: 12px !important; }
    .${PREFIX}-title-tip.${PREFIX}-info-tip {
      width: min(365px, calc(100vw - 24px)) !important;
      min-width: min(250px, calc(100vw - 24px)) !important;
    }
    .${PREFIX}-title-tip [data-ore-tip-row] { margin-top: 7px !important; }
    .${PREFIX}-title-tip [data-ore-tip-value] {
      font-size: 13px !important; font-weight: 550 !important;
      overflow-wrap: anywhere !important;
    }
    table.${PREFIX}-table .${PREFIX}-help-target,
    table.${PREFIX}-table .${PREFIX}-col-submissions.${PREFIX}-title-target { cursor: help !important; }
    table.${PREFIX}-table .${PREFIX}-help-target:focus-visible {
      outline: 2px solid #0073a8 !important; outline-offset: 1px !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-submissions.${PREFIX}-title-target:focus-visible {
      outline: 2px solid #0073a8 !important; outline-offset: -2px !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-flag:has([aria-expanded="true"]) {
      z-index: 3200 !important;
    }
    /* Headless UI popovers are positioned relative to their original buttons. */
    table.${PREFIX}-table .${PREFIX}-col-activity {
      overflow: visible !important; position: relative !important;
      z-index: 3 !important;
      white-space: normal !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-activity > *,
    table.${PREFIX}-table .${PREFIX}-col-activity > * > *,
    table.${PREFIX}-table .${PREFIX}-col-activity [data-headlessui-state] {
      overflow: visible !important;
    }
    table.${PREFIX}-table tbody tr:has([id^="headlessui-popover-button-"][aria-expanded="true"]) {
      position: relative !important; z-index: 3500 !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-activity:has([id^="headlessui-popover-button-"][aria-expanded="true"]) {
      z-index: 3600 !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-activity [id^="headlessui-popover-panel-"] {
      z-index: 3700 !important;
      max-width: min(390px, calc(100vw - 28px)) !important;
      overflow: visible !important;
    }
    table.${PREFIX}-table .${PREFIX}-activity-strip {
      display: flex !important; flex-wrap: nowrap !important; align-items: center !important;
      gap: 4px !important; max-width: 100%; min-width: 0;
    }
    table.${PREFIX}-table .${PREFIX}-activity-strip > .${PREFIX}-extra {
      display: none !important;
    }
    table.${PREFIX}-table .${PREFIX}-more {
      flex: none; min-width: 31px; height: 24px; padding: 0 4px;
      border: 1px solid #cbd5e1; border-radius: 15px;
      background: #f8fafc; color: #334155; font-size: 11px;
      line-height: 1; font-weight: 600; cursor: pointer;
    }
    table.${PREFIX}-table .${PREFIX}-open { z-index: 3000 !important; }
    table.${PREFIX}-table .${PREFIX}-open .${PREFIX}-activity-strip {
      position: absolute !important; top: 60%; right: 0;
      width: min(295px, calc(100vw - 28px)); max-width: calc(100vw - 28px);
      padding: 12px; display: flex !important; flex-wrap: wrap !important;
      gap: 8px !important; background: #fff; border: 1px solid #cbd5e1;
      border-radius: 7px; box-shadow: 0 5px 20px #0003; z-index: 21;
    }
    table.${PREFIX}-table .${PREFIX}-open .${PREFIX}-activity-strip > .${PREFIX}-extra {
      display: inline-block !important;
    }
    table.${PREFIX}-table .${PREFIX}-col-actions { white-space: nowrap !important; }
    table.${PREFIX}-table.${PREFIX}-narrow .${PREFIX}-col-updated { display: none !important; }
    table.${PREFIX}-table.${PREFIX}-narrow .${PREFIX}-sub-meta { display: inline; }
    table.${PREFIX}-table.${PREFIX}-very-narrow .${PREFIX}-col-days { display: none !important; }
    table.${PREFIX}-table.${PREFIX}-very-narrow .${PREFIX}-days-meta { display: inline; }
    table.${PREFIX}-table.${PREFIX}-tiny .${PREFIX}-col-id { display: none !important; }
    table.${PREFIX}-table.${PREFIX}-tiny .${PREFIX}-id-meta { display: inline; }
    table.${PREFIX}-table.${PREFIX}-tiny .${PREFIX}-activity-strip { gap: 2px !important; }
  `;

  let observer = null;
  let resizeObserver = null;
  let scheduled = false;
  let installed = true;
  let titleTip = null;
  let titleTipCell = null;
  let titleTipTimer = null;
  let tipHideTimer = null;
  let activeTitleKey = '';
  const authorCache = new Map();
  const stageCache = new Map();
  const STAGE_CACHE_MS = 30000;
  const flagDefinitions = new Map();
  const flagDefinitionsByName = new Map();
  // Remember real option names before Vue rewrites a selected native option.
  const flagOptionNames = new Map();
  let flagMenu = null;
  let flagMenuTrigger = null;
  let flagMenuSelect = null;
  let flagDefinitionPromise = null;
  let flagDefinitionsReady = false;
  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const normalise = value => String(value || '').toLowerCase()
    .replace(/\bsort\b/g, '').replace(/[↑↓↕⇅]/g, '')
    .replace(/\s+/g, ' ').trim();
  const cells = row => Array.from(row.children).filter(el => /^(TD|TH)$/.test(el.tagName));
  const byHeading = heads => {
    const result = {};
    heads.forEach((th, index) => {
      const t = normalise(th.textContent);
      if (t === 'id') result.id = index;
      else if (t === 'submissions' || t === 'submission') result.submissions = index;
      else if (t === 'submitted' || t === 'date submitted') result.submitted = index;
      else if (t === 'last updated' || t === 'updated') result.updated = index;
      else if (t === 'stage') result.stage = index;
      else if (t === 'publishing stage' || t === 'publication stage') result.publishing = index;
      else if (t === 'days') result.days = index;
      else if (t === 'editorial activity') result.activity = index;
      else if (t === 'flag' || t === 'flags') result.flag = index;
      else if (t === 'actions') result.actions = index;
    });
    return result;
  };

  function compatibleTable(table) {
    const heads = cells(table.tHead?.rows?.[0] || document.createElement('tr'));
    const map = byHeading(heads);
    if (map.submissions === undefined || map.activity === undefined ||
        map.actions === undefined || map.flag === undefined || heads.length < 7) return null;
    return { heads, map };
  }

  function applyMeta(cols, map) {
    const titleCell = cols[map.submissions];
    if (!titleCell) return;
    let meta = titleCell.querySelector(':scope > .ore041-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'ore041-meta';
      titleCell.appendChild(meta);
    }
    const stage = map.stage === undefined ? null : cols[map.stage];
    const pub = map.publishing === undefined ? null : cols[map.publishing];
    const submitted = map.submitted === undefined ? null : cols[map.submitted];
    const updated = map.updated === undefined ? null : cols[map.updated];
    const days = map.days === undefined ? null : cols[map.days];
    const id = map.id === undefined ? null : cols[map.id];
    const stageText = stage?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const pubText = pub?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const submittedText = submitted?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const updatedText = updated?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const daysText = days?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const idText = id?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const stamp = [stageText, pubText, submittedText, updatedText, daysText, idText].join('\u001f');
    if (meta.dataset.stamp !== stamp) {
      meta.replaceChildren();
      if (stageText) {
        const s = document.createElement('span');
        s.className = 'ore041-stage ore041-help-target';
        s.dataset.ore041Kind = 'stage';
        s.tabIndex = 0;
        const display = stage.querySelector('.flex');
        if (display) s.appendChild(display.cloneNode(true));
        else s.textContent = stageText;
        meta.appendChild(s);
      }
      if (pubText) {
        const p = document.createElement('span');
        p.className = 'ore041-pub ore041-help-target';
        p.dataset.ore041Kind = 'publishing';
        p.tabIndex = 0;
        p.textContent = pubText;
        // The same information is available in the unified help overlay.
        meta.appendChild(p);
      }
      for (const [kind, text] of [['sub', updatedText], ['days', daysText], ['id', idText]]) {
        if (!text) continue;
        const span = document.createElement('span');
        span.className = `ore041-${kind}-meta`;
        span.textContent = kind === 'sub' ? `Updated ${text}` : kind === 'days' ? `${text} days` : `#${text}`;
        meta.appendChild(span);
      }
      meta.dataset.stamp = stamp;
    }
    const tip = [updatedText ? `Last updated: ${updatedText}` : '',
      submittedText ? `Submitted: ${submittedText}` : ''].filter(Boolean).join('\n');
    if (tip && updated && updated.dataset.ore041Tip !== tip) {
      updated.dataset.ore041Tip = tip;
      updated.removeAttribute('title');
    }
    if (submittedText && titleCell.dataset.ore041Submitted !== submittedText) {
      titleCell.dataset.ore041Submitted = submittedText;
      // The full-title hover panel supplies submission context; avoid a competing native tooltip.
      titleCell.removeAttribute('title');
    }
  }

  // Flag display mode affects only the closed control. Dropdown option names
  // are restored from the same journal-specific definitions as the designer.
  function flagAPI() {
    const raw = window.oreDashboardFiltersV3Config?.flagsApiUrl;
    if (typeof raw !== 'string' || !raw.trim()) return '';
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) {
        const local = h => ['localhost', '127.0.0.1', '[::1]'].includes(h);
        if (!local(url.hostname) || !local(location.hostname) || url.port !== location.port) return '';
        url.hostname = location.hostname;
        url.protocol = location.protocol;
      }
      if (!url.pathname.includes('/api/v1/ore-dashboard-flags')) return '';
      return url.href;
    } catch { return ''; }
  }
  function unpackFlags(payload) {
    const possibilities = [payload, payload?.flags, payload?.items, payload?.definitions,
      payload?.flagDefinitions, payload?.data, payload?.data?.flags, payload?.data?.items,
      payload?.result?.flags, payload?.settings?.flags];
    for (const raw of possibilities) {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw);
        if (entries.length && entries.every(([id, value]) =>
          value && typeof value === 'object' && !Array.isArray(value))) {
          return entries.map(([id,value]) => ({ ...value, id:value.id ?? id }));
        }
      }
    }
    return [];
  }
  function receiveFlags(payload) {
    const items = unpackFlags(payload);
    let count = 0;
    for (const flag of items) {
      if (!flag || typeof flag !== 'object') continue;
      const id = flag.id ?? flag.flagId ?? flag.flag_id ?? flag.value;
      const label = safeText(flag.name) || safeText(flag.label) || safeText(flag.title) ||
        safeText(flag.fullName) || safeText(flag.displayName);
      const short = safeText(flag.shortLabel) || safeText(flag.short_label);
      if (id == null || !label) continue;
      const item = { id:String(id), name:label, short, color:flag.color || flag.colour || '' };
      flagDefinitions.set(String(id),item);
      flagOptionNames.set(String(id),label);
      flagDefinitionsByName.set(label.toLocaleLowerCase(),item);
      if (short) flagDefinitionsByName.set(short.toLocaleLowerCase(),item);
      count++;
    }
    flagDefinitionsReady = count > 0;
    return count;
  }
  function loadFlagDefinitions() {
    if (flagDefinitionPromise) return flagDefinitionPromise;
    const url = flagAPI();
    if (!url) return Promise.resolve(false);
    flagDefinitionPromise = readJSON(url)
      .then(payload => { receiveFlags(payload); schedule(); return flagDefinitionsReady; })
      .catch(() => false);
    return flagDefinitionPromise;
  }
  function flagByValue(value) {
    const raw = clean(value);
    return flagDefinitions.get(raw) || flagDefinitions.get(raw.replace(/^(flag|id)[-_:/]/i,'')) || null;
  }
  function meaningfulFlagText(raw) {
    const text = clean(raw);
    return text && !/^[-–—✓✔☑✅\s]+$/u.test(text) ? text : '';
  }
  function flagOptionName(option) {
    if (!option) return '';
    const key = String(option.value);
    if (!key) return 'No flag';
    const fromDefinition = flagByValue(key)?.name;
    const fromDom = meaningfulFlagText(option.dataset.ore041FullName ||
      option.dataset.fullName || option.dataset.label || option.getAttribute('aria-label') ||
      option.title || option.textContent);
    const found = fromDefinition || flagOptionNames.get(key) || fromDom;
    if (found) flagOptionNames.set(key,found);
    return found || '';
  }
  function restoreFlagOptions(cell) {
    // Restore before the native control is opened, and remember the names even
    // when a Vue rerender subsequently blanks a selected option's text.
    for (const select of cell.querySelectorAll('select')) {
      const selectedValue = select.value;
      for (const option of select.options) {
        const full = flagOptionName(option);
        if (!full) continue;
        if (clean(option.textContent) !== full) option.textContent = full;
        if (option.title !== full) option.title = full;
        if (option.dataset.ore041FullName !== full) option.dataset.ore041FullName = full;
      }
      if (select.value !== selectedValue) select.value = selectedValue;
    }
  }
  function usableFlagColour(raw) {
    const color = clean(raw);
    return color && color.length <= 64 && !/url\(|var\(|expression|[;{}]/i.test(color) &&
      typeof window.CSS !== 'undefined' && window.CSS.supports('color', color) &&
      !/^(transparent|currentcolor|inherit|initial|unset)$/i.test(color) ? color : '';
  }
  function flagColour(flag,cell) {
    const defined = usableFlagColour(flag?.color);
    if (defined) return defined;
    // A read-only fallback when the flags API omits colours: use the colour
    // already rendered on this flag's control, but not a grey/neutral border.
    const control = cell?.querySelector('button:not(.ore042-flag-trigger),select');
    if (!control) return '';
    const computed = getComputedStyle(control);
    const candidates = [computed.borderTopColor,computed.color,
      control.querySelector('svg')?.getAttribute('stroke'),
      control.querySelector('svg')?.getAttribute('fill')];
    for (const raw of candidates) {
      const color=usableFlagColour(raw);
      if (!color) continue;
      const match=/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color);
      if (match) {
        const rgb=match.slice(1,4).map(Number);
        if (Math.max(...rgb)-Math.min(...rgb) >= 55) return color;
      } else if (/^#[0-9a-f]{6}$/i.test(color)) {
        const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
        if (Math.max(...rgb)-Math.min(...rgb) >= 55) return color;
      }
    }
    return '';
  }
  function closeFlagMenu(returnFocus = false) {
    const trigger = flagMenuTrigger;
    flagMenu?.remove();
    flagMenu = null; flagMenuTrigger = null; flagMenuSelect = null;
    if (trigger) {
      trigger.setAttribute('aria-expanded','false');
      if (returnFocus && trigger.isConnected) trigger.focus({preventScroll:true});
    }
  }
  function positionFlagMenu() {
    if (!flagMenu || !flagMenuTrigger?.isConnected) return;
    const rect = flagMenuTrigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const mw = Math.min(270, vw - 24);
    const mh = Math.min(flagMenu.scrollHeight,360,vh-24);
    flagMenu.style.left = `${Math.max(12,Math.min(rect.right-mw,vw-mw-12))}px`;
    const preferredTop = rect.bottom + 5;
    flagMenu.style.top = `${preferredTop + mh > vh - 12 ?
      Math.max(12,rect.top-mh-5) : preferredTop}px`;
  }
  function openFlagMenu(cell,trigger) {
    const select = cell?.querySelector('select');
    if (!select) return;
    if (flagMenu && flagMenuTrigger === trigger) { closeFlagMenu(true); return; }
    closeFlagMenu(); hideTip();
    restoreFlagOptions(cell);
    const panel = document.createElement('div');
    panel.className = 'ore042-flag-menu';
    panel.setAttribute('role','listbox');
    panel.setAttribute('aria-label','Select an editorial flag');
    panel.tabIndex = -1;
    for (const option of Array.from(select.options)) {
      const name = flagOptionName(option);
      const item = document.createElement('button');
      item.type = 'button'; item.setAttribute('role','option');
      const selected = select.value === option.value;
      item.setAttribute('aria-selected',String(selected));
      item.dataset.value = option.value;
      item.disabled = option.disabled;
      const check = document.createElement('span');
      check.className='ore042-flag-check'; check.textContent = selected ? '✓' : '';
      const flag = flagByValue(option.value);
      const color = usableFlagColour(flag?.color);
      if (color) {
        const dot = document.createElement('span');dot.className='ore042-flag-dot';
        dot.style.setProperty('--ore042-flag-colour',color);item.appendChild(check);item.appendChild(dot);
      } else { item.appendChild(check); }
      const text = document.createElement('span');
      text.className='ore042-flag-name';
      text.textContent = name || (option.value ? 'Flag name unavailable' : 'No flag');
      item.appendChild(text);
      item.addEventListener('click',event=>{
        event.preventDefault(); event.stopPropagation();
        if (select.isConnected && select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event('input',{bubbles:true}));
          select.dispatchEvent(new Event('change',{bubbles:true}));
        }
        closeFlagMenu(true);
        schedule();
      });
      panel.appendChild(item);
    }
    if (!panel.children.length) return;
    document.body.appendChild(panel);
    flagMenu = panel;flagMenuTrigger = trigger;flagMenuSelect = select;
    trigger.setAttribute('aria-expanded','true');
    positionFlagMenu();
    const selected = panel.querySelector('[aria-selected="true"]');
    const enabled = panel.querySelector('button:not(:disabled)');
    (selected || enabled)?.focus({preventScroll:true});
  }
  function syncFlagTrigger(cell) {
    const select = cell.querySelector('select');
    let trigger = cell.querySelector('.ore042-flag-trigger');
    const mode = String(window.oreDashboardFiltersV3Config?.appearance?.flagDisplay || '').toLowerCase();
    const iconOnly = ['icon','icons','icon-only','icon_only'].includes(mode);
    if (!select || !iconOnly) {
      if (trigger) trigger.remove();
      if (select && select.dataset.ore042PreviousTabindex !== undefined) {
        const old = select.dataset.ore042PreviousTabindex;
        if (old === '__none__') select.removeAttribute('tabindex');
        else select.setAttribute('tabindex',old);
        delete select.dataset.ore042PreviousTabindex;
      }
      if (flagMenu && flagMenuTrigger === trigger) closeFlagMenu();
      return;
    }
    if (!trigger) {
      trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='ore042-flag-trigger ore041-help-target';
      trigger.dataset.ore041Kind='flag';
      trigger.setAttribute('aria-haspopup','listbox');
      trigger.setAttribute('aria-expanded','false');
      trigger.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        openFlagMenu(cell,trigger);
      });
      cell.appendChild(trigger);
    }
    if (select.dataset.ore042PreviousTabindex === undefined) {
      select.dataset.ore042PreviousTabindex = select.hasAttribute('tabindex') ? select.getAttribute('tabindex') : '__none__';
      select.tabIndex = -1;
    }
    const label = flagInfo(cell)?.name || 'Select flag';
    const aria = `Change flag: ${label}`;
    if (trigger.getAttribute('aria-label') !== aria) trigger.setAttribute('aria-label',aria);
  }
  function flagInfo(cell) {
    const select = cell.querySelector('select');
    const selected = select?.selectedOptions?.[0];
    const data = selected ? flagByValue(selected.value) ||
      flagDefinitionsByName.get(clean(selected.textContent).toLocaleLowerCase()) : null;
    if (data) return data;
    const control = cell.querySelector('button,select');
    const own = clean(control?.getAttribute('data-ore041-label') || '');
    const aria = clean(control?.getAttribute('aria-label') || '').replace(/^Flag:\s*/i,'');
    const attr = clean(control?.getAttribute('title') || '');
    const caption = clean(selected?.dataset?.ore041FullName || selected?.title ||
      selected?.textContent || own || aria || attr || '');
    return flagDefinitionsByName.get(caption.toLocaleLowerCase()) ||
      {name:caption || 'No flag selected', short:'', color:''};
  }
  function applyFlag(cell) {
    if (!cell) return;
    loadFlagDefinitions();
    restoreFlagOptions(cell);
    const control = cell.querySelector('button, select');
    if (!control) return;
    const textLeaves = Array.from(control.querySelectorAll('span,strong')).filter(node =>
      !node.querySelector('span,strong,svg,img,i') && !!node.textContent.trim());
    const selected = flagInfo(cell);
    const label = selected.name ||
      textLeaves.map(node => clean(node.textContent)).filter(Boolean).join(' ').trim();
    if (label && control.dataset.ore041Label !== label) {
      control.dataset.ore041Label = label;
      // A formerly generated label should be refreshed after selection changes.
      if (!control.getAttribute('title') || control.dataset.ore041OwnTitle === '1') {
        // The floating help panel replaces the browser's native title balloon.
        control.dataset.ore041OwnTitle = '1';
      }
      if (!control.getAttribute('aria-label') || control.dataset.ore041OwnAria === '1') {
        control.setAttribute('aria-label', `Flag: ${label}`);
        control.dataset.ore041OwnAria = '1';
      }
    }
    if (control.dataset.ore041OwnTitle === '1') control.removeAttribute('title');
    control.classList.add('ore041-flag-control','ore041-help-target');
    control.dataset.ore041Kind = 'flag';
    const svgs = Array.from(control.querySelectorAll('svg'));
    const images = Array.from(control.querySelectorAll('img,i'));
    // A single chevron is not the flag's icon.
    const realGraphic = images.length > 0 || svgs.length > 1 || svgs.some(svg => {
      const w = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
      const classHint = String(svg.getAttribute('class') || '');
      return w >= 15 && !/chevron|dropdown|caret|arrow-down/i.test(classHint);
    });
    const emojiLeaf = textLeaves.find(node => /\p{Extended_Pictographic}/u.test(node.textContent));
    const hasIcon = realGraphic || Boolean(emojiLeaf);
    control.classList.toggle('ore041-has-icon',hasIcon);
    textLeaves.forEach(node => node.classList.toggle('ore041-flag-label',node !== emojiLeaf));
    syncFlagTrigger(cell);
  }

  function safeText(value, locale = 'en') {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const variants = [value[locale], value.en, value['en_US'], ...Object.values(value)];
      for (const item of variants) if (typeof item === 'string' && item.trim()) return item.trim();
    }
    return '';
  }
  function plainText(str) {
    const inert = new DOMParser().parseFromString(String(str || ''), 'text/html');
    return (inert.body.textContent || '').trim();
  }
  function extractTitle(cell) {
    const titleNode = cell.querySelector(':scope > .text-base-normal');
    if (titleNode?.textContent.trim()) return titleNode.textContent.trim();
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('.ore041-meta,.ore039-meta').forEach(node => node.remove());
    const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    return text.includes(' — ') ? text.split(' — ').slice(1).join(' — ') : text;
  }
  function submissionIdOf(cell) {
    const id = /submission-title-(\d+)/.exec(cell.id || '')?.[1];
    if (id) return id;
    const row = cell.closest('tr');
    const text = row?.querySelector('td')?.textContent?.trim() || '';
    return /^\d+$/.test(text) ? text : '';
  }
  function apiBase() {
    const relative = window.pkp?.context?.apiBaseUrl || window.journal?.apiBaseUrl || '';
    if (!relative) return '';
    try {
      const url = new URL(relative, window.location.href);
      if (url.origin !== window.location.origin) {
        // OJS may advertise localhost while editors open 127.0.0.1:8083.
        // Rebase only equivalent loopback addresses on the same port.
        const current = new URL(window.location.href);
        const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
        if (!loopback(url.hostname) || !loopback(current.hostname) || url.port !== current.port) return '';
        url.protocol = current.protocol;
        url.hostname = current.hostname;
      }
      if (!url.pathname.includes('/api/v1/')) return '';
      return url.href.replace(/\/+$/, '') + '/';
    } catch { return ''; }
  }
  function publicationFrom(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const current = payload.currentPublication;
    if (current && typeof current === 'object') return current;
    const ps = Array.isArray(payload.publications) ? payload.publications :
      Array.isArray(payload.publications?.items) ? payload.publications.items : [];
    const wanted = payload.currentPublicationId ?? payload.currentPublication?.id;
    return ps.find(p => String(p.id) === String(wanted)) || ps.at(-1) || null;
  }
  async function readJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept:'application/json' } });
    if (!res.ok) throw new Error(`OJS returned ${res.status}`);
    const contentType = res.headers?.get('content-type') || '';
    if (!contentType.includes('json')) throw new Error('OJS did not return JSON');
    return res.json();
  }
  async function fetchAuthorDetails(id) {
    const base = apiBase();
    if (!base) return { people:[], status:'Corresponding author details unavailable: OJS API URL not available' };
    try {
      const payload = await readJSON(`${base}submissions/${encodeURIComponent(id)}`);
      let pub = publicationFrom(payload);
      const currentId = payload.currentPublicationId || pub?.id;
      if ((!pub || !Array.isArray(pub.authors)) && currentId) {
        try { pub = await readJSON(`${base}submissions/${encodeURIComponent(id)}/publications/${encodeURIComponent(currentId)}`); }
        catch { /* May not be exposed to this role; retain the original data. */ }
      }
      let authors = Array.isArray(pub?.authors) ? pub.authors : Array.isArray(payload.authors) ? payload.authors : [];
      if (!authors.length && currentId) {
        try {
          const contributors = await readJSON(`${base}submissions/${encodeURIComponent(id)}/publications/${encodeURIComponent(currentId)}/contributors`);
          authors = Array.isArray(contributors) ? contributors : Array.isArray(contributors.items) ? contributors.items : [];
        } catch { /* optional fallback */ }
      }
      const contact = pub?.primaryContactId ?? payload.primaryContactId;
      const matches = authors.filter(a => a && (
        (contact != null && String(a.id) === String(contact)) ||
        a.isCorrespondingAuthor === true || a.primaryContact === true ||
        a.isPrimaryContact === true || a.corresponding === true
      ));
      const locale = window.pkp?.context?.currentLocale || 'en';
      const people = matches.map(a => {
        const first = safeText(a.givenName, locale);
        const last = safeText(a.familyName, locale);
        const name = plainText(safeText(a.fullName, locale) || safeText(a.preferredPublicName, locale) ||
          safeText(a.organizationName, locale) || [first, last].filter(Boolean).join(' '));
        const email = typeof a.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) ? a.email : '';
        return { name: name || 'Corresponding author', email };
      });
      return { people, status: people.length ? '' : 'No corresponding author identified in the available OJS metadata' };
    } catch (error) {
      return { people:[], status:'Corresponding author details are not available to this account' };
    }
  }
  function tipDetails(tip, result) {
    const info = tip.querySelector('[data-ore-tip-details]');
    if (!info) return;
    info.replaceChildren();
    if (!result.people?.length) {
      const status = document.createElement('div');
      status.dataset.oreTipStatus = '';
      status.textContent = result.status || 'Corresponding author details unavailable';
      info.appendChild(status);
      return;
    }
    for (const person of result.people) {
      const item = document.createElement('div');
      item.dataset.oreTipPerson = '';
      const name = document.createElement('div');
      name.textContent = person.name;
      item.appendChild(name);
      if (person.email) {
        const link = document.createElement('a');
        link.href = `mailto:${person.email}`;
        link.textContent = person.email;
        item.appendChild(link);
      } else {
        const missing = document.createElement('span');
        missing.textContent = 'Email not available';
        item.appendChild(missing);
      }
      info.appendChild(item);
    }
  }
  function positionTip() {
    if (!titleTip || !titleTipCell?.isConnected) return;
    const anchor = titleTipCell.getBoundingClientRect();
    const ww = document.documentElement.clientWidth;
    const wh = document.documentElement.clientHeight;
    const tipWidth = Math.min(titleTip.getBoundingClientRect().width || 470, ww - 24);
    titleTip.style.left = `${Math.max(12, Math.min(anchor.left, ww - tipWidth - 12))}px`;
    const height = titleTip.getBoundingClientRect().height;
    const below = anchor.bottom + 7;
    titleTip.style.top = `${below + height > wh - 12 && anchor.top > height + 10 ? anchor.top - height - 7 : Math.min(below, wh - height - 12)}px`;
  }
  function hideTip() {
    clearTimeout(titleTipTimer);
    clearTimeout(tipHideTimer);
    titleTipTimer=null;tipHideTimer=null;
    if (titleTipCell?.getAttribute('aria-describedby') === 'ore041-submission-tooltip') {
      titleTipCell.removeAttribute('aria-describedby');
    }
    titleTip?.remove();
    titleTip = null; titleTipCell = null; activeTitleKey = '';
  }
  function deferHideTip() {
    // Do not endlessly postpone dismissal during continued pointer movement.
    if (tipHideTimer) return;
    tipHideTimer = setTimeout(() => {tipHideTimer=null;hideTip();}, 130);
  }
  function onGlobalPointerMove(event) {
    if (!titleTip) return;
    if (!titleTipCell?.isConnected || !titleTipCell.closest('table.ore041-table')) {
      hideTip();return;
    }
    const node = event.target;
    if (node instanceof Node && (titleTipCell.contains(node) || titleTip.contains(node) ||
      node.closest?.('.ore041-title-target,.ore041-help-target'))) {
      clearTimeout(tipHideTimer);tipHideTimer=null;
    } else deferHideTip();
  }
  function onPointerDown(event) {
    const node = event.target;
    if (flagMenu && node instanceof Node &&
        !flagMenu.contains(node) && !flagMenuTrigger?.contains(node)) closeFlagMenu();
    if (titleTip && node instanceof Node &&
        !titleTip.contains(node)) hideTip();
  }
  function onWindowBlur() { hideTip(); if (document.hidden) closeFlagMenu(); }
  function onVisibilityChange() { if (document.hidden) {hideTip();closeFlagMenu();} }
  function onPageExit() { hideTip();closeFlagMenu(); }
  function onWindowMouseLeave(event) {
    if (!event.relatedTarget) hideTip();
  }
  function tipRow(tip,label,value) {
    if (!clean(value)) return;
    const row = document.createElement('div');
    row.dataset.oreTipRow = '';
    const key = document.createElement('div');
    key.dataset.oreTipHeading = '';
    key.textContent = label;
    const text = document.createElement('div');
    text.dataset.oreTipValue = '';
    text.textContent = clean(value);
    row.append(key,text);
    tip.appendChild(row);
  }
  // The stage details use only authenticated OJS 3.6 API data. The list
  // endpoint is stage-specific, so authors or participants from other stages
  // are never misrepresented as assigned to the current workflow stage.
  function asList(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?._data)) return value._data;
    if (Array.isArray(value?.data)) return value.data;
    return null;
  }
  function compactPersonName(person) {
    const locale = window.pkp?.context?.currentLocale || 'en';
    return plainText(safeText(person?.fullName,locale) ||
      safeText(person?.name,locale) ||
      safeText(person?.preferredPublicName,locale) ||
      [safeText(person?.givenName,locale),safeText(person?.familyName,locale)]
        .filter(Boolean).join(' '));
  }
  function stageNumber(stageText) {
    if (/review/i.test(stageText)) return 3;
    if (/copyedit|editorial checks|editing/i.test(stageText)) return 4;
    if (/production/i.test(stageText)) return 5;
    if (/submission|editorial check/i.test(stageText)) return 1;
    return null;
  }
  function latestReviewRound(payload) {
    const rounds = asList(payload?.reviewRounds) || [];
    const reviewRounds = rounds.filter(r => Number(r?.stageId ?? 3) === 3);
    return reviewRounds.sort((a,b) => Number(b.round || 0) - Number(a.round || 0))[0] || null;
  }
  function assignedReviewers(payload) {
    const all = asList(payload?.reviewAssignments);
    if (all === null) return { names:[], unavailable:true, round:null };
    const round = latestReviewRound(payload);
    let relevant = all;
    if (round) {
      const hasRound = all.some(a => a?.reviewRoundId != null || a?.round != null);
      if (hasRound) relevant = all.filter(a =>
        (a?.reviewRoundId != null && String(a.reviewRoundId) === String(round.id)) ||
        (a?.round != null && Number(a.round) === Number(round.round)));
    } else if (all.some(a => Number.isFinite(Number(a?.round)) && a?.round != null)) {
      const latest = Math.max(...all.map(a => Number(a?.round || 0)));
      relevant = all.filter(a => Number(a?.round || 0) === latest);
    }
    // Cancelled assignments are no longer assigned. Declined invitations are
    // retained with an explicit status, so they cannot be mistaken for active.
    relevant = relevant.filter(a => Number(a?.statusId) !== 10 &&
      !/cancelled|canceled/i.test(String(a?.statusLabel || '')));
    const names = relevant.map(a => {
      const name = compactPersonName(a) || plainText(safeText(a?.reviewerFullName) || safeText(a?.reviewerName)) || 'Reviewer name unavailable';
      const declined = Number(a?.statusId) === 1 || /declined/i.test(String(a?.statusLabel || ''));
      return { name, note:declined ? 'Declined' : '' };
    });
    return { names, unavailable:false, round:round?.round || null };
  }
  async function fetchStageDetails(id, stageLabel) {
    const base = apiBase();
    if (!base) return { isReview:/review/i.test(stageLabel), participants:null,
      reviewerData:{names:[],unavailable:true}, error:'OJS API unavailable' };
    let payload=null;
    let submissionError=false;
    try { payload = await readJSON(`${base}submissions/${encodeURIComponent(id)}`); }
    catch { submissionError=true; }
    const stageId = Number(payload?.stageId) || stageNumber(stageLabel);
    const isReview = stageId ? stageId === 3 : /review/i.test(stageLabel);
    let participants=null;
    if (stageId && [1,3,4,5].includes(stageId)) {
      try {
        const returned = await readJSON(`${base}submissions/${encodeURIComponent(id)}/participants/${stageId}`);
        const list = asList(returned);
        if (list) {
          const seen = new Set();
          participants = list.map(compactPersonName).filter(name => {
            if (!name || seen.has(name)) return false;
            seen.add(name);return true;
          });
        }
      } catch { /* Access is restricted or endpoint unavailable. */ }
    }
    const reviewerData = isReview ? assignedReviewers(payload) : null;
    return { isReview, participants, reviewerData,
      error:submissionError ? 'Submission details unavailable to this account' : '' };
  }
  function getStageDetails(id,stageLabel) {
    const key = `${id}:${stageLabel}`;
    const old = stageCache.get(key);
    if (old && Date.now()-old.time < STAGE_CACHE_MS) return old.promise;
    const promise = fetchStageDetails(id,stageLabel);
    stageCache.set(key,{ time:Date.now(),promise });
    return promise;
  }
  function stageSection(container, heading, initialText) {
    const section=document.createElement('section');
    section.className='ore043-stage-section';
    const label=document.createElement('div');
    label.dataset.oreTipHeading='';
    label.textContent=heading;
    const list=document.createElement('div');
    list.className='ore043-stage-list';
    const message=document.createElement('div');
    message.className='ore043-stage-person ore043-stage-person--muted';
    message.textContent=initialText;
    list.appendChild(message);
    section.append(label,list);
    container.appendChild(section);
    return {section,label,list};
  }
  function setStageList(part, people, emptyText) {
    part.list.replaceChildren();
    if (people === null) {
      const msg=document.createElement('div');
      msg.className='ore043-stage-person ore043-stage-person--muted';
      msg.textContent='Details unavailable';
      part.list.appendChild(msg);
      return;
    }
    if (!people.length) {
      const msg=document.createElement('div');
      msg.className='ore043-stage-person ore043-stage-person--muted';
      msg.textContent=emptyText;
      part.list.appendChild(msg);
      return;
    }
    for(const person of people.slice(0,25)) {
      const item=document.createElement('div');
      item.className='ore043-stage-person';
      const name=document.createElement('span');
      name.textContent=typeof person==='string' ? person : person.name;
      item.appendChild(name);
      if (person.note) {
        const badge=document.createElement('span');
        badge.className='ore043-stage-badge';
        badge.textContent=` (${person.note})`;
        item.appendChild(badge);
      }
      part.list.appendChild(item);
    }
    if (people.length>25) {
      const extra=document.createElement('div');
      extra.className='ore043-stage-person ore043-stage-person--muted';
      extra.textContent=`+${people.length-25} more`;
      part.list.appendChild(extra);
    }
  }
  function addStageHoverDetails(tip,target,stageLabel) {
    const row=target.closest('tr');
    const titleCell=row?.querySelector('th.ore041-col-submissions, td.ore041-col-submissions');
    const id=titleCell ? submissionIdOf(titleCell) : '';
    const container=document.createElement('div');
    container.dataset.oreStageDetails='';
    const participants=stageSection(container,'Participants',id ? 'Loading…' : 'Submission ID unavailable');
    const isReviewByLabel=/review/i.test(stageLabel);
    const reviewers=stageSection(container,'Reviewers',id ? 'Loading…' : 'Submission ID unavailable');
    reviewers.section.hidden=!isReviewByLabel;
    tip.appendChild(container);
    if (!id) return;
    getStageDetails(id,stageLabel).then(data => {
      if (titleTip!==tip || titleTipCell!==target || !target.isConnected) return;
      setStageList(participants,data.participants,'No participants assigned');
      reviewers.section.hidden=!data.isReview;
      if(data.isReview) {
        reviewers.label.textContent=data.reviewerData?.round ?
          `Reviewers (round ${data.reviewerData.round})` : 'Reviewers';
        setStageList(reviewers,data.reviewerData?.unavailable ? null : data.reviewerData?.names || [],
          'No reviewers assigned');
      }
      positionTip();
    }).catch(() => {
      if (titleTip!==tip || titleTipCell!==target) return;
      setStageList(participants,null,'');
      if (isReviewByLabel) setStageList(reviewers,null,'');
      positionTip();
    });
  }

  function targetInfo(target) {
    const kind = target.dataset.ore041Kind || 'title';
    const cell = target.closest('td,th');
    const row = cell?.closest('tr');
    const table = target.closest('table');
    const map = table ? byHeading(cells(table.tHead?.rows?.[0] || document.createElement('tr'))) : {};
    const cols = row ? cells(row) : [];
    const text = key => cols[map[key]] ? clean(cols[map[key]].textContent) : '';
    const titleCell = cols[map.submissions];
    const id = titleCell ? submissionIdOf(titleCell) : '';
    if (kind === 'flag') {
      const flag = flagInfo(cell);
      return { heading:'Selected flag', rows:[['Flag',flag.name],
        ...(flag.short && flag.short !== flag.name ? [['Short label',flag.short]] : []),
        ...(flag.color ? [['Colour',flag.color]] : []),
        ['Submission',id ? `#${id}` : '']], hint:'Use the selector to change this flag.'};
    }
    if (kind === 'updated' || kind === 'submitted') return {
      heading:'Submission dates', rows:[
        ['Last updated',text('updated') || 'Not available'],
        ['Submitted',text('submitted') || titleCell?.dataset?.ore041Submitted || 'Not available']
      ]};
    if (kind === 'stage') return { heading:'Workflow stage', rows:[
      ['Stage',text('stage')],['Publishing stage',text('publishing') || 'Unassigned']]};
    if (kind === 'publishing') return { heading:'Publishing stage', rows:[
      ['Status',text('publishing') || 'Unassigned'], ['Workflow stage',text('stage')] ]};
    if (kind === 'days') return { heading:'Editorial activity', rows:[
      ['Days since last activity',text('days') || 'Not available']]};
    if (kind === 'id') return { heading:'Submission', rows:[
      ['Submission ID',text('id')], ['Article',titleCell?.dataset?.ore041FullTitle || (titleCell ? extractTitle(titleCell) : '')]]};
    if (kind === 'activity') return { heading:'Editorial activity', rows:[
      ['Review information','Select an activity indicator to see the original OJS reviewer details'] ]};
    return null;
  }
  function showTip(target) {
    if (!target?.isConnected) return;
    if (flagMenu && target.closest('.ore041-col-flag')) return;
    clearTimeout(tipHideTimer);
    if (titleTip && titleTipCell === target) return;
    hideTip();
    titleTipCell = target;
    const kind = target.dataset.ore041Kind || 'title';
    const tip = document.createElement('div');
    tip.className = 'ore041-title-tip';
    tip.setAttribute('role','tooltip');
    tip.id = 'ore041-submission-tooltip';
    tip.addEventListener('mouseenter', () => {clearTimeout(tipHideTimer);tipHideTimer=null;});
    tip.addEventListener('mouseleave',deferHideTip);
    if (kind !== 'title') {
      tip.classList.add('ore041-info-tip');
      const data = targetInfo(target);
      if (!data) { hideTip(); return; }
      const heading=document.createElement('div');
      heading.dataset.oreTipHeading='';
      heading.textContent=data.heading;
      tip.appendChild(heading);
      if (kind === 'flag') {
        const flag = flagInfo(target.closest('td,th'));
        const color = flagColour(flag,target.closest('td,th'));
        tip.classList.add('ore042-flag-tip');
        if (color) tip.style.setProperty('--ore042-flag-colour',color);
        const chip = document.createElement('div');chip.className='ore042-flag-chip';
        const dot = document.createElement('span');dot.className='ore042-flag-dot';
        if (color) dot.style.setProperty('--ore042-flag-colour',color);
        const name = document.createElement('span');name.textContent=flag.name || 'No flag selected';
        chip.append(dot,name);tip.appendChild(chip);
        data.rows.filter(([key]) => key !== 'Flag' && key !== 'Colour').forEach(([key,value]) => tipRow(tip,key,value));
      } else {
        data.rows.forEach(([key,value]) => tipRow(tip,key,value));
      }
      if (data.hint) {
        const hint=document.createElement('div');
        hint.dataset.oreTipStatus='';
        hint.textContent=data.hint;
        hint.style.marginTop='9px';
        tip.appendChild(hint);
      }
      document.body.appendChild(tip);
      titleTip=tip;
      target.setAttribute('aria-describedby',tip.id);
      if (kind === 'stage') addStageHoverDetails(tip,target,data.rows?.[0]?.[1] || '');
      positionTip();
      return;
    }
    const id = submissionIdOf(target);
    const title = target.dataset.ore041FullTitle || extractTitle(target);
    const h1=document.createElement('div'); h1.dataset.oreTipHeading='';h1.textContent='Full article title';
    const t1=document.createElement('div'); t1.dataset.oreTipTitle='';t1.textContent=title || 'Title not available';
    const h2=document.createElement('div'); h2.dataset.oreTipHeading='';h2.textContent='Corresponding author(s)';
    const info=document.createElement('div');info.dataset.oreTipDetails='';
    const loading=document.createElement('div');loading.dataset.oreTipStatus='';
    loading.textContent=id?'Loading from OJS…':'Submission ID not available';
    info.appendChild(loading);
    tip.append(h1,t1,h2,info);
    document.body.appendChild(tip);
    titleTip=tip;
    target.setAttribute('aria-describedby',tip.id);
    positionTip();
    if (!id) return;
    const key=id;
    activeTitleKey=key;
    if (!authorCache.has(key)) authorCache.set(key,fetchAuthorDetails(id));
    authorCache.get(key).then(result => {
      if (titleTip !== tip || activeTitleKey !== key) return;
      tipDetails(tip,result);
      positionTip();
    });
  }
  function applyTitle(cell) {
    if (!cell) return;
    if (!cell.dataset.ore041FullTitle) cell.dataset.ore041FullTitle = extractTitle(cell);
    cell.classList.add('ore041-title-target');
    if (!cell.hasAttribute('tabindex')) cell.tabIndex = 0;
    // Restore the title from the visible row if the Vue component replaces it.
    if (cell.dataset.ore041FullTitle && cell.title) cell.removeAttribute('title');
  }
  function onHoverTitle(event) {
    const cell = event.target?.closest?.('.ore041-title-target, .ore041-help-target');
    if (!cell) return;
    if (event.relatedTarget && cell.contains(event.relatedTarget)) return;
    clearTimeout(tipHideTimer);tipHideTimer=null;
    clearTimeout(titleTipTimer);
    titleTipTimer = setTimeout(() => showTip(cell), 100);
  }
  function onLeaveTitle(event) {
    const cell = event.target?.closest?.('.ore041-title-target, .ore041-help-target');
    if (!cell) return;
    if (event.relatedTarget && cell.contains(event.relatedTarget)) return;
    deferHideTip();
  }
  function sizesForWidth(width) {
    // Reserve practical widths for controls and reviewer activity; give the
    // submission title ALL remaining space. Never cap it at 440/600 pixels.
    // This prevents the enormous empty Editorial Activity column on QA's
    // wide monitors while preserving compact behaviour on narrow screens.
    const narrow = width < 900;
    const veryNarrow = width < 620;
    const tiny = width < 520;
    const id = tiny ? 0 : 52;
    const updated = narrow ? 0 : 126;
    const days = veryNarrow ? 0 : 58;
    const mode = String(window.oreDashboardFiltersV3Config?.appearance?.flagDisplay || '').toLowerCase();
    const iconOnly = ['icon', 'icons', 'icon-only', 'icon_only'].includes(mode);
    const flag = iconOnly ? 56 : tiny ? 72 : width >= 1200 ? 165 : width >= 900 ? 148 : width >= 660 ? 133 : 115;
    const actions = tiny ? 52 : width < 700 ? 64 : 78;
    let activity = width >= 1700 ? 420 : width >= 1300 ? 340 :
      width >= 1100 ? 290 : width >= 900 ? 232 :
      width >= 660 ? 190 : width >= 520 ? 150 : 82;
    const minTitle = tiny ? 130 : 145;
    let submissions = width - id - updated - days - flag - actions - activity;
    if (submissions < minTitle) {
      activity = Math.max(tiny ? 70 : 100, activity - (minTitle - submissions));
      submissions = Math.max(0, width - id - updated - days - flag - actions - activity);
    }
    return { narrow, veryNarrow, tiny, iconOnly, id, updated, days, flag, actions, activity, submissions };
  }

  function reserveColumns(table, width) {
    const values = sizesForWidth(width);
    table.classList.toggle('ore041-narrow', values.narrow);
    table.classList.toggle('ore041-very-narrow', values.veryNarrow);
    table.classList.toggle('ore041-tiny', values.tiny);
    table.classList.toggle('ore041-icon-only', values.iconOnly);
    for (const name of ['id','submissions','updated','days','activity','flag','actions']) {
      const next = `${Math.max(0, values[name])}px`;
      const prop = `--ore041-w-${name}`;
      if (table.style.getPropertyValue(prop) !== next) table.style.setProperty(prop, next);
    }
    return width < 620 ? 2 : width < 900 ? 3 : 4;
  }

  function permitPopovers(table) {
    // Overflow-x:auto is also an overflow-y clipping boundary. Giving only
    // the popover a high z-index does not escape it. Remove clipping from the
    // table's layout ancestors, but keep the table itself fixed to 100%.
    let parent = table.parentElement;
    while (parent && parent !== document.body) {
      parent.classList.add('ore041-escape');
      // Existing v0.3.7 CSS may contain more-specific !important rules.
      // Inline !important wins without changing any stylesheet or OJS core.
      for (const property of ['overflow', 'overflow-x', 'overflow-y']) {
        if (parent.style.getPropertyValue(property) !== 'visible' ||
            parent.style.getPropertyPriority(property) !== 'important') {
          parent.style.setProperty(property, 'visible', 'important');
        }
      }
      if (parent.matches('main.app__main')) break;
      parent = parent.parentElement;
    }
  }

  function applyHelp(cols,map) {
    for (const key of ['id','updated','days']) {
      if (map[key] === undefined || !cols[map[key]]) continue;
      const cell = cols[map[key]];
      if (cell.closest('thead')) continue;
      cell.classList.add('ore041-help-target');
      cell.dataset.ore041Kind = key;
      if (!cell.hasAttribute('tabindex')) cell.tabIndex=0;
      if (cell.hasAttribute('title')) cell.removeAttribute('title');
    }
  }

  function applyActivity(cell, visibleLimit) {
    if (!cell) return;
    const strip = cell.querySelector('span.flex.gap-x-1');
    if (!strip) return;
    strip.classList.add('ore041-activity-strip');
    const indicators = Array.from(strip.children).filter(item => item.matches('div') &&
      item.querySelector('button[id^="headlessui-popover-button-"]'));
    indicators.forEach((node, index) => node.classList.toggle('ore041-extra', index >= visibleLimit));
    const extra = Math.max(0, indicators.length - visibleLimit);
    let more = strip.querySelector(':scope > button.ore041-more');
    if (!extra) {
      if (more) more.remove();
      cell.classList.remove('ore041-open');
    } else {
      if (!more) {
        more = document.createElement('button');
        more.type = 'button';
        more.className = 'ore041-more';
        strip.appendChild(more);
      }
      const expanded = cell.classList.contains('ore041-open');
      more.textContent = expanded ? '×' : `+${extra}`;
      more.title = expanded ? 'Collapse reviewer indicators' : `Show ${extra} more reviewer indicators`;
      more.setAttribute('aria-expanded', String(expanded));
      more.setAttribute('aria-label', more.title);
    }
  }

  function apply() {
    if (titleTip && (!titleTipCell?.isConnected || !titleTipCell.closest('table.ore041-table'))) hideTip();
    if (flagMenu && (!flagMenuTrigger?.isConnected || !flagMenuSelect?.isConnected)) closeFlagMenu();
    if (!installed || !document.body?.classList.contains('pkp_page_dashboard')) {
      hideTip(); closeFlagMenu(); return 0;
    }
    let found = 0;
    for (const table of document.querySelectorAll('main.app__main table')) {
      const foundColumns = compatibleTable(table);
      if (!foundColumns) continue;
      const { heads, map } = foundColumns;
      found++;
      table.classList.add('ore041-table');
      const host = table.parentElement;
      if (host) host.classList.add('ore041-host');
      for (const [element, attrs] of [[table, { width:'100%', minWidth:'0', maxWidth:'100%', tableLayout:'fixed' }],
        [host, { width:'100%', minWidth:'0', maxWidth:'100%' }]]) {
        if (!element) continue;
        for (const [key, val] of Object.entries(attrs)) {
          if (element.style.getPropertyValue(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())) !== val ||
              element.style.getPropertyPriority(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())) !== 'important') {
            element.style.setProperty(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), val, 'important');
          }
        }
      }
      const maxAvailable = Math.min(host?.clientWidth || 2000,
        document.documentElement.clientWidth - Math.max(0, table.getBoundingClientRect().left) - 8);
      const width = Math.max(200, maxAvailable);
      const visibleLimit = reserveColumns(table, width);
      permitPopovers(table);
      const hiddenKeys = new Set(['submitted', 'stage', 'publishing']);
      const classFor = Object.fromEntries(Object.entries(map).map(([name, i]) => [i,
        name === 'submissions' ? 'ore041-col-submissions' :
        name === 'updated' ? 'ore041-col-updated' :
        name === 'activity' ? 'ore041-col-activity' :
        name === 'publishing' ? 'ore041-col-publishing' :
        `ore041-col-${name}`]));
      function tagColumns(columns) {
        columns.forEach((c, index) => {
          if (!classFor[index]) return;
          c.classList.add(classFor[index]);
          const key = Object.keys(map).find(k => map[k] === index);
          if (hiddenKeys.has(key)) c.classList.add('ore041-hidden');
        });
      }
      tagColumns(heads);
      for (const row of Array.from(table.tBodies).flatMap(tbody => Array.from(tbody.rows))) {
        const cols = cells(row);
        if (cols.length !== heads.length) continue;
        tagColumns(cols);
        applyTitle(cols[map.submissions]);
        applyMeta(cols, map);
        applyFlag(cols[map.flag]);
        applyHelp(cols,map);
        applyActivity(cols[map.activity], visibleLimit);
      }
      if (typeof ResizeObserver === 'function' && !resizeObserver && host) {
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(host);
      }
    }
    return found;
  }
  function schedule() {
    if (titleTip && (!titleTipCell?.isConnected || !titleTipCell.closest('table.ore041-table'))) hideTip();
    if (flagMenu && (!flagMenuTrigger?.isConnected || !flagMenuSelect?.isConnected)) closeFlagMenu();
    if (!installed || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (installed) apply();
    });
  }
  function onFocusTitle(event) {
    const cell = event.target?.closest?.('.ore041-title-target, .ore041-help-target');
    if (cell) showTip(cell);
    else if (titleTip && !titleTip.contains(event.target)) hideTip();
  }
  function onBlurTitle(event) {
    if (event.target?.closest?.('.ore041-title-target, .ore041-help-target')) deferHideTip();
  }
  function onViewportShift(event) {
    if (event.type === 'resize' || event.target !== titleTip) hideTip();
    closeFlagMenu();
  }
  function onClick(event) {
    if (!event.target?.closest?.('.ore041-title-tip')) hideTip();
    if (flagMenu && !event.target?.closest?.('.ore042-flag-menu,.ore042-flag-trigger')) closeFlagMenu();
    const more = event.target?.closest?.('button.ore041-more');
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      const cell = more.closest('td,th');
      const open = !cell.classList.contains('ore041-open');
      for (const prev of document.querySelectorAll('.ore041-open')) prev.classList.remove('ore041-open');
      if (open) cell.classList.add('ore041-open');
      schedule();
      return;
    }
    if (!event.target?.closest?.('.ore041-col-activity')) {
      for (const prev of document.querySelectorAll('.ore041-open')) prev.classList.remove('ore041-open');
      schedule();
    }
  }
  function onChange(event) {
    if (!event.target?.closest?.('.ore041-col-flag')) return;
    hideTip();closeFlagMenu();
    schedule();
  }
  function onKeydown(event) {
    if (flagMenu) {
      const options = Array.from(flagMenu.querySelectorAll('button[role="option"]:not(:disabled)'));
      const index=options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();event.stopPropagation();
        options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();(event.key === 'Home'?options[0]:options.at(-1))?.focus();return;
      }
      if (event.key === 'Escape') {event.preventDefault();closeFlagMenu(true);hideTip();return;}
      if (event.key === 'Tab') closeFlagMenu();
    }
    if (event.key === 'Escape') {
      hideTip();
      for (const prev of document.querySelectorAll('.ore041-open')) prev.classList.remove('ore041-open');
      schedule();
    }
  }
  function report() {
    const t = Array.from(document.querySelectorAll('table.ore041-table'));
    return t.map(table => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      tableWidth: Math.round(table.getBoundingClientRect().width),
      available: Math.round(table.parentElement.getBoundingClientRect().width),
      rows: table.tBodies[0]?.rows.length || 0,
      reviewerButtons: table.querySelectorAll('button[id^="headlessui-popover-button-"]').length,
      flags: table.querySelectorAll('.ore041-flag-control').length,
      flagWidth: table.style.getPropertyValue('--ore041-w-flag'),
      flagMenuOpen: !!flagMenu,
      rememberedFlagNames: flagOptionNames.size,
      activeHover: titleTipCell?.dataset?.ore041Kind || (titleTip ? 'title' : null),
      submissionWidth: table.style.getPropertyValue('--ore041-w-submissions'),
      activityWidth: table.style.getPropertyValue('--ore041-w-activity'),
      flagLabelsVisible: Array.from(table.querySelectorAll('.ore041-flag-control')).filter(button =>
        Array.from(button.querySelectorAll('span,strong')).some(node => {
          const style = getComputedStyle(node);
          return !!node.textContent.trim() && style.display !== 'none' && Number.parseFloat(style.fontSize) > 0;
        })).length,
      missingSubmissionColumn: !table.querySelector('thead .ore041-col-submissions'),
      titleHoverTargets: table.querySelectorAll('.ore041-title-target, .ore041-help-target').length,
    }));
  }
  function restoreForBrowser() {
    // Safest rollback for a production Vue-rendered DOM is a page reload.
    // The source-side installer supports restoring the previous JavaScript.
    installed = false;
    observer?.disconnect();
    resizeObserver?.disconnect();
    hideTip();closeFlagMenu();
    document.removeEventListener('mouseover', onHoverTitle, true);
    document.removeEventListener('mouseout', onLeaveTitle, true);
    document.removeEventListener('pointermove', onGlobalPointerMove, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('mouseleave', onWindowMouseLeave, true);
    document.removeEventListener('visibilitychange', onVisibilityChange, true);
    window.removeEventListener('blur', onWindowBlur, true);
    window.removeEventListener('pagehide', onPageExit, true);
    window.removeEventListener('popstate', onPageExit, true);
    document.removeEventListener('focusin', onFocusTitle, true);
    document.removeEventListener('focusout', onBlurTitle, true);
    window.removeEventListener('scroll', onViewportShift, true);
    window.removeEventListener('resize', onViewportShift, true);
    window.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
    window.removeEventListener('keydown', onKeydown, true);
    document.getElementById(STYLE_ID)?.remove();
    window.location.reload();
  }
  function start() {
    if (!document.body.classList.contains('pkp_page_dashboard')) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
    document.addEventListener('mouseover', onHoverTitle, true);
    document.addEventListener('mouseout', onLeaveTitle, true);
    document.addEventListener('pointermove', onGlobalPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mouseleave', onWindowMouseLeave, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);
    window.addEventListener('blur', onWindowBlur, true);
    window.addEventListener('pagehide', onPageExit, true);
    window.addEventListener('popstate', onPageExit, true);
    document.addEventListener('focusin', onFocusTitle, true);
    document.addEventListener('focusout', onBlurTitle, true);
    window.addEventListener('scroll', onViewportShift, true);
    window.addEventListener('resize', onViewportShift, true);
    window.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    window.addEventListener('keydown', onKeydown, true);
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
    apply();
    requestAnimationFrame(() => {
      if (window.scrollX > 0 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2) {
        window.scrollTo(0, window.scrollY);
      }
    });
    window[KEY] = { installed:true, apply, report, restoreForBrowser };
    console.info('[ORE Dashboard Filters] OJS 3.6 v7 stage participants and reviewers hover loaded. Diagnostic: OREDashboardWidthFix043.report()');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

/* ORE dashboard enhancement: end */
