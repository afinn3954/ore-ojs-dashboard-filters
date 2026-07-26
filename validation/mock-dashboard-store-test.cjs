const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const watchers = [];

function snapshot(value) {
    return JSON.stringify(value);
}

function watch(getter, callback, options = {}) {
    const watcher = {
        getter,
        callback,
        deep: Boolean(options.deep),
        last: snapshot(getter()),
    };
    watchers.push(watcher);

    if (options.immediate) {
        callback(getter());
        watcher.last = snapshot(getter());
    }
}

function flushWatchers() {
    for (let pass = 0; pass < 20; pass += 1) {
        let changed = false;

        watchers.forEach((watcher) => {
            const value = watcher.getter();
            const next = snapshot(value);
            if (next === watcher.last) {
                return;
            }

            const previous = watcher.last;
            watcher.last = next;
            watcher.callback(value, previous);
            watcher.last = snapshot(watcher.getter());
            changed = true;
        });

        if (!changed) {
            return;
        }
    }

    throw new Error('Mock watchers did not stabilise');
}

let extension;
const configuredNativeFields = [
    {
        name: 'sectionIds',
        component: 'field-options',
        label: 'Section',
        groupId: 'default',
        isRequired: false,
        isMultilingual: false,
        isInert: false,
        value: [],
        type: 'checkbox',
        isOrderable: false,
        allowOnlySorting: false,
        options: [
            {value: 11, label: 'Research Articles'},
            {value: 12, label: 'Data Notes'},
        ],
    },
    {
        name: 'categoryIds',
        component: 'field-autosuggest-preset',
        label: 'Categories',
        groupId: 'default',
        isRequired: false,
        isMultilingual: false,
        isInert: false,
        value: [],
        options: [
            {value: 21, label: 'Natural Sciences'},
            {value: 22, label: 'Social Sciences'},
        ],
        selected: [],
        vocabularies: [],
    },
];
global.window = {
    URLSearchParams,
    location: {
        search:
            '?sectionIds=11&sectionIds=12&sectionIds=999' +
            '&categoryIds=21&categoryIds%5B%5D=22&categoryIds=999' +
            '&oreVersionStage=PMUR&stageIds=3&oreSubmissionDate=custom' +
            '&oreDateFrom=2026-07-01&oreDateTo=2026-07-25',
    },
    oreDashboardFiltersConfig: {
        nativeFilterFields: configuredNativeFields,
    },
};
global.pkp = {
    const: {
        WORKFLOW_STAGE_ID_SUBMISSION: 1,
        WORKFLOW_STAGE_ID_EXTERNAL_REVIEW: 3,
        WORKFLOW_STAGE_ID_EDITING: 4,
        WORKFLOW_STAGE_ID_PRODUCTION: 5,
    },
    modules: {vue: {watch}},
    registry: {
        storeExtend: (id, callback) => {
            assert.strictEqual(id, 'dashboard');
            extension = callback;
        },
    },
};

vm.runInThisContext(fs.readFileSync(process.argv[2], 'utf8'));
assert.ok(extension, 'Dashboard extension was not registered');

function makeStore(dashboardPage = 'editorialDashboard') {
    return {
        dashboardPage,
        filtersForm: {
            fields: [
                {
                    name: 'assignedTo',
                    component: 'field-select-users',
                    label: 'Assigned To Editor',
                    value: [],
                    selected: [],
                },
                {
                    name: 'daysInactive',
                    component: 'field-slider',
                    label: 'Days since last activity',
                    value: 0,
                    min: 0,
                },
            ],
            groups: [{id: 'default'}],
        },
        updateFiltersForm(update) {
            this.filtersForm = update;
        },
    };
}

function getField(store, name) {
    return store.filtersForm.fields.find((field) => field.name === name);
}

// This intentionally mirrors OJS 3.6 useFiltersForm.js, including its direct
// option/selected dereference. The plugin state must make every call safe.
function buildActiveFilterList(store) {
    const list = [];

    store.filtersForm.fields.forEach((field) => {
        const values = Array.isArray(field.value)
            ? field.value
            : [field.value];

        values.forEach((value) => {
            if (field.selected) {
                const selected = field.selected.find(
                    (candidate) => candidate.value === value,
                );
                list.push({
                    name: field.name,
                    label: selected.label,
                    value: selected.value,
                });
            } else if (field.options) {
                const option = field.options.find(
                    (candidate) => candidate.value === value,
                );
                list.push({
                    name: field.name,
                    label: option.label,
                    value: option.value,
                });
            } else if (field.component === 'field-slider') {
                if (value !== field.min) {
                    list.push({
                        name: field.name,
                        label: value,
                        value,
                    });
                }
            } else {
                list.push({name: field.name, label: 'TODO', value});
            }
        });
    });

    return list;
}

