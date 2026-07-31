import { FilterAPI } from "@mendix/widget-plugin-filtering/context";
import { BaseStoreProvider } from "@mendix/widget-plugin-filtering/custom-filter-api/BaseStoreProvider";
import { MultiStringFilterStore, MultiStringFilterStoreSpec } from "./MultiStringFilterStore";

export interface MultiStringStoreProviderSpec extends MultiStringFilterStoreSpec {
    dataKey: string;
}

/**
 * Registers a `MultiStringFilterStore` with the grid's filter host.
 *
 * `BaseStoreProvider.setup()` already performs `filterObserver.observe(dataKey, store)`
 * and returns the matching disposer, so there is nothing to add here.
 */
export class MultiStringStoreProvider extends BaseStoreProvider<MultiStringFilterStore> {
    protected _store: MultiStringFilterStore;
    protected filterAPI: FilterAPI;
    readonly dataKey: string;

    constructor(filterAPI: FilterAPI, spec: MultiStringStoreProviderSpec) {
        super();
        this.filterAPI = filterAPI;
        this.dataKey = spec.dataKey;
        this._store = new MultiStringFilterStore(spec, null);
    }

    get store(): MultiStringFilterStore {
        return this._store;
    }
}
