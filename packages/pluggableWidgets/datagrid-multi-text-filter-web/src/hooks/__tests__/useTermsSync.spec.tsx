import "@testing-library/jest-dom";

import { ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { render } from "@testing-library/react";
import { ActionValue, AttributeMetaData, EditableValue } from "mendix";
import { ReactElement } from "react";
import { MultiStringFilterStore } from "../../stores/MultiStringFilterStore";
import { useTermsSync } from "../useTermsSync";

const attr = new ListAttributeValueBuilder()
    .withId("attr_a")
    .withType("String")
    .withFilterable(true)
    .build() as AttributeMetaData<string>;

function makeStore(): MultiStringFilterStore {
    return new MultiStringFilterStore({ attributes: [attr], matchMode: "contains", maxTerms: 100 }, null);
}

interface HarnessProps {
    store: MultiStringFilterStore;
    valueAttribute?: EditableValue<string>;
    onChange?: ActionValue;
}

function Harness({ store, valueAttribute, onChange }: HarnessProps): ReactElement {
    useTermsSync({ valueAttribute, onChange }, store);
    return <div />;
}

describe("useTermsSync", () => {
    it("does not write to the saved attribute on mount", () => {
        const store = makeStore();
        store.setTerms("a,b");
        const setValue = jest.fn();

        render(<Harness store={store} valueAttribute={{ setValue } as unknown as EditableValue<string>} />);

        expect(setValue).not.toHaveBeenCalled();
    });

    it("writes the comma-joined terms when the term list changes", () => {
        const store = makeStore();
        const setValue = jest.fn();
        render(<Harness store={store} valueAttribute={{ setValue } as unknown as EditableValue<string>} />);

        store.setTerms("a,b");

        expect(setValue).toHaveBeenCalledWith("a,b");
    });

    it("writes undefined rather than an empty string when the list becomes empty", () => {
        const store = makeStore();
        store.setTerms("a");
        const setValue = jest.fn();
        render(<Harness store={store} valueAttribute={{ setValue } as unknown as EditableValue<string>} />);

        store.clear();

        expect(setValue).toHaveBeenCalledWith(undefined);
    });

    it("fires the on-change action when it can execute", () => {
        const store = makeStore();
        const execute = jest.fn();
        render(<Harness store={store} onChange={{ canExecute: true, execute } as unknown as ActionValue} />);

        store.setTerms("a");

        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("does not fire the on-change action when it cannot execute", () => {
        const store = makeStore();
        const execute = jest.fn();
        render(<Harness store={store} onChange={{ canExecute: false, execute } as unknown as ActionValue} />);

        store.setTerms("a");

        expect(execute).not.toHaveBeenCalled();
    });

    it("tolerates having neither a saved attribute nor an on-change action", () => {
        const store = makeStore();
        render(<Harness store={store} />);

        expect(() => store.setTerms("a")).not.toThrow();
    });
});
