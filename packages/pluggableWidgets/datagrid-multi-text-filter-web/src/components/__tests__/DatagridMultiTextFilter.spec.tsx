import "@testing-library/jest-dom";

import { FilterAPI } from "@mendix/widget-plugin-filtering/context";
import { CustomFilterHost } from "@mendix/widget-plugin-filtering/stores/generic/CustomFilterHost";
import { attrId, dynamic, EditableValueBuilder, ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttributeMetaData } from "mendix";
import { createContext } from "react";
import { DatagridMultiTextFilterContainerProps } from "../../../typings/DatagridMultiTextFilterProps";
import DatagridMultiTextFilter from "../../DatagridMultiTextFilter";

const CHANNEL_NAME = "datagrid/1";

let filterHost: CustomFilterHost;

function attr(id: string, filterable = true): AttributeMetaData<string> {
    return new ListAttributeValueBuilder()
        .withId(attrId(id))
        .withType("String")
        .withFilterable(filterable)
        .build() as AttributeMetaData<string>;
}

function setContext(): void {
    filterHost = new CustomFilterHost();
    const filterAPI: FilterAPI = {
        version: 3,
        parentChannelName: CHANNEL_NAME,
        provider: { hasError: false, value: { type: "stub", hint: "No filter store available" } },
        filterObserver: filterHost
    } as unknown as FilterAPI;
    (window as any)["com.mendix.widgets.web.filterable.filterContext.v2"] = createContext<FilterAPI>(filterAPI);
}

function commonProps(
    overrides: Partial<DatagridMultiTextFilterContainerProps> = {}
): DatagridMultiTextFilterContainerProps {
    return {
        name: "filter-test",
        class: "filter-custom-class",
        tabIndex: 0,
        attributes: [{ attribute: attr("a") }],
        matchMode: "contains",
        adjustable: false,
        maxTerms: 100,
        delay: 500,
        ...overrides
    } as DatagridMultiTextFilterContainerProps;
}

beforeEach(() => {
    setContext();
});

