import { FilterData, InputData, SelectData } from "@mendix/filter-commons/typings/settings";
import { isInputData } from "@mendix/widget-plugin-dropdown-filter/stores/BaseSelectStore";
import { Filter } from "@mendix/widget-plugin-filtering/typings/ObservableFilterHost";
import { AttributeMetaData } from "mendix";
import { FilterCondition } from "mendix/filters";
import { attribute, contains, equals, literal, or, startsWith } from "mendix/filters/builders";
import { action, comparer, computed, makeObservable, observable } from "mobx";
import { MatchModeEnum } from "../../typings/DatagridMultiTextFilterProps";
import { normalizeTerms } from "../utils/normalize-terms";
import { termsFromCond } from "../utils/terms-from-cond";

type ConditionBuilder = (attr: ReturnType<typeof attribute>, value: ReturnType<typeof literal>) => FilterCondition;

const BUILDERS: Record<MatchModeEnum, ConditionBuilder> = {
    contains,
    equal: equals,
    startsWith
};

/**
 * `isInputData` decides on `data[0]` alone, so a one-term list like `["contains"]` would be
 * misread as another widget's input-filter settings and silently dropped. `InputData` is
 * always a 3-tuple, so only treat the sniff as a match when the length actually agrees —
 * expressed as a single predicate (rather than inlining `data.length === 3 && isInputData(data)`
 * at the call site) so TypeScript can narrow `data` to `SelectData` after a negated check.
 */
function looksLikeInputData(data: InputData | SelectData): data is InputData {
    return data.length === 3 && isInputData(data);
}

export interface MultiStringFilterStoreSpec {
    attributes: Array<AttributeMetaData<string>>;
    matchMode: MatchModeEnum;
    maxTerms: number;
    /** When true, the end user may change the match mode at runtime. */
    matchModeAdjustable?: boolean;
}

const MATCH_MODES: MatchModeEnum[] = ["contains", "equal", "startsWith"];

/**
 * Prefix marking the persisted match mode in the settings array.
 *
 * `FilterData` only permits `string[]` for a select-style store, so there is no separate
 * slot for the mode — it rides as a sentinel first element. A stored term would have to
 * be the literal string `@@matchMode:contains` (or one of the other two modes) to be
 * mistaken for it, which is why the suffix is validated against the known modes rather
 * than accepted blindly.
 */
const MODE_PREFIX = "@@matchMode:";

function isMatchMode(value: string): value is MatchModeEnum {
    return (MATCH_MODES as string[]).includes(value);
}

/**
 * Holds a list of search terms and emits a flat `or(...)` over terms x attributes.
 *
 * Implements the shared `Filter` interface, which is the entire contract
 * `ObservableFilterHost.observe()` requires. It deliberately does not join the
 * `FilterStore` union in `widget-plugin-filtering/context.ts`, because it is never
 * handed out through the `direct` provider — staying out of that union is what keeps
 * this widget from needing changes to shared packages.
 */
export class MultiStringFilterStore implements Filter {
    /** Committed terms, in the order they were entered or pasted. */
    terms: string[] = [];
    /** Uncommitted input text, pushed here debounced so typing one term still filters. */
    liveTerm = "";
    /**
     * Terms rejected by `maxTerms` on the last mutation. An observable field rather
     * than a computed one: truncation happens inside `setTerms`, so the rejected
     * count cannot be recovered from `terms` afterwards.
     */
    droppedCount = 0;
    /** True once terms have come from defaults, settings, or view state. */
    isInitialized = false;

    private _attributes: Array<AttributeMetaData<string>>;
    private _matchMode: MatchModeEnum;
    private _maxTerms: number;
    private _defaultTerms: string[] = [];
    /** The design-time match mode, i.e. what `reset()` and a locked filter fall back to. */
    private _defaultMatchMode: MatchModeEnum;
    private _matchModeAdjustable: boolean;
    /**
     * True once the mode came from the user or from restored settings. Guards `updateProps`
     * from overwriting a runtime choice every time the widget re-renders.
     */
    private _matchModeTouched = false;

