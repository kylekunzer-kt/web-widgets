import "@testing-library/jest-dom";

import { FilterAPI } from "@mendix/widget-plugin-filtering/context";
import { ObservableFilterHost } from "@mendix/widget-plugin-filtering/typings/ObservableFilterHost";
import { ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { render } from "@testing-library/react";
import { AttributeMetaData } from "mendix";
import { attribute, contains, literal } from "mendix/filters/builders";
import { MatchModeEnum } from "../../../typings/DatagridMultiTextFilterProps";
import { MultiStringFilterProps } from "../../components/typings";
import { withMultiStringStore } from "../withMultiStringStore";

interface StubProps {
    name: string;
    attributes: Array<{ attribute: AttributeMetaData<string> }>;
    matchMode: MatchModeEnum;
    maxTerms: number;
}

const attr = new ListAttributeValueBuilder()
    .withId("attr_a")
    .withType("String")
    .withFilterable(true)
    .build() as AttributeMetaData<string>;

function makeFilterAPI(): { api: FilterAPI; observe: jest.Mock } {
    const observe = jest.fn();
    const filterObserver = { observe, unobserve: jest.fn() } as unknown as ObservableFilterHost;
    const api = { version: 3, parentChannelName: "datagrid/1", provider: null, filterObserver } as unknown as FilterAPI;
    return { api, observe };
}

function renderHost(): { received: Array<StubProps & MultiStringFilterProps>; observe: jest.Mock } {
    const received: Array<StubProps & MultiStringFilterProps> = [];
    const Wrapped = withMultiStringStore<StubProps>(props => {
        received.push(props);
        return <div />;
    });
    const { api, observe } = makeFilterAPI();

    render(
        <Wrapped
            name="filter-test"
            attributes={[{ attribute: attr }]}
            matchMode="contains"
            maxTerms={100}
            filterAPI={api}
        />
    );

    return { received, observe };
}

describe("withMultiStringStore", () => {
    it("injects the store it registered, under the widget name as data key", () => {
        const { received, observe } = renderHost();

        expect(observe).toHaveBeenCalledWith("filter-test", received[0].filterStore);
    });

    it("passes the parent channel name through from the filter API", () => {
        const { received } = renderHost();

        expect(received[0].parentChannelName).toBe("datagrid/1");
    });

    it("unwraps the attribute wrappers so the store filters on the selected attribute", () => {
        const { received } = renderHost();
        const store = received[0].filterStore;

        store.setTerms("abc");

        expect(store.condition).toEqual(contains(attribute("attr_a" as any), literal("abc")));
    });
});
