import { disposeBatch } from "@mendix/widget-plugin-mobx-kit/main";
import { debounce } from "@mendix/widget-plugin-platform/utils/debounce";
import { action, computed, makeObservable, observable, reaction, runInAction } from "mobx";
import { createRef, RefObject } from "react";
import { MultiStringFilterStore } from "../stores/MultiStringFilterStore";

export interface MultiTextFilterControllerParams {
    filter: MultiStringFilterStore;
    changeDelay?: number;
    defaultValue?: string;
}

export class MultiTextFilterController {
    /** Text currently in the input, not yet committed to a chip. */
    inputValue = "";
    inputRef: RefObject<HTMLInputElement | null> = createRef<HTMLInputElement>();

    private filter: MultiStringFilterStore;
    private readonly changeDelay: number;
    private readonly defaultValue?: string;

    constructor(params: MultiTextFilterControllerParams) {
        this.filter = params.filter;
        this.changeDelay = params.changeDelay ?? 500;
        this.defaultValue = params.defaultValue;

        makeObservable(this, {
            inputValue: observable,
            terms: computed,
            appliedCount: computed,
            droppedCount: computed,
            showOverflowWarning: computed,
            handleInputChange: action,
            handleCommit: action,
            handleRemove: action,
            handleRemoveLast: action,
            handleClear: action,
            handleResetValue: action,
            handleSetValue: action
        });
    }

    get terms(): string[] {
        return this.filter.terms;
    }

    get appliedCount(): number {
        return this.filter.activeTerms.length;
    }

    get droppedCount(): number {
        return this.filter.droppedCount;
    }

    get showOverflowWarning(): boolean {
        return this.filter.droppedCount > 0 || this.filter.liveTermSuppressed;
    }

    setup(): () => void {
        const [add, disposeAll] = disposeBatch();

        // Debounced push of the in-progress input text into the store, so typing a
        // single term still filters without the user pressing Enter.
        const [pushLiveTerm, cancelPush] = debounce((text: string) => {
            runInAction(() => this.filter.setLiveTerm(text));
        }, this.changeDelay);

        add(cancelPush);
        add(
            reaction(
                () => this.inputValue,
                text => pushLiveTerm(text)
            )
        );

        this.filter.setDefaultTerms(this.defaultValue);

        return disposeAll;
    }

    handleInputChange = (text: string): void => {
        this.inputValue = text;
    };

    handleCommit = (text: string): void => {
        this.filter.addTerms(text);
        this.inputValue = "";
        this.filter.setLiveTerm("");
    };

    handleRemove = (term: string): void => {
        this.filter.removeTerm(term);
    };

    handleRemoveLast = (): void => {
        this.filter.removeLastTerm();
    };

    handleClear = (): void => {
        this.inputValue = "";
        this.filter.clear();
    };

    handleResetValue = (useDefaultValue: boolean): void => {
        this.inputValue = "";
        if (useDefaultValue) {
            this.filter.reset();
            return;
        }
        this.filter.clear();
    };

    handleSetValue = (useDefaultValue: boolean, params: { stringValue?: string }): void => {
        this.inputValue = "";
        if (useDefaultValue) {
            this.filter.reset();
            return;
        }
        this.filter.setTerms(params.stringValue ?? "");
        this.filter.setLiveTerm("");
    };
}