function clearFieldLikeOjs(field) {
    const clearValue =
        Array.isArray(field.value) || field.selected ? [] : '';

    if (field.selected) {
        field.value = clearValue.map((item) => item.value);
        field.selected = clearValue;
    } else {
        field.value = clearValue;
    }
}

const store = makeStore();
extension({store});

const expectedNames = [
    'oreVersionStage',
    'stageIds',
    'oreSubmissionDate',
    'oreDateFrom',
    'oreDateTo',
];
const expectedNativeNames = ['sectionIds', 'categoryIds'];
const expectedAddedNames = [...expectedNativeNames, ...expectedNames];
expectedAddedNames.forEach((name) => {
    assert.ok(getField(store, name), `Missing ${name}`);
});

assert.deepStrictEqual(
    store.filtersForm.fields.map((field) => field.name),
    [
        'sectionIds',
        'assignedTo',
        'categoryIds',
        'daysInactive',
        ...expectedNames,
    ],
    'Missing native filters were not restored in core OJS order',
);
assert.deepStrictEqual(getField(store, 'sectionIds').value, [11, 12]);
assert.deepStrictEqual(getField(store, 'categoryIds').value, [21, 22]);
assert.deepStrictEqual(getField(store, 'categoryIds').selected, [
    {value: 21, label: 'Natural Sciences'},
    {value: 22, label: 'Social Sciences'},
]);
assert.strictEqual(getField(store, 'oreVersionStage').value, 'PMUR');
assert.strictEqual(getField(store, 'stageIds').value, 3);
assert.strictEqual(getField(store, 'oreSubmissionDate').value, 'custom');
assert.strictEqual(getField(store, 'oreDateFrom').value, '2026-07-01');
assert.strictEqual(getField(store, 'oreDateTo').value, '2026-07-25');
assert.deepStrictEqual(
    getField(store, 'oreDateFrom').showWhen,
    ['oreSubmissionDate', 'custom'],
);
assert.ok(
    !Object.prototype.hasOwnProperty.call(
        getField(store, 'oreDateFrom'),
        'options',
    ),
    'Date fields must not expose an empty options array',
);

let chips = buildActiveFilterList(store);
assert.deepStrictEqual(
    chips.map((chip) => chip.name),
    [
        'sectionIds',
        'sectionIds',
        'categoryIds',
        'categoryIds',
        ...expectedNames,
    ],
    'URL-restored filters did not produce the expected chips',
);

// The modal replaces the complete form object. Stale hidden dates must be
// cleared, and selected labels must follow the replacement fields.
const modalForm = JSON.parse(JSON.stringify(store.filtersForm));
modalForm.fields.find((field) => field.name === 'oreVersionStage').value = 'VoR';
modalForm.fields.find((field) => field.name === 'oreSubmissionDate').value =
    'today';
store.updateFiltersForm(modalForm);
flushWatchers();

assert.strictEqual(getField(store, 'oreVersionStage').value, 'VoR');
assert.deepStrictEqual(getField(store, 'oreVersionStage').selected, [
    {value: 'VoR', label: 'Version of Record (VoR)'},
]);
assert.deepStrictEqual(getField(store, 'oreDateFrom').value, []);
assert.deepStrictEqual(getField(store, 'oreDateTo').value, []);
chips = buildActiveFilterList(store);
assert.ok(!chips.some((chip) => chip.name === 'oreDateFrom'));
assert.ok(!chips.some((chip) => chip.name === 'oreDateTo'));

// Removing a scalar chip must return the field to the empty-array state used
// by the visible All option.
clearFieldLikeOjs(getField(store, 'oreVersionStage'));
flushWatchers();
assert.deepStrictEqual(getField(store, 'oreVersionStage').value, []);
assert.deepStrictEqual(getField(store, 'oreVersionStage').selected, []);
assert.deepStrictEqual(
    getField(store, 'oreVersionStage').options[0].value,
    [],
);
assert.ok(
    !buildActiveFilterList(store).some(
        (chip) => chip.name === 'oreVersionStage',
    ),
);