    constructor(spec: MultiStringFilterStoreSpec, initCond: FilterCondition | null) {
        this._attributes = spec.attributes;
        this._matchMode = spec.matchMode;
        this._defaultMatchMode = spec.matchMode;
        this._matchModeAdjustable = spec.matchModeAdjustable ?? false;
        this._maxTerms = Math.max(1, Math.floor(spec.maxTerms));

        makeObservable<this, "_attributes" | "_matchMode" | "_maxTerms" | "_matchModeAdjustable">(this, {
            terms: observable.struct,
            liveTerm: observable,
            droppedCount: observable,
            isInitialized: observable,
            _attributes: observable.ref,
            _matchMode: observable,
            _maxTerms: observable,
            _matchModeAdjustable: observable,
            matchMode: computed,
            setMatchMode: action,
            activeTerms: computed,
            liveTermSuppressed: computed,
            condition: computed,
            setTerms: action,
            addTerms: action,
            removeTerm: action,
            removeLastTerm: action,
            setLiveTerm: action,
            clear: action,
            reset: action,
            setDefaultTerms: action,
            updateProps: action,
            fromJSON: action,
            fromViewState: action
        });

        // `initCond` mirrors a shared-precedent constructor parameter (other filter stores in
        // this codebase accept it too); production never actually calls this constructor with a
        // non-null value, since MultiStringStoreProvider always passes `null` and view-state
        // restoration for this widget happens exclusively through CustomFilterHost.observe().
        if (initCond) {
            this.fromViewState(initCond);
        }
    }

    /** The match mode currently applied to every term. */
    get matchMode(): MatchModeEnum {
        return this._matchMode;
    }

    /**
     * Change the match mode at runtime. Ignored when the widget is configured as not
     * adjustable, so a stale persisted setting or a rogue caller cannot unlock it.
     */
    setMatchMode(mode: MatchModeEnum): void {
        if (!this._matchModeAdjustable || mode === this._matchMode) {
            return;
        }
        this._matchMode = mode;
        this._matchModeTouched = true;
    }

    /** Committed terms plus the live term, when the live term is usable. */
    get activeTerms(): string[] {
        const live = this.liveTerm.trim();

        if (live === "" || this.terms.length >= this._maxTerms) {
            return this.terms;
        }

        const key = live.toLowerCase();
        if (this.terms.some(term => term.toLowerCase() === key)) {
            return this.terms;
        }

        return [...this.terms, live];
    }

    /** True when a non-empty live term is being ignored because the cap is full. */
    get liveTermSuppressed(): boolean {
        return this.liveTerm.trim() !== "" && this.terms.length >= this._maxTerms;
    }

    get condition(): FilterCondition | undefined {
        const terms = this.activeTerms;

        if (terms.length === 0) {
            return undefined;
        }

        const build = BUILDERS[this._matchMode];
        const branches: FilterCondition[] = [];

        for (const attr of this._attributes) {
            // Shared-precedent parity with other filter stores' `condition` getters. In
            // production this branch is unreachable: `DatagridMultiTextFilter` refuses to
            // render (and never mounts this store against a live grid) when any selected
            // attribute is not filterable, so every attribute here is already filterable.
            if (!attr.filterable) {
                continue;
            }
            const attrExp = attribute(attr.id);
            for (const term of terms) {
                branches.push(build(attrExp, literal(term)));
            }
        }

        if (branches.length === 0) {
            return undefined;
        }

        return branches.length === 1 ? branches[0] : or(...branches);
    }

    setTerms(input: string | string[]): void {
        const { terms, dropped } = normalizeTerms(input, this._maxTerms);
        this.terms = terms;
        this.droppedCount = dropped;
    }

    addTerms(input: string | string[]): void {
        const incoming = Array.isArray(input) ? input : [input];
        this.setTerms([...this.terms, ...incoming]);
    }

