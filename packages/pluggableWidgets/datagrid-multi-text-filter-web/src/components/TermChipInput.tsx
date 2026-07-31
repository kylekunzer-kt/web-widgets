import { Cross, classes } from "@mendix/widget-plugin-dropdown-filter/controls/picker-primitives";
import classNames from "classnames";
import { ChangeEvent, ClipboardEvent, CSSProperties, FocusEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { TERM_DELIMITERS } from "../utils/normalize-terms";

const cls = classes("widget-multi-text-filter");

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
        onCommit(pasted);
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
            <div className={cls.inputContainer}>
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
                <input
                    className={cls.input}
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
            </div>
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
    );
}
