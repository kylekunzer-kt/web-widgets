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

    constructor(spec: MultiStringFilterStoreSpec, initCond: FilterCondition | null) {
        this._attributes = spec.attributes;
        this._matchMode = spec.matchMode;
        this._maxTerms = spec.maxTerms;

        makeObservable<this, "_attributes" | "_matchMode" | "_maxTerms">(this, {
            terms: observable.struct,
            liveTerm: observable,
            droppedCount: observable,
            isInitialized: observable,
            _attributes: observable.ref,
            _matchMode: observable,
            _maxTerms: observable,
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

        if (initCond) {
            this.fromViewState(initCond);
        }
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
    }

    /**
     * Stores the configured default and applies it, unless terms already came from
     * persisted settings or view state — those must win over the design-time default.
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
        this._matchMode = spec.matchMode;
        this._maxTerms = spec.maxTerms;
    }

    toJSON(): FilterData {
        return this.isInitialized ? this.terms : undefined;
    }

    fromJSON(data: FilterData): void {
        if (data == null || !Array.isArray(data) || looksLikeInputData(data)) {
            return;
        }

        if (!data.every((item): item is string => typeof item === "string")) {
            return;
        }

        this.setTerms(data);
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
