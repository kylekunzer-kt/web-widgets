import { normalizeTerms } from "../normalize-terms";

describe("normalizeTerms", () => {
    it("returns a single trimmed term", () => {
        expect(normalizeTerms("  abc  ", 100)).toEqual({ terms: ["abc"], dropped: 0 });
    });

    it("splits on commas", () => {
        expect(normalizeTerms("a,b,c", 100).terms).toEqual(["a", "b", "c"]);
    });

    it("splits on newlines, carriage returns and tabs", () => {
        expect(normalizeTerms("a\nb\r\nc\td", 100).terms).toEqual(["a", "b", "c", "d"]);
    });

    it("trims each term and drops empty ones", () => {
        expect(normalizeTerms("a, ,  b ,,c,", 100).terms).toEqual(["a", "b", "c"]);
    });

    it("returns an empty list for input that is only delimiters and whitespace", () => {
        expect(normalizeTerms(" , \n\t ", 100)).toEqual({ terms: [], dropped: 0 });
    });

    it("dedupes case-insensitively, keeping first-seen casing", () => {
        expect(normalizeTerms("ORD-1, ord-1, Ord-1, ORD-2", 100).terms).toEqual(["ORD-1", "ORD-2"]);
    });

    it("preserves paste order", () => {
        expect(normalizeTerms("zeta,alpha,mike", 100).terms).toEqual(["zeta", "alpha", "mike"]);
    });

    it("accepts an array input and flattens it", () => {
        expect(normalizeTerms(["a,b", "c"], 100).terms).toEqual(["a", "b", "c"]);
    });

    it("truncates to maxTerms and reports the dropped count", () => {
        expect(normalizeTerms("a,b,c,d,e", 3)).toEqual({ terms: ["a", "b", "c"], dropped: 2 });
    });

    it("counts dropped terms after deduping, not before", () => {
        // 5 raw values, 3 unique, cap of 3 -> nothing dropped
        expect(normalizeTerms("a,a,b,b,c", 3)).toEqual({ terms: ["a", "b", "c"], dropped: 0 });
    });

    it("clamps a non-positive maxTerms to 1 rather than filtering nothing", () => {
        expect(normalizeTerms("a,b", 0)).toEqual({ terms: ["a"], dropped: 1 });
        expect(normalizeTerms("a,b", -5)).toEqual({ terms: ["a"], dropped: 1 });
    });

    it("keeps internal spaces inside a term", () => {
        expect(normalizeTerms("John Smith, Jane Doe", 100).terms).toEqual(["John Smith", "Jane Doe"]);
    });
});
