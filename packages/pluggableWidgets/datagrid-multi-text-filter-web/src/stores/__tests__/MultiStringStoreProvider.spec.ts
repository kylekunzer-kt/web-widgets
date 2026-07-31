import { FilterAPI } from "@mendix/widget-plugin-filtering/context";
import { Filter, ObservableFilterHost } from "@mendix/widget-plugin-filtering/typings/ObservableFilterHost";
import { ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { AttributeMetaData } from "mendix";
import { MultiStringStoreProvider } from "../MultiStringStoreProvider";

function makeFilterAPI(): { api: FilterAPI; observe: jest.Mock; unobserve: jest.Mock } {
    const observe = jest.fn();
    const unobserve = jest.fn();
    const filterObserver = { observe, unobserve } as unknown as ObservableFilterHost;
    const api = { version: 3, parentChannelName: "datagrid/1", provider: null, filterObserver } as unknown as FilterAPI;
    return { api, observe, unobserve };
}

const attr = new ListAttributeValueBuilder()
    .withId("attr_a")
    .withType("String")
    .withFilterable(true)
    .build() as AttributeMetaData<string>;

describe("MultiStringStoreProvider", () => {
    it("registers its store with the filter observer under the given data key", () => {
        const { api, observe } = makeFilterAPI();
        const provider = new MultiStringStoreProvider(api, {
            attributes: [attr],
            matchMode: "contains",
            maxTerms: 100,
            dataKey: "filter-test"
        });

        provider.setup();

        expect(observe).toHaveBeenCalledTimes(1);
        const [key, filter] = observe.mock.calls[0] as [string, Filter];
        expect(key).toBe("filter-test");
        expect(filter).toBe(provider.store);
    });

    it("unregisters the store when disposed", () => {
        const { api, unobserve } = makeFilterAPI();
        const provider = new MultiStringStoreProvider(api, {
            attributes: [attr],
            matchMode: "contains",
            maxTerms: 100,
            dataKey: "filter-test"
        });

        provider.setup()();

        expect(unobserve).toHaveBeenCalledWith("filter-test");
    });
});
