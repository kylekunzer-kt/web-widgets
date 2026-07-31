/**
 * Characters that separate one search term from the next. Semicolon is deliberately
 * excluded: it appears inside real data more often than it is used as a separator.
 */
export const TERM_DELIMITERS = /[,\n\r\t]+/;

export interface NormalizeTermsResult {
    /** Normalized terms, capped at maxTerms. */
    terms: string[];
    /** How many terms were rejected by the cap. */
    dropped: number;
}

/**
 * Splits, trims, dedupes and caps raw user input into search terms.
 *
 * Deduping is case-insensitive because Mendix string comparison for
 * `contains`/`equals`/`startsWith` is case-insensitive, so two terms differing
 * only in case would produce identical filter branches.
 */
export function normalizeTerms(input: string | string[], maxTerms: number): NormalizeTermsResult {
    const chunks = Array.isArray(input) ? input : [input];
    const cap = Math.max(1, Math.floor(maxTerms));

    const seen = new Set<string>();
    const unique: string[] = [];

    for (const chunk of chunks) {
        for (const part of chunk.split(TERM_DELIMITERS)) {
            const term = part.trim();
            if (term === "") {
                continue;
            }
            const key = term.toLowerCase();
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            unique.push(term);
        }
    }

    const dropped = Math.max(0, unique.length - cap);

    return { terms: dropped > 0 ? unique.slice(0, cap) : unique, dropped };
}
