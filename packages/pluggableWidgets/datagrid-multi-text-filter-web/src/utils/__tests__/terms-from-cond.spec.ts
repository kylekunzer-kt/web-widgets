// `mendix/filters/builders` ships types only (no runtime JS). The shared Jest config maps
// it to a dumb jest.fn() stub that returns undefined, which can't build a real condition
// tree to walk. This inline factory mirrors the pattern used in
// tree-node-web's TreeNodeV2.spec.tsx: a per-file mock that returns real, walkable objects
// shaped like the actual mendix/filters union (type/name/arg1/arg2/args).
jest.mock("mendix/filters/builders", () => ({
    attribute: (attributeId: unknown) => ({ type: "attribute", attributeId }),
    literal: (value: unknown) => ({
        type: "literal",
        value,
        valueType: typeof value === "string" ? "string" : typeof value === "boolean" ? "boolean" : "undefined"
    }),
    contains: (arg1: unknown, arg2: unknown) => ({ type: "function", name: "contains", arg1, arg2 }),
    equals: (arg1: unknown, arg2: unknown) => ({ type: "function", name: "=", arg1, arg2 }),
    startsWith: (arg1: unknown, arg2: unknown) => ({ type: "function", name: "starts-with", arg1, arg2 }),
    greaterThan: (arg1: unknown, arg2: unknown) => ({ type: "function", name: ">", arg1, arg2 }),
    or: (...args: unknown[]) => ({ type: "function", name: "or", args })
}));

import { attribute, contains, equals, greaterThan, literal, or, startsWith } from "mendix/filters/builders";
import { termsFromCond } from "../terms-from-cond";

// `ListAttributeId` is a branded `string & { __attributeIdTag: never }` type, so a plain
// string literal needs an explicit cast here — same pattern used in
// packages/shared/filter-commons/src/__tests__/condition-utils.spec.ts.
const attrA = attribute("attr_a" as any);
const attrB = attribute("attr_b" as any);

describe("termsFromCond", () => {
    it("reads a single bare contains condition", () => {
        expect(termsFromCond(contains(attrA, literal("abc")))).toEqual(["abc"]);
    });

    it("reads a single bare equals condition", () => {
        expect(termsFromCond(equals(attrA, literal("abc")))).toEqual(["abc"]);
    });

    it("reads a single bare starts-with condition, which shared selectedFromCond misses", () => {
        expect(termsFromCond(startsWith(attrA, literal("abc")))).toEqual(["abc"]);
    });

    it("reads every branch of a flat or tree", () => {
        const cond = or(contains(attrA, literal("a")), contains(attrA, literal("b")), contains(attrA, literal("c")));
        expect(termsFromCond(cond)).toEqual(["a", "b", "c"]);
    });

    it("returns one entry per branch, including per-attribute duplicates", () => {
        const cond = or(
            contains(attrA, literal("x")),
            contains(attrA, literal("y")),
            contains(attrB, literal("x")),
            contains(attrB, literal("y"))
        );
        expect(termsFromCond(cond)).toEqual(["x", "y", "x", "y"]);
    });

    it("walks nested or trees", () => {
        const cond = or(contains(attrA, literal("a")), or(contains(attrB, literal("b"))));
        expect(termsFromCond(cond)).toEqual(["a", "b"]);
    });

    it("skips branches whose operator is not a supported match mode", () => {
        const cond = or(
            contains(attrA, literal("keep")),
            greaterThan(attrA, literal("skip-me")),
            equals(attrA, literal("also-keep"))
        );
        expect(termsFromCond(cond)).toEqual(["keep", "also-keep"]);
    });

    it("ignores non-string literals", () => {
        expect(termsFromCond(equals(attrA, literal(true)))).toEqual([]);
    });

    it("returns an empty list when no branch is interpretable", () => {
        expect(termsFromCond(greaterThan(attrA, literal("x")))).toEqual([]);
    });

    it("reads the right-hand literal even from a literal-to-literal comparison", () => {
        // Not a condition this widget produces. Asserted to pin the behavior: returning a
        // stray term is preferable to throwing during view-state restore.
        expect(termsFromCond(equals(literal("a"), literal("b")))).toEqual(["b"]);
    });
});
