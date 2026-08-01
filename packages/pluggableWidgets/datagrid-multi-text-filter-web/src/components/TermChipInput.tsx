import { FilterSelector } from "@mendix/widget-plugin-filtering/controls/filter-selector/FilterSelector";
import { Cross, classes } from "@mendix/widget-plugin-dropdown-filter/controls/picker-primitives";
import classNames from "classnames";
import { ChangeEvent, ClipboardEvent, CSSProperties, FocusEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { MatchModeEnum } from "../../typings/DatagridMultiTextFilterProps";
import { TERM_DELIMITERS } from "../utils/normalize-terms";
import "../ui/DatagridMultiTextFilter.scss";

const cls = classes("widget-multi-text-filter");

/**
 * Captions match the XML enumeration so the dropdown reads the same as the Studio Pro
 * property. The `value` doubles as the CSS class the theme uses to pick each glyph, which
 * is why these keys must stay identical to `MatchModeEnum`.
 */
const MATCH_MODE_OPTIONS: Array<{ value: MatchModeEnum; label: string }> = [
    { value: "contains", label: "Contains" },
    { value: "equal", label: "Equal" },
    { value: "startsWith", label: "Starts with" }
];

export interface TermChipInputProps {
    terms: string[];
    inputValue: string;
    id?: string;
    className?: string;
    style?: CSSProperties;
    tabIndex?: number;
    placeholder?: string;
    ariaLabel?: string;
    removeTermCaption?: string;
    /** Renders the match-mode selector button ahead of the input. */
    adjustable?: boolean;
    matchMode?: MatchModeEnum;
    matchModeCaption?: string;
    onMatchModeChange?: (mode: MatchModeEnum) => void;
    inputRef?: RefObject<HTMLInputElement | null>;
    onCommit: (text: string) => void;
    onRemove: (term: string) => void;
    onRemoveLast: () => void;
    onClear: () => void;
    onInputChange: (text: string) => void;
}

export function TermChipInput(props: TermChipInputProps): ReactElement {
    const {
        terms,
        inputValue,
        ariaLabel = "Search terms",
        removeTermCaption = "Remove term",
        adjustable = false,
        matchMode = "contains",
        matchModeCaption,
        onMatchModeChange,
        onCommit,
        onRemove,
        onRemoveLast,
        onClear,
        onInputChange
    } = props;

    const showClear = terms.length > 0 || inputValue !== "";

    // Handles typed input, including a typed delimiter such as a comma.
    // Delimiter-containing pastes are intercepted separately by onPaste below:
    // `input type=text` strips newlines from its value before this handler ever
    // sees it, so a pasted newline-separated list can't be recovered here.
    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const next = event.target.value;
        if (TERM_DELIMITERS.test(next)) {
            onCommit(next);
            return;
        }
        onInputChange(next);
    };

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
        const pasted = event.clipboardData.getData("text");

        if (!TERM_DELIMITERS.test(pasted)) {
            // No delimiters — let the normal change handler take it, so the pasted
            // text lands in the input like ordinary typing.
            return;
        }

        // `input type=text` strips newlines in its value-sanitization algorithm, so a
        // newline-separated paste (e.g. a column copied from Excel) would reach onChange
        // already collapsed into one term. Read the clipboard directly instead.
        event.preventDefault();

        // Prepend any pending (not-yet-committed) input text so it isn't silently
        // discarded by this paste. Joining with a delimiter is lossless because a term
        // can never itself contain a delimiter — that invariant is what normalizeTerms
        // relies on to split the joined string back into the right terms.
        onCommit(inputValue.trim() !== "" ? `${inputValue},${pasted}` : pasted);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        switch (event.key) {
            case "Enter":
                event.preventDefault();
                if (inputValue.trim() !== "") {
                    onCommit(inputValue);
                }
                return;
            // Tab intentionally does not commit here. It must not preventDefault (focus has to
            // move), and the resulting focus change fires blur, which commits pending text. If
            // this case also committed, one Tab would commit twice.
            case "Backspace":
                if (inputValue === "") {
                    event.preventDefault();
                    onRemoveLast();
                }
                return;
            case "Escape":
                event.preventDefault();
                onInputChange("");
                return;
            default:
                return;
        }
    };

    const handleBlur = (_event: FocusEvent<HTMLInputElement>): void => {
        if (inputValue.trim() !== "") {
            onCommit(inputValue);
        }
    };

    return (
        <div className={classNames(cls.root, props.className)} style={props.style} id={props.id}>
            {/*
             * `filter-container`, `filter-selector` (via FilterSelector) and
             * `form-control filter-input` are exactly what the built-in Text filter renders
             * through InputWithFilters. Wearing the same classes means the input row's
             * chrome — height, border, radius, focus ring, and the selector button's glyphs
             * and seam — all come from the theme's existing `_datagrid-filters.scss` rather
             * than being reimplemented here, so the two widgets cannot drift apart.
             */}
            <div className={classNames("filter-container", cls.inputContainer)} data-focusindex={props.tabIndex ?? 0}>
                {adjustable && (
                    <FilterSelector
                        ariaLabel={matchModeCaption}
                        value={matchMode}
                        onSelect={value => onMatchModeChange?.(value as MatchModeEnum)}
                        options={MATCH_MODE_OPTIONS}
                    />
                )}
                <input
                    className={classNames("form-control", cls.input, { "filter-input": adjustable })}
                    type="text"
                    ref={props.inputRef}
                    value={inputValue}
                    placeholder={props.placeholder}
                    aria-label={ariaLabel}
                    tabIndex={props.tabIndex}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                />
                {/*
                 * `ClearButton` from the dropdown filter plugin is not reused here because its
                 * `aria-label` is hardcoded to "Clear selection". The `Cross` icon and
                 * `classes()` helper are reused, which is what keeps the visual language
                 * consistent.
                 */}
                {showClear && (
                    <button type="button" className={cls.clear} aria-label="Clear all terms" onClick={onClear}>
                        <Cross className={cls.clearIcon} />
                    </button>
                )}
            </div>
            {/*
             * Chips render below the input rather than inside it, so the input keeps a stable
             * height and the terms are free to wrap across as many rows as they need.
             */}
            {terms.length > 0 && (
                <ul className={`${cls.root}-terms`} role="list">
                    {terms.map(term => (
                        <li className={cls.selectedItem} role="listitem" key={term}>
                            <span className={`${cls.root}-term-text`}>{term}</span>
                            <button
                                type="button"
                                className={cls.removeIcon}
                                aria-label={`${removeTermCaption} ${term}`}
                                onClick={() => onRemove(term)}
                            >
                                <Cross />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