    removeTerm(term: string): void {
        this.terms = this.terms.filter(existing => existing !== term);
        this.droppedCount = 0;
    }

    removeLastTerm(): void {
        if (this.terms.length === 0) {
            return;
        }
        this.terms = this.terms.slice(0, -1);
        this.droppedCount = 0;
    }

    setLiveTerm(text: string): void {
        this.liveTerm = text;
    }

    clear(): void {
        this.terms = [];
        this.liveTerm = "";
        this.droppedCount = 0;
    }

    reset(): void {
        this.setTerms(this._defaultTerms);
        this.liveTerm = "";
        // A reset returns the whole filter to its design-time state, match mode included.
        this._matchMode = this._defaultMatchMode;
        this._matchModeTouched = false;
    }

    /**
     * Stores the configured default and applies it, unless terms already came from
     * persisted settings or view state — those must win over the design-time default.
     *
     * The `!isInitialized` guard alone does not guarantee that precedence: it only stops
     * this method from clobbering terms that were already set. What actually makes settings
     * win is effect ordering — React runs effects child-first, so the controller's
     * `setup()` (which calls this method) always runs before the parent HOC's
     * `provider.setup()` → `observe()` → `fromJSON`, which lands afterwards and
     * unconditionally overwrites whatever this method just applied. Moving this call into
     * the HOC or the store constructor would run it after `fromJSON` instead of before it,
     * silently inverting precedence and discarding users' saved personalization.
     */
    setDefaultTerms(defaultValue: string | undefined): void {
        this._defaultTerms = defaultValue ? normalizeTerms(defaultValue, this._maxTerms).terms : [];

        if (!this.isInitialized) {
            this.setTerms(this._defaultTerms);
            this.isInitialized = true;
        }
    }

    updateProps(spec: MultiStringFilterStoreSpec): void {
        if (!comparer.shallow(this._attributes, spec.attributes)) {
            this._attributes = spec.attributes;
        }
        this._maxTerms = Math.max(1, Math.floor(spec.maxTerms));
        this._defaultMatchMode = spec.matchMode;
        this._matchModeAdjustable = spec.matchModeAdjustable ?? false;

        // Only follow the design-time mode while nothing has overridden it. Otherwise every
        // re-render would undo the end user's choice — and locking the widget in Studio Pro
        // must still force the configured mode back, which is why the lock case reasserts it.
        if (!this._matchModeAdjustable || !this._matchModeTouched) {
            this._matchMode = spec.matchMode;
        }
    }

    toJSON(): FilterData {
        if (!this.isInitialized) {
            return undefined;
        }
        // The mode rides as a sentinel first element — see MODE_PREFIX.
        return [MODE_PREFIX + this._matchMode, ...this.terms];
    }

    fromJSON(data: FilterData): void {
        if (data == null || !Array.isArray(data) || looksLikeInputData(data)) {
            return;
        }

        if (!data.every((item): item is string => typeof item === "string")) {
            return;
        }

        let terms = data;

        // Peel off the persisted match mode if it is present and names a mode we know.
        // Settings written before the mode was persisted simply have no sentinel, so they
        // still restore correctly as a plain term list.
        const [first, ...rest] = data;
        if (typeof first === "string" && first.startsWith(MODE_PREFIX)) {
            const mode = first.slice(MODE_PREFIX.length);
            if (isMatchMode(mode)) {
                terms = rest;
                // Bypass setMatchMode's adjustable guard for the restore itself, but keep a
                // locked widget pinned to its configured mode.
                if (this._matchModeAdjustable) {
                    this._matchMode = mode;
                    this._matchModeTouched = true;
                }
            }
        }

        this.setTerms(terms);
        this.isInitialized = true;
    }

    fromViewState(cond: FilterCondition): void {
        const { terms } = normalizeTerms(termsFromCond(cond), this._maxTerms);

        if (terms.length === 0) {
            return;
        }

        this.terms = terms;
        this.droppedCount = 0;
        this.isInitialized = true;
    }
}