// Clear Filters must leave all restored and plugin fields inactive and
// chip-safe.
expectedAddedNames.forEach((name) =>
    clearFieldLikeOjs(getField(store, name)),
);
flushWatchers();
assert.deepStrictEqual(buildActiveFilterList(store), []);

// Re-running the extender must not register duplicate fields.
extension({store});
expectedAddedNames.forEach((name) => {
    assert.strictEqual(
        store.filtersForm.fields.filter((field) => field.name === name).length,
        1,
        `Duplicate ${name} field`,
    );
});

// The plugin is intentionally restricted to the editorial dashboard.
const reviewStore = makeStore('myReviewAssignments');
extension({store: reviewStore});
expectedAddedNames.forEach((name) => {
    assert.ok(!getField(reviewStore, name), `${name} leaked to another dashboard`);
});

// With no URL filters, every All option must be selected without producing a
// chip or query value.
window.location.search = '';
const emptyStore = makeStore();
extension({store: emptyStore});
expectedAddedNames.forEach((name) => {
    assert.deepStrictEqual(getField(emptyStore, name).value, []);
});
assert.deepStrictEqual(buildActiveFilterList(emptyStore), []);

// Core-provided Section and Categories configurations must be preserved and
// must never be duplicated.
const nativeStore = makeStore();
const existingSection = JSON.parse(JSON.stringify(configuredNativeFields[0]));
const existingCategory = JSON.parse(JSON.stringify(configuredNativeFields[1]));
nativeStore.filtersForm.fields = [
    existingSection,
    nativeStore.filtersForm.fields[0],
    existingCategory,
    nativeStore.filtersForm.fields[1],
];
extension({store: nativeStore});
assert.strictEqual(getField(nativeStore, 'sectionIds'), existingSection);
assert.strictEqual(getField(nativeStore, 'categoryIds'), existingCategory);
expectedNativeNames.forEach((name) => {
    assert.strictEqual(
        nativeStore.filtersForm.fields.filter((field) => field.name === name)
            .length,
        1,
        `Core-provided ${name} was duplicated`,
    );
});

// An unconfigured journal still receives an explicit disabled Categories
// field, with no query value or active chip.
window.oreDashboardFiltersConfig = {
    nativeFilterFields: [
        configuredNativeFields[0],
        {
            ...configuredNativeFields[1],
            component: 'field-options',
            options: [
                {
                    value: '__ore_no_categories__',
                    label: 'No categories are configured for this journal.',
                    disabled: true,
                },
            ],
            selected: undefined,
        },
    ],
};
const noCategoryStore = makeStore();
extension({store: noCategoryStore});
assert.deepStrictEqual(getField(noCategoryStore, 'categoryIds').value, []);
assert.strictEqual(
    getField(noCategoryStore, 'categoryIds').options[0].disabled,
    true,
);
assert.ok(
    !buildActiveFilterList(noCategoryStore).some(
        (chip) => chip.name === 'categoryIds',
    ),
);
window.oreDashboardFiltersConfig = {
    nativeFilterFields: configuredNativeFields,
};

// Calendar-invalid dates must not survive URL restoration even when they match
// the YYYY-MM-DD shape.
window.location.search =
    '?oreSubmissionDate=custom&oreDateFrom=2026-02-31&oreDateTo=2026-02-28';
const invalidDateStore = makeStore();
extension({store: invalidDateStore});
assert.deepStrictEqual(getField(invalidDateStore, 'oreDateFrom').value, []);
assert.strictEqual(
    getField(invalidDateStore, 'oreDateTo').value,
    '2026-02-28',
);

console.log(
    JSON.stringify(
        {
            registered: true,
            fields: expectedAddedNames,
            nativeFilterOrder: true,
            nativeUrlRestoration: true,
            nativeCorePreservation: true,
            disabledCategoryState: true,
            urlRestoration: true,
            modalReplacement: true,
            chipRemoval: true,
            clearFilters: true,
            emptyDefaults: true,
            invalidDateRejected: true,
        },
        null,
        2,
    ),
);
