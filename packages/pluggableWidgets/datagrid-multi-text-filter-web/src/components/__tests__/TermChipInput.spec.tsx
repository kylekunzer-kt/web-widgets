import "@testing-library/jest-dom";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { TermChipInput, TermChipInputProps } from "../TermChipInput";

function setup(overrides: Partial<TermChipInputProps> = {}): {
    props: TermChipInputProps;
    user: ReturnType<typeof userEvent.setup>;
} {
    const props: TermChipInputProps = {
        terms: [],
        inputValue: "",
        ariaLabel: "Search terms",
        removeTermCaption: "Remove term",
        onCommit: jest.fn(),
        onRemove: jest.fn(),
        onRemoveLast: jest.fn(),
        onClear: jest.fn(),
        onInputChange: jest.fn(),
        ...overrides
    };
    const user = userEvent.setup();
    render(<TermChipInput {...props} />);
    return { props, user };
}

describe("TermChipInput", () => {
    it("renders one chip per term", () => {
        setup({ terms: ["a", "b", "c"] });
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
        expect(screen.getByText("a")).toBeInTheDocument();
        expect(screen.getByText("c")).toBeInTheDocument();
    });

    it("renders no list when there are no terms", () => {
        setup();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("labels the input from ariaLabel", () => {
        setup();
        expect(screen.getByRole("textbox", { name: "Search terms" })).toBeInTheDocument();
    });

    it("shows the placeholder", () => {
        setup({ placeholder: "type or paste a list" });
        expect(screen.getByPlaceholderText("type or paste a list")).toBeInTheDocument();
    });

    it("attaches inputRef to the input element", () => {
        const inputRef = createRef<HTMLInputElement>();
        setup({ inputRef });
        expect(inputRef.current).toBe(screen.getByRole("textbox"));
    });

    it("reports plain typing through onInputChange", async () => {
        const { props, user } = setup();
        await user.type(screen.getByRole("textbox"), "a");
        expect(props.onInputChange).toHaveBeenCalledWith("a");
        expect(props.onCommit).not.toHaveBeenCalled();
    });

    it("commits on Enter", async () => {
        const { props, user } = setup({ inputValue: "abc" });
        await user.type(screen.getByRole("textbox"), "{Enter}");
        expect(props.onCommit).toHaveBeenCalledWith("abc");
    });

    it("does not commit an empty input on Enter", async () => {
        const { props, user } = setup({ inputValue: "" });
        await user.type(screen.getByRole("textbox"), "{Enter}");
        expect(props.onCommit).not.toHaveBeenCalled();
    });

    it("commits when a comma is typed", async () => {
        const { props, user } = setup({ inputValue: "abc" });
        await user.type(screen.getByRole("textbox"), ",");
        expect(props.onCommit).toHaveBeenCalledWith("abc,");
    });

    it("commits a pasted comma-separated list in one call", async () => {
        const { props, user } = setup();
        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.paste("ORD-1, ORD-2, ORD-3");
        expect(props.onCommit).toHaveBeenCalledWith("ORD-1, ORD-2, ORD-3");
        expect(props.onCommit).toHaveBeenCalledTimes(1);
    });

    it("commits a pasted newline-separated list", async () => {
        const { props, user } = setup();
        await user.click(screen.getByRole("textbox"));
        await user.paste("a\nb\nc");
        expect(props.onCommit).toHaveBeenCalledWith("a\nb\nc");
    });

    it("preserves pending input text when a delimiter-containing list is pasted", async () => {
        const { props, user } = setup({ inputValue: "Bob" });
        await user.click(screen.getByRole("textbox"));
        await user.paste("Alice,Carol");
        expect(props.onCommit).toHaveBeenCalledTimes(1);
        expect((props.onCommit as jest.Mock).mock.calls[0][0]).toContain("Bob");
    });

    it("routes a delimiter-free paste through onInputChange, not onCommit", async () => {
        const { props, user } = setup();
        await user.click(screen.getByRole("textbox"));
        await user.paste("Alfred");
        expect(props.onCommit).not.toHaveBeenCalled();
        expect(props.onInputChange).toHaveBeenCalledWith("Alfred");
    });

    it("commits on Tab when the input has text", async () => {
        const { props, user } = setup({ inputValue: "abc" });
        await user.type(screen.getByRole("textbox"), "{Tab}");
        expect(props.onCommit).toHaveBeenCalledTimes(1);
        expect(props.onCommit).toHaveBeenCalledWith("abc");
    });

    it("does not swallow Tab when the input is empty", async () => {
        const { props, user } = setup({ inputValue: "" });
        const input = screen.getByRole("textbox");
        input.focus();
        await user.tab();
        expect(props.onCommit).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(input);
    });

    it("removes the last chip on Backspace with an empty input", async () => {
        const { props, user } = setup({ terms: ["a", "b"], inputValue: "" });
        await user.type(screen.getByRole("textbox"), "{Backspace}");
        expect(props.onRemoveLast).toHaveBeenCalled();
    });

    it("does not remove a chip on Backspace while text is present", async () => {
        const { props, user } = setup({ terms: ["a"], inputValue: "xy" });
        await user.type(screen.getByRole("textbox"), "{Backspace}");
        expect(props.onRemoveLast).not.toHaveBeenCalled();
    });

    it("clears only the input text on Escape", async () => {
        const { props, user } = setup({ terms: ["a"], inputValue: "xy" });
        await user.type(screen.getByRole("textbox"), "{Escape}");
        expect(props.onInputChange).toHaveBeenCalledWith("");
        expect(props.onClear).not.toHaveBeenCalled();
    });

    it("commits pending text on blur", async () => {
        const { props, user } = setup({ inputValue: "abc" });
        await user.click(screen.getByRole("textbox"));
        await user.tab();
        expect(props.onCommit).toHaveBeenCalledWith("abc");
    });

    it("removes a specific term from its chip button", async () => {
        const { props, user } = setup({ terms: ["alpha", "beta"] });
        await user.click(screen.getByRole("button", { name: "Remove term alpha" }));
        expect(props.onRemove).toHaveBeenCalledWith("alpha");
    });

    it("shows the clear button when there are terms", async () => {
        const { props, user } = setup({ terms: ["a"] });
        await user.click(screen.getByRole("button", { name: "Clear all terms" }));
        expect(props.onClear).toHaveBeenCalled();
    });

    it("shows the clear button when only input text is present", () => {
        setup({ terms: [], inputValue: "x" });
        expect(screen.getByRole("button", { name: "Clear all terms" })).toBeInTheDocument();
    });

    it("hides the clear button when empty", () => {
        setup({ terms: [], inputValue: "" });
        expect(screen.queryByRole("button", { name: "Clear all terms" })).not.toBeInTheDocument();
    });
});
