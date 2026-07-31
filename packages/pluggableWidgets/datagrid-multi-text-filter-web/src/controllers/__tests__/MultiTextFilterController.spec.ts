import { ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { AttributeMetaData } from "mendix";
import { MultiStringFilterStore } from "../../stores/MultiStringFilterStore";
import { MultiTextFilterController } from "../MultiTextFilterController";

jest.useFakeTimers();

const attr = new ListAttributeValueBuilder()
    .withId("attr_a")
    .withType("String")
    .withFilterable(true)
    .build() as AttributeMetaData<string>;

function makeStore(maxTerms = 100): MultiStringFilterStore {
    return new MultiStringFilterStore({ attributes: [attr], matchMode: "contains", maxTerms }, null);
}

function makeController(
    store: MultiStringFilterStore,
    overrides: { changeDelay?: number; defaultValue?: string } = {}
): { controller: MultiTextFilterController; dispose: () => void } {
    const controller = new MultiTextFilterController({ filter: store, changeDelay: 500, ...overrides });
    const dispose = controller.setup();
    return { controller, dispose };
}

describe("MultiTextFilterController", () => {
    it("applies the default value on setup", () => {
        const store = makeStore();
        const { dispose } = makeController(store, { defaultValue: "a,b" });
        expect(store.terms).toEqual(["a", "b"]);
        dispose();
    });

    it("pushes typed text to the store as a live term after the delay", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleInputChange("abc");
        expect(store.liveTerm).toBe("");

        jest.advanceTimersByTime(500);
        expect(store.liveTerm).toBe("abc");
        expect(store.activeTerms).toEqual(["abc"]);

        dispose();
    });

    it("does not push typed text before the delay elapses", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleInputChange("ab");
        jest.advanceTimersByTime(400);
        expect(store.liveTerm).toBe("");

        dispose();
    });

    it("commits text into a chip and clears the input and live term", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleInputChange("abc");
        jest.advanceTimersByTime(500);
        controller.handleCommit("abc");

        expect(store.terms).toEqual(["abc"]);
        expect(controller.inputValue).toBe("");
        expect(store.liveTerm).toBe("");

        dispose();
    });

    it("splits a committed multi-term string into chips", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleCommit("ORD-1, ORD-2, ORD-3");
        expect(store.terms).toEqual(["ORD-1", "ORD-2", "ORD-3"]);

        dispose();
    });

    it("appends committed terms to existing chips", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleCommit("a");
        controller.handleCommit("b,c");
        expect(store.terms).toEqual(["a", "b", "c"]);

        dispose();
    });

    it("removes a term", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleCommit("a,b");
        controller.handleRemove("a");
        expect(store.terms).toEqual(["b"]);

        dispose();
    });

    it("removes the last term", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleCommit("a,b");
        controller.handleRemoveLast();
        expect(store.terms).toEqual(["a"]);

        dispose();
    });

    it("clears terms and input text", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleCommit("a,b");
        controller.handleInputChange("c");
        controller.handleClear();

        expect(store.terms).toEqual([]);
        expect(controller.inputValue).toBe("");

        dispose();
    });

    it("reports overflow when a paste exceeds the cap", () => {
        const store = makeStore(2);
        const { controller, dispose } = makeController(store);

        expect(controller.showOverflowWarning).toBe(false);
        controller.handleCommit("a,b,c,d");
        expect(controller.showOverflowWarning).toBe(true);
        expect(controller.appliedCount).toBe(2);
        expect(controller.droppedCount).toBe(2);

        dispose();
    });

    it("reports overflow when the live term is suppressed by a full cap", () => {
        const store = makeStore(1);
        const { controller, dispose } = makeController(store);

        controller.handleCommit("a");
        controller.handleInputChange("b");
        jest.advanceTimersByTime(500);

        expect(controller.showOverflowWarning).toBe(true);

        dispose();
    });

    it("resets to the default value on a reset event with defaults", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store, { defaultValue: "a,b" });

        controller.handleCommit("z");
        controller.handleResetValue(true);

        expect(store.terms).toEqual(["a", "b"]);
        expect(controller.inputValue).toBe("");

        dispose();
    });

    it("clears on a reset event without defaults", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store, { defaultValue: "a,b" });

        controller.handleResetValue(false);
        expect(store.terms).toEqual([]);

        dispose();
    });

    it("parses a set-value event string into terms", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleSetValue(false, { stringValue: "x,y,z" });
        expect(store.terms).toEqual(["x", "y", "z"]);

        dispose();
    });

    it("resets to defaults on a set-value event that asks for defaults", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store, { defaultValue: "a" });

        controller.handleCommit("z");
        controller.handleSetValue(true, {});
        expect(store.terms).toEqual(["a"]);

        dispose();
    });

    it("stops pushing live terms after disposal", () => {
        const store = makeStore();
        const { controller, dispose } = makeController(store);

        controller.handleInputChange("abc");
        dispose();
        jest.advanceTimersByTime(1000);

        expect(store.liveTerm).toBe("");
    });
});
