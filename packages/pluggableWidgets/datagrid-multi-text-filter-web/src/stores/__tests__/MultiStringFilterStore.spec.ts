import { ListAttributeValueBuilder } from "@mendix/widget-plugin-test-utils";
import { AttributeMetaData } from "mendix";
import { attribute, contains, literal, or, startsWith } from "mendix/filters/builders";
import { MultiStringFilterStore, MultiStringFilterStoreSpec } from "../MultiStringFilterStore";

function attr(id: string, filterable = true): AttributeMetaData<string> {
    return new ListAttributeValueBuilder()
        .withId(id)
        .withType("String")
        .withFilterable(filterable)
        .build() as AttributeMetaData<string>;
}

function spec(overrides: Partial<MultiStringFilterStoreSpec> = {}): MultiStringFilterStoreSpec {
    return { attributes: [attr("attr_a")], matchMode: "contains", maxTerms: 100, ...overrides };
}

function makeStore(overrides: Partial<MultiStringFilterStoreSpec> = {}): MultiStringFilterStore {
    return new MultiStringFilterStore(spec(overrides), null);
}

describe("MultiStringFilterStore", () => {
    describe("condition", () => {
        it("is undefined when there are no terms", () => {
            expect(makeStore().condition).toBeUndefined();
        });

        it("is a bare condition for one term and one attribute", () => {
            const store = makeStore();
            store.setTerms("abc");
            // ListAttributeId is a branded type (string & { __attributeIdTag: never }); cast is
            // needed only in test fixtures to construct one from a plain string literal.
            expect(store.condition).toEqual(contains(attribute("attr_a" as any), literal("abc")));
        });

        it("is a flat or over terms for one attribute", () => {
            const store = makeStore();
            store.setTerms("a,b,c");
            expect(store.condition).toEqual(
                or(
                    contains(attribute("attr_a" as any), literal("a")),
                    contains(attribute("attr_a" as any), literal("b")),
                    contains(attribute("attr_a" as any), literal("c"))
                )
            );
        });

        it("is a flat or over terms x attributes", () => {
            const store = makeStore({ attributes: [attr("attr_a"), attr("attr_b")] });
            store.setTerms("x,y");
            const cond = store.condition;
            expect(cond).toBeDefined();
            expect(cond!.name).toBe("or");
            expect((cond as any).args).toHaveLength(4);
        });

        it("uses the equals builder in equal mode", () => {
            const store = makeStore({ matchMode: "equal" });
            store.setTerms("abc");
            expect(store.condition!.name).toBe("=");
        });

        it("uses the startsWith builder in startsWith mode", () => {
            const store = makeStore({ matchMode: "startsWith" });
            store.setTerms("abc");
            expect(store.condition).toEqual(startsWith(attribute("attr_a" as any), literal("abc")));
        });

        it("skips attributes that are not filterable", () => {
            const store = makeStore({ attributes: [attr("attr_a"), attr("attr_b", false)] });
            store.setTerms("x");
            expect(store.condition).toEqual(contains(attribute("attr_a" as any), literal("x")));
        });

        it("is undefined when no attribute is filterable", () => {
            const store = makeStore({ attributes: [attr("attr_a", false)] });
            store.setTerms("x");
            expect(store.condition).toBeUndefined();
        });

        it("is undefined when there are no attributes at all", () => {
            const store = makeStore({ attributes: [] });
            store.setTerms("x");
            expect(store.condition).toBeUndefined();
        });
    });

    describe("activeTerms", () => {
        it("includes the trimmed live term", () => {
            const store = makeStore();
            store.setTerms("a");
            store.setLiveTerm("  b  ");
            expect(store.activeTerms).toEqual(["a", "b"]);
        });

        it("ignores a blank live term", () => {
            const store = makeStore();
            store.setTerms("a");
            store.setLiveTerm("   ");
            expect(store.activeTerms).toEqual(["a"]);
        });

        it("ignores a live term that duplicates a chip, case-insensitively", () => {
            const store = makeStore();
            store.setTerms("ORD-1");
            store.setLiveTerm("ord-1");
            expect(store.activeTerms).toEqual(["ORD-1"]);
        });

        it("suppresses the live term once the cap is reached", () => {
            const store = makeStore({ maxTerms: 2 });
            store.setTerms("a,b");
            store.setLiveTerm("c");
            expect(store.activeTerms).toEqual(["a", "b"]);
            expect(store.liveTermSuppressed).toBe(true);
        });

        it("does not report suppression when under the cap", () => {
            const store = makeStore({ maxTerms: 3 });
            store.setTerms("a,b");
            store.setLiveTerm("c");
            expect(store.liveTermSuppressed).toBe(false);
        });
    });

    describe("term mutation", () => {
        it("addTerms appends to existing terms and dedupes", () => {
            const store = makeStore();
            store.setTerms("a,b");
            store.addTerms("b,c");
            expect(store.terms).toEqual(["a", "b", "c"]);
        });

        it("removeTerm removes an exact match and clears the dropped count", () => {
            const store = makeStore({ maxTerms: 2 });
            store.setTerms("a,b,c");
            expect(store.droppedCount).toBe(1);
            store.removeTerm("a");
            expect(store.terms).toEqual(["b"]);
            expect(store.droppedCount).toBe(0);
        });

        it("removeLastTerm removes the final chip", () => {
            const store = makeStore();
            store.setTerms("a,b,c");
            store.removeLastTerm();
            expect(store.terms).toEqual(["a", "b"]);
        });

        it("removeLastTerm is a no-op when there are no terms", () => {
            const store = makeStore();
            expect(() => store.removeLastTerm()).not.toThrow();
            expect(store.terms).toEqual([]);
        });

        it("clear empties terms, live term and dropped count", () => {
            const store = makeStore({ maxTerms: 1 });
            store.setTerms("a,b");
            store.setLiveTerm("c");
            store.clear();
            expect(store.terms).toEqual([]);
            expect(store.liveTerm).toBe("");
            expect(store.droppedCount).toBe(0);
        });

        it("records the dropped count when the cap truncates a paste", () => {
            const store = makeStore({ maxTerms: 3 });
            store.setTerms("a,b,c,d,e");
            expect(store.terms).toEqual(["a", "b", "c"]);
            expect(store.droppedCount).toBe(2);
        });
    });

    describe("defaults", () => {
        it("applies the default value on first call", () => {
            const store = makeStore();
            store.setDefaultTerms("a,b");
            expect(store.terms).toEqual(["a", "b"]);
            expect(store.isInitialized).toBe(true);
        });

        it("treats an undefined default as no terms", () => {
            const store = makeStore();
            store.setDefaultTerms(undefined);
            expect(store.terms).toEqual([]);
        });

        it("does not overwrite terms restored from settings", () => {
            const store = makeStore();
            store.fromJSON(["x", "y"]);
            store.setDefaultTerms("a,b");
            expect(store.terms).toEqual(["x", "y"]);
        });

        it("reset restores the default terms", () => {
            const store = makeStore();
            store.setDefaultTerms("a,b");
            store.setTerms("z");
            store.setLiveTerm("q");
            store.reset();
            expect(store.terms).toEqual(["a", "b"]);
            expect(store.liveTerm).toBe("");
        });
    });

    describe("settings persistence", () => {
        it("toJSON is undefined before initialization", () => {
            expect(makeStore().toJSON()).toBeUndefined();
        });

        it("round-trips terms through toJSON and fromJSON", () => {
            const store = makeStore();
            store.setDefaultTerms(undefined);
            store.setTerms("a,b,c");
            const json = store.toJSON();
            expect(json).toEqual(["a", "b", "c"]);

            const restored = makeStore();
            restored.fromJSON(json);
            expect(restored.terms).toEqual(["a", "b", "c"]);
        });

        it("ignores null and undefined settings", () => {
            const store = makeStore();
            store.setTerms("a");
            store.fromJSON(undefined);
            store.fromJSON(null);
            expect(store.terms).toEqual(["a"]);
        });

        it("ignores input-filter shaped settings from another widget type", () => {
            const store = makeStore();
            store.setTerms("a");
            store.fromJSON(["equal", "x", null]);
            expect(store.terms).toEqual(["a"]);
        });

        it("ignores a settings array containing non-string entries", () => {
            const store = makeStore();
            store.setTerms("a");
            store.fromJSON(["x", 42, "y"] as any);
            expect(store.terms).toEqual(["a"]);
        });

        it("keeps a single-term list whose term collides with an operator name", () => {
            const store = makeStore();
            store.fromJSON(["contains"]);
            expect(store.terms).toEqual(["contains"]);
        });

        it("applies the cap to restored settings", () => {
            const store = makeStore({ maxTerms: 2 });
            store.fromJSON(["a", "b", "c"]);
            expect(store.terms).toEqual(["a", "b"]);
        });
    });

    describe("view state", () => {
        it("restores terms from a contains or tree", () => {
            const store = makeStore();
            store.setTerms("a,b");
            const cond = store.condition!;

            const restored = makeStore();
            restored.fromViewState(cond);
            expect(restored.terms).toEqual(["a", "b"]);
            expect(restored.isInitialized).toBe(true);
        });

        it("restores terms from a startsWith or tree", () => {
            const store = makeStore({ matchMode: "startsWith" });
            store.setTerms("a,b");
            const cond = store.condition!;

            const restored = makeStore({ matchMode: "startsWith" });
            restored.fromViewState(cond);
            expect(restored.terms).toEqual(["a", "b"]);
        });

        it("restores terms from an equal or tree", () => {
            const store = makeStore({ matchMode: "equal" });
            store.setTerms("a,b");

            const restored = makeStore({ matchMode: "equal" });
            restored.fromViewState(store.condition!);
            expect(restored.terms).toEqual(["a", "b"]);
        });

        it("dedupes the per-attribute repetition in a multi-attribute tree", () => {
            const store = makeStore({ attributes: [attr("attr_a"), attr("attr_b")] });
            store.setTerms("x,y");

            const restored = makeStore({ attributes: [attr("attr_a"), attr("attr_b")] });
            restored.fromViewState(store.condition!);
            expect(restored.terms).toEqual(["x", "y"]);
        });

        it("applies the store's constructor condition", () => {
            const cond = or(
                contains(attribute("attr_a" as any), literal("a")),
                contains(attribute("attr_a" as any), literal("b"))
            );
            const store = new MultiStringFilterStore(spec(), cond);
            expect(store.terms).toEqual(["a", "b"]);
        });

        it("leaves terms untouched when the condition yields nothing", () => {
            const store = makeStore();
            store.setTerms("keep");
            store.fromViewState(contains(attribute("attr_a" as any), literal("")));
            expect(store.terms).toEqual(["keep"]);
        });
    });

    describe("updateProps", () => {
        it("picks up a new match mode", () => {
            const store = makeStore();
            store.setTerms("abc");
            store.updateProps(spec({ matchMode: "equal" }));
            expect(store.condition!.name).toBe("=");
        });

        it("picks up new attributes", () => {
            const store = makeStore();
            store.setTerms("abc");
            store.updateProps(spec({ attributes: [attr("attr_z")] }));
            expect(store.condition).toEqual(contains(attribute("attr_z" as any), literal("abc")));
        });
    });
});