describe("DatagridMultiTextFilter", () => {
    it("renders an empty chip input", () => {
        render(<DatagridMultiTextFilter {...commonProps()} />);
        expect(screen.getByRole("textbox")).toHaveValue("");
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("renders chips for the default value", () => {
        render(<DatagridMultiTextFilter {...commonProps({ defaultValue: dynamic.available("a,b") })} />);
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("lets persisted settings win over the configured default value", () => {
        filterHost.fromJSON([["filter-test", ["x", "y"]]]);

        render(<DatagridMultiTextFilter {...commonProps({ defaultValue: dynamic.available("a,b") })} />);

        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("x")).toBeInTheDocument();
        expect(screen.getByText("y")).toBeInTheDocument();
    });

    it("turns a pasted list into chips and produces an or condition", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("ORD-1, ORD-2, ORD-3");

        expect(screen.getAllByRole("listitem")).toHaveLength(3);

        const cond = filterHost.condWithMeta.cond;
        expect(cond).toBeDefined();
        expect(cond!.name).toBe("or");
        expect((cond as any).args).toHaveLength(3);
    });

    it("keeps a typed term when a delimiter-containing list is pasted afterwards", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.type(input, "Bob");
        await user.paste("Alice,Carol");

        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(screen.getByText("Bob")).toBeInTheDocument();
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Carol")).toBeInTheDocument();
    });

    it("splits a tab-separated paste into chips and produces an or condition", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a\tb\tc");

        expect(screen.getAllByRole("listitem")).toHaveLength(3);

        const cond = filterHost.condWithMeta.cond;
        expect(cond).toBeDefined();
        expect(cond!.name).toBe("or");
        expect((cond as any).args).toHaveLength(3);
    });

    it("picks up a changed match mode without remounting", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,");
        expect(filterHost.condWithMeta.cond!.name).toBe("contains");

        rerender(<DatagridMultiTextFilter {...commonProps({ matchMode: "equal" })} />);

        expect(filterHost.condWithMeta.cond!.name).toBe("=");
    });

    it("applies a debounced live term end to end", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps({ delay: 0 })} />);

        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.type(input, "abc");

        await waitFor(() => expect(filterHost.condWithMeta.cond).toBeDefined());
        expect(filterHost.condWithMeta.cond!.name).toBe("contains");
    });

    it("removes a chip and shrinks the condition", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,b");
        await user.click(screen.getByRole("button", { name: "Remove term a" }));

        expect(screen.getAllByRole("listitem")).toHaveLength(1);
        expect(filterHost.condWithMeta.cond!.name).toBe("contains");
    });

    it("clears everything with the clear button", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,b");
        await user.click(screen.getByRole("button", { name: "Clear all terms" }));

        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
        expect(filterHost.condWithMeta.cond).toBeUndefined();
    });

    it("warns when a paste exceeds maxTerms and applies only the allowed terms", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps({ maxTerms: 2 })} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,b,c,d");

        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByRole("alert")).toHaveTextContent(/2 of 4/);
    });

    it("counts a cap-suppressed live term in the overflow warning", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps({ maxTerms: 2, delay: 0 })} />);

        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.paste("a,b");
        await user.type(input, "c");

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/2 of 3/));
    });

    it("announces the applied term count", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,b");

        expect(screen.getByRole("status")).toHaveTextContent("2 terms applied");
    });

    it("announces a single term in the singular", async () => {
        const user = userEvent.setup();
        render(<DatagridMultiTextFilter {...commonProps()} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,");

        expect(screen.getByRole("status")).toHaveTextContent("1 term applied");
    });

    it("shows an error when the attribute is not filterable", () => {
        render(<DatagridMultiTextFilter {...commonProps({ attributes: [{ attribute: attr("a", false) }] })} />);
        expect(screen.getByText(/not filterable/i)).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows an error when placed outside a grid", () => {
        // No filter context at all — withFilterAPI must surface ENOCONTEXT.
        (window as any)["com.mendix.widgets.web.filterable.filterContext.v2"] = createContext<FilterAPI | null>(null);

        render(<DatagridMultiTextFilter {...commonProps()} />);

        expect(screen.getByText(/must be placed inside/i)).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("writes the applied terms to the saved attribute", async () => {
        const user = userEvent.setup();
        const valueAttribute = new EditableValueBuilder<string>().build();
        render(<DatagridMultiTextFilter {...commonProps({ valueAttribute })} />);

        await user.click(screen.getByRole("textbox"));
        await user.paste("a,b");

        expect(valueAttribute.setValue).toHaveBeenCalledWith("a,b");
    });

    it("does not render while the default value is still loading", () => {
        const { container } = render(<DatagridMultiTextFilter {...commonProps({ defaultValue: dynamic.loading() })} />);
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    describe("match mode button", () => {
        it("is absent when the filter is not adjustable", () => {
            const { container } = render(<DatagridMultiTextFilter {...commonProps({ adjustable: false })} />);
            expect(container.querySelector(".filter-selector")).not.toBeInTheDocument();
        });

        it("renders inside the shared filter-container chrome when adjustable", () => {
            const { container } = render(<DatagridMultiTextFilter {...commonProps({ adjustable: true })} />);

            // These are the built-in Text filter's own classes — matching them is what makes
            // the two widgets look identical without duplicating any styling.
            expect(container.querySelector(".filter-container")).toBeInTheDocument();
            expect(container.querySelector(".filter-selector")).toBeInTheDocument();
            expect(screen.getByRole("textbox")).toHaveClass("form-control", "filter-input");
        });

        it("shows the configured mode as the button's state class", () => {
            const { container } = render(
                <DatagridMultiTextFilter {...commonProps({ adjustable: true, matchMode: "startsWith" })} />
            );
            expect(container.querySelector(".filter-selector-button")).toHaveClass("startsWith");
        });

        it("switches the condition operator when the user picks another mode", async () => {
            const user = userEvent.setup();
            render(
                <DatagridMultiTextFilter
                    {...commonProps({
                        adjustable: true,
                        screenReaderButtonCaption: dynamic.available("Match mode")
                    })}
                />
            );

            await user.click(screen.getByRole("textbox"));
            await user.paste("abc,");
            expect(filterHost.condWithMeta.cond!.name).toBe("contains");

            // The shared FilterSelector's trigger is a downshift combobox, and its accessible
            // name is the selected option's caption (see useSelect) — so it announces the mode
            // currently in effect rather than a static label.
            await user.click(screen.getByRole("combobox", { name: "Contains" }));
            await user.click(screen.getByRole("option", { name: "Equal" }));

            expect(filterHost.condWithMeta.cond!.name).toBe("=");
        });
    });
});
