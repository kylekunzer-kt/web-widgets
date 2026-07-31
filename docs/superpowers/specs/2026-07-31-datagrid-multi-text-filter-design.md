# Multi text filter widget — design

Date: 2026-07-31
Status: approved, ready for implementation planning

## Problem

`datagrid-text-filter-web` matches a single string. `StringInputFilterStore` holds exactly
two values (`arg1`, `arg2`) and one filter function, so there is no way to express "match any
of these N values". Users who need to look up a known set of records — paste a list of order
numbers and see those rows — cannot do it with the shipped filters.

## Scope

A new pluggable widget, `datagrid-multi-text-filter-web`, that accepts multiple search terms
and matches a row when **any** term matches. Terms are entered as removable chips; pasting a
comma-, newline-, or tab-separated list creates one chip per value.

Out of scope: AND semantics between terms, per-term operators, and "Auto" column-attribute
mode. See [Rejected alternatives](#rejected-alternatives).

## Decisions

| Decision            | Choice                                                          | Reason                                                                                                                                             |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Term combination    | OR (match any term)                                             | Driving use case is looking up a known set of values                                                                                               |
| Input model         | Chip/token input with comma-paste                               | Comma-only text is ambiguous when values contain commas, and gives no feedback on how the input parsed                                             |
| Packaging           | New standalone package                                          | Repo is a fork of `mendix/web-widgets`; modifying `datagrid-text-filter-web` or the shared filtering plugin makes every upstream rebase a conflict |
| Match mode          | Studio Pro property, one of `contains` / `equal` / `startsWith` | Covers exact ID lookup and fuzzy search without an end-user dropdown to build and test                                                             |
| Term limit          | `maxTerms` property, default 100, warn on overflow              | Bounds the generated `or()` tree; silent truncation would hand the user wrong results                                                              |
| Attribute selection | Always explicit (`linkedDs` + `attributes`)                     | Required to own our own store; also the right default, since multi-term search usually spans columns                                               |

## Architecture

New package: `packages/pluggableWidgets/datagrid-multi-text-filter-web`.
Studio Pro name: **Multi text filter**. Placeable in a Data grid 2 column header or in the
grid's header (filters placeholder), the same positions as the Text filter.

Source files use the `DatagridMultiTextFilter` prefix, matching the sibling filter packages —
the generated typings file name derives from it (`typings/DatagridMultiTextFilterProps.d.ts`).

### Composition

```
DatagridMultiTextFilter (default export)
  └ withPreloader          — waits for the defaultValue expression to resolve
    └ withAttributeGuard   — reused unchanged from @mendix/widget-plugin-filtering
      └ withFilterAPI      — reused unchanged; supplies FilterAPI from React context
        └ withMultiStringStore     — local HOC, mirrors withLinkedStringStore
          └ MultiTextFilterContainer — mobx observer component
```

`withMultiStringStore` calls
`useSetup(() => new MultiStringStoreProvider(filterAPI, { attributes, dataKey: props.name }))`.
`MultiStringStoreProvider` extends the shared `BaseStoreProvider`, which already performs
`filterObserver.observe(dataKey, store)` and returns the disposer. Its type constraint is
`S extends Filter`, which `MultiStringFilterStore` satisfies.

`filterAPI.filterObserver` is present in both the column-header context
(`ColumnFilterStore.createContext`) and the grid-header context (`useDatagridFilterAPI`), which
is why one widget works in both positions without touching the datagrid.

**No file in `packages/shared/` or `packages/pluggableWidgets/datagrid-web/` is modified.**

### Data flow

```
user types / pastes
      ↓
TermChipInput (controlled, no local state)
      ↓  onCommit / onRemove / onClear / onInputChange
MultiTextFilterController (mobx; debounces in-progress input text)
      ↓  store.setTerms([...])
MultiStringFilterStore.terms          (observable.struct, string[])
      ↓  computed
store.condition → flat or(...) over terms × attributes
      ↓  autorun registered by CustomFilterHost.observe()
datagrid CustomFilterHost._state
      ↓  reduceMap → and(...) across all filter widgets on the grid
ListValue.setFilter()
```

### In-progress input text is a live term

The condition is built from the committed chips **plus** the current uncommitted input text,
debounced by `delay` (default 500 ms). Typing a single term without pressing Enter therefore
behaves exactly like today's Text filter. Enter/comma only promotes the text into a chip and
clears the input.

This removes the need for provisional-chip UI and avoids the "I typed something and nothing
happened" failure mode.

## `src/stores/MultiStringFilterStore.ts`

Implements the shared `Filter` interface from
`@mendix/widget-plugin-filtering/typings/ObservableFilterHost` — `condition`, `toJSON`,
`fromJSON`, `fromViewState`, and optional `setup`. That is the entire contract
`filterObserver.observe()` requires.

It deliberately does **not** join the `FilterStore` union in `widget-plugin-filtering/context.ts`,
because it is never handed out through the `direct` provider. Staying out of that union is what
keeps the change confined to this package.

```ts
class MultiStringFilterStore implements Filter {
    terms: string[]; // observable.struct; paste order preserved
    liveTerm: string; // observable; debounced uncommitted input text
    droppedCount: number; // observable; terms rejected by the cap on the last set
    private _attributes: Array<AttributeMetaData<string>>;
    private _matchMode: "contains" | "equal" | "startsWith";
    private _maxTerms: number;
}
```

`droppedCount` is an observable field, not a computed one: truncation happens inside
`setTerms`, so the rejected count cannot be recovered from `terms` afterwards. It is reset to
`0` on any subsequent `setTerms`, `clear`, or `reset`, so the warning disappears once the user
edits the list.

### Condition building (computed)

"Terms" below means the committed chips plus `liveTerm` when it is non-empty.

| Terms | Attributes | Result                                     |
| ----- | ---------- | ------------------------------------------ |
| 0     | any        | `undefined` — filter inactive              |
| 1     | 1          | bare `contains(a, "x")`, no `or()` wrapper |
| n     | m          | one flat `or(...)` with n × m branches     |

Flat rather than nested, matching `EnumFilterStore.condition`. Attributes where
`filterable === false` are skipped, as `BaseInputFilterStore` does. `matchMode` maps onto the
`contains` / `equals` / `startsWith` builders from `mendix/filters/builders`.

### Term normalization

Applied on every commit and every paste, in order:

1. Split on `,`, newline, and tab. Semicolon is **not** a delimiter — it occurs in real data
   more often than it is used to separate values.
2. Trim each term; drop empty results.
3. Dedupe case-insensitively, keeping first-seen casing. Mendix string comparison for
   `contains`/`equals` is case-insensitive, so `ORD-1` and `ord-1` would generate identical
   branches; deduping avoids pointless query bloat.
4. Truncate to `maxTerms`. The dropped count lands in `droppedCount`, which the container
   renders as a warning `Alert`.

The debounced `liveTerm` counts toward `maxTerms`. When `terms.length` already equals
`maxTerms`, `liveTerm` is excluded from the condition and the warning is shown — so the cap is
a hard bound on the number of branches, never `maxTerms + 1`.

### Persistence

Three independent channels, all required for a filter widget to behave correctly:

| Channel                         | Methods               | Shape                 | Purpose                                                  |
| ------------------------------- | --------------------- | --------------------- | -------------------------------------------------------- |
| Grid settings (personalization) | `toJSON` / `fromJSON` | `string[]`            | Same shape as `BaseSelectStore.toJSON()`                 |
| Datasource view state           | `fromViewState(cond)` | parse the `or()` tree | Restores the filter after page navigation / back button  |
| Saved attribute                 | `valueAttribute`      | comma-joined string   | Optional Mendix attribute binding, as on the Text filter |

`fromJSON` ignores malformed input (non-array, or an array containing non-strings) rather than
throwing, matching `BaseSelectStore.fromJSON`.

### Local `termsFromCond` instead of `selectedFromCond`

`selectedFromCond` in `@mendix/filter-commons/condition-utils` only recognizes `=` and
`contains` branches. Given a `starts-with` tree it returns `[]` silently, which would drop the
user's filter on page navigation whenever `matchMode` is `startsWith`.

Rather than patch shared code, this package gets a small local `termsFromCond` that walks `or`
nodes and accepts `=`, `contains`, **and** `starts-with`.

### JS actions and external events

Parity with the other filter widgets, so the datagrid's "reset filters" control and the
standard Mendix filter JS actions work:

- `useOnResetValueEvent` — restore the `defaultValue` terms, or clear when resetting without defaults
- `useOnSetValueEvent` — `params.stringValue` is parsed as a full term list through the normalizer
- `onChange` fires after the debounced commit; `valueAttribute` is written with the joined list

## `src/components/TermChipInput.tsx`

Built fresh rather than adapted from `TagPicker`, which is `downshift`-based and driven by an
options universe — the wrong shape for free text. Visual primitives are reused so the widget
matches the Dropdown filter: `Cross` and `classes(rootName)` from
`widget-plugin-dropdown-filter/controls/picker-primitives`, imported unchanged.

`ClearButton` from that same package is **not** reused: its `aria-label` is hardcoded to
"Clear selection", which is wrong for this widget and not overridable. The clear button is
a few lines of local markup using the same `Cross` icon and `clear`/`clearIcon` classes.

The component is fully controlled; all state lives in the mobx controller.

```
props: terms, inputValue, placeholder, disabled, ariaLabel,
       onCommit, onRemove, onClear, onInputChange, onBlur
```

### Keyboard and paste behavior

| Input                                 | Result                                                 |
| ------------------------------------- | ------------------------------------------------------ |
| `Enter`, `,`, `Tab`                   | commit current text as a chip, clear the input         |
| paste containing `,`, newline, or tab | intercepted by `onPaste`; split, normalize, append all |
| `Backspace` on an empty input         | remove the last chip                                   |
| `Escape`                              | clear the input text only; chips untouched             |
| blur                                  | commit pending text                                    |
| clear button                          | remove all chips and the input text                    |

### Why there are two input handlers, not one

`input[type=text]` runs the HTML value-sanitization algorithm, which **strips `\r` and `\n`**.
A newline-separated paste — a column copied out of Excel, which is the headline use case for
this widget — therefore arrives at `onChange` already collapsed into a single term, and no
change-handler logic can recover the lost structure.

So `onPaste` reads `clipboardData` directly and calls `onCommit` with the raw text, but only
when the pasted text contains a delimiter; delimiter-free pastes early-return and flow through
the normal controlled-input path. `onChange` keeps typed delimiters and ordinary typing, since
typing `,` never produces a paste event. `preventDefault()` on the intercepting branch is what
stops a single paste from firing both `onCommit` and a follow-up `onChange`.

A `<textarea>` would preserve newlines and was considered, but a single-line-styled textarea
brings Enter-key semantics that fight the commit behavior, plus sizing and Atlas-styling
problems. Six lines of paste handler is the cheaper trade.

### Accessibility

- Chip list is `role="list"`; each chip is a `role="listitem"`.
- Each remove button gets an aria-label from the `removeTermCaption` text template.
- An `aria-live="polite"` region announces the applied term count ("3 terms applied"). This is
  also what makes the overflow warning audible to screen reader users.

## `src/DatagridMultiTextFilter.xml`

Follows the Text filter's property layout, dropping `attrChoice`, `adjustable`, and
`defaultFilter`.

| Key                        | Type                               | Default    | Notes                                     |
| -------------------------- | ---------------------------------- | ---------- | ----------------------------------------- |
| `linkedDs`                 | datasource, `isLinked`, `isList`   | —          | Same pattern as the Text filter           |
| `attributes`               | object list containing `attribute` | —          | `String` attributes only                  |
| `matchMode`                | enumeration                        | `contains` | `contains` / `equal` / `startsWith`       |
| `maxTerms`                 | integer                            | `100`      | Cap; excess triggers the overflow warning |
| `defaultValue`             | expression, `String`               | —          | Parsed as a term list                     |
| `delay`                    | integer                            | `500`      | Debounce for the in-progress input text   |
| `placeholder`              | textTemplate                       | —          |                                           |
| `valueAttribute`           | attribute, `String`/`HashString`   | —          | Comma-joined round-trip                   |
| `onChange`                 | action                             | —          |                                           |
| `screenReaderInputCaption` | textTemplate                       | —          |                                           |
| `removeTermCaption`        | textTemplate                       | —          | aria-label for chip remove buttons        |

Property keys are lowerCamelCase and must match the generated
`typings/DatagridMultiTextFilterProps.d.ts` exactly.

Also required: `DatagridMultiTextFilter.editorConfig.ts`,
`DatagridMultiTextFilter.editorPreview.tsx`, `src/package.xml`, and the icon/tile PNGs.

## Files touched outside the new package

Filter widget styling lives in the module themesource, not in widget packages, so shipping the
widget in the Data Widgets module requires three small edits:

```
packages/modules/data-widgets/package.json
  +2 lines: mxpackage.dependencies, dependencies

packages/modules/data-widgets/src/themesource/datawidgets/web/main.scss
  +1 import

packages/modules/data-widgets/src/themesource/datawidgets/web/_datagrid-multi-text-filter.scss
  NEW
```

The new SCSS partial uses Atlas-level variables with literal fallbacks and its own
`widget-multi-text-filter-*` class names. It deliberately does not consume the dropdown
filter's `--wdf-*` custom properties or its `btn-with-cross` mixin: `--wdf-*` are declared on
the `.widget-dropdown-filter` root selector itself, so they do not cascade to our elements and
would resolve to nothing. Chip proportions, border radius, and font size are matched by value
so the two widgets read as siblings, with no coupling to a file that changes upstream.

## Error handling

| Condition                                    | Behavior                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| No FilterAPI context (widget outside a grid) | `ENOCONTEXT` Alert, via `withFilterAPI`                                      |
| Selected attribute not filterable            | Alert, via `withAttributeGuard`                                              |
| No attributes configured                     | `condition` is `undefined`; the filter is inert                              |
| Paste exceeds `maxTerms`                     | First `maxTerms` applied; warning Alert names the applied and dropped counts |
| Malformed persisted settings                 | `fromJSON` ignores the input, leaving current terms                          |
| `starts-with` tree in view state             | Parsed correctly by the local `termsFromCond`                                |

## Testing

### Store unit tests (Jest)

Highest-value coverage — the semantics live here.

- Condition shape at 0 / 1 / n terms against 1 / m attributes, for each `matchMode`
- Attributes with `filterable === false` are skipped
- Normalization: trim, drop empties, case-insensitive dedupe, split on all three delimiters
- `maxTerms` truncation, and `overflow` reporting the correct dropped count
- `toJSON` / `fromJSON` round-trip; malformed `fromJSON` input ignored
- `fromViewState` round-trip for all three match modes, **including `startsWith`** — the case
  shared `selectedFromCond` gets wrong

### Component tests (Jest + RTL)

- Every row of the keyboard/paste table above
- Debounced live-term behavior: typing without Enter still filters after `delay`
- Overflow warning renders and is announced

### E2E (Playwright)

`e2e/DatagridMultiTextFilter.spec.js` — paste a multi-term list into a grid, assert the
resulting row count. Follows `docs/requirements/e2e-test-guidelines.md`.

## Rejected alternatives

**Add a "multiple terms" mode to `datagrid-text-filter-web`.** One widget instead of two, but
it modifies the most actively maintained filter widget upstream — `DatagridTextFilter.xml`,
`DatagridTextFilter.tsx`, and `TextFilterContainer.tsx` all become recurring merge conflicts.
It also still cannot support Auto mode without changing the shared store.

**Add a reusable multi-value store to `widget-plugin-filtering` plus datagrid support.** The
most correct and reusable option, and the only one that makes Auto column mode work. Rejected
for blast radius: it touches `store-utils.ts`, the `FilterStore` union in `context.ts`,
`filter-commons/typings/settings.ts`, and `ColumnFilterStore.tsx` — shared code consumed by
every filter widget, on a fork that needs to rebase.

**Plain comma-separated text input.** Cheapest, but values containing commas need quoting
rules, and the user gets no feedback on how their input parsed.

**Per-term operator syntax** (`=exact`, `prefix*`, `-exclude`). Powerful, but a hidden syntax
users must discover. Reconsider only if asked for.

## Accepted tradeoffs

1. **No "Auto" column mode.** Attributes must be selected explicitly. Supporting Auto requires
   changing `StringInputFilterStore` and `ColumnFilterStore` — shared code, all filter widgets,
   high rebase cost.

2. **`maxTerms` is a real ceiling.** 100 terms × 3 attributes is a 300-branch `or()`, which
   Mendix translates to XPath/OQL. That will be slow against a large database source no matter
   what the widget does. Workloads that routinely need 500-value lookups want a server-side
   approach — a microflow datasource with an OQL `in` clause — not a client-side filter widget.
