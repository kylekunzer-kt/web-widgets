import { isBinary, isOr } from "@mendix/filter-commons/condition-utils";
import { FilterCondition } from "mendix/filters";

const SUPPORTED_OPERATORS = new Set(["=", "contains", "starts-with"]);

/**
 * Walks a filter condition tree and collects the string literals used as search terms.
 *
 * Returns terms in tree order **with duplicates** — a condition built over N attributes
 * repeats each term N times. Pass the result through `normalizeTerms` to dedupe.
 *
 * This exists instead of `selectedFromCond` from `@mendix/filter-commons`, which only
 * recognizes `=` and `contains` and would silently return `[]` for a `starts-with` tree.
 */
export function termsFromCond(cond: FilterCondition): string[] {
    const terms: string[] = [];

    const walk = (node: FilterCondition): void => {
        if (isOr(node)) {
            node.args.forEach(walk);
            return;
        }

        if (!SUPPORTED_OPERATORS.has(node.name) || !isBinary(node)) {
            return;
        }

        const { arg2 } = node;
        if (arg2.type === "literal" && arg2.valueType === "string") {
            terms.push(arg2.value);
        }
    };

    walk(cond);

    return terms;
}
