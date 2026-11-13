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
