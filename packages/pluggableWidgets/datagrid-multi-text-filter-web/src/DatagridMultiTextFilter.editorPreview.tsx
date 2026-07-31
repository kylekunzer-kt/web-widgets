// enableStaticRendering must run before anything else in this module evaluates.
// Studio Pro renders the preview without a browser event loop, and mobx-react-lite
// observers throw without it. Do not let an import sorter move this below other imports.
import { enableStaticRendering } from "mobx-react-lite";
enableStaticRendering(true);

import { parseStyle } from "@mendix/widget-plugin-platform/preview/parse-style";
import { ReactElement } from "react";
import { DatagridMultiTextFilterPreviewProps } from "../typings/DatagridMultiTextFilterProps";
import { normalizeTerms } from "./utils/normalize-terms";
import { TermChipInput } from "./components/TermChipInput";

export function preview(props: DatagridMultiTextFilterPreviewProps): ReactElement {
    const terms = props.defaultValue ? normalizeTerms(props.defaultValue, props.maxTerms || 100).terms : [];

    return (
        <TermChipInput
            className={props.className}
            style={parseStyle(props.style)}
            terms={terms}
            inputValue=""
            placeholder={props.placeholder}
            ariaLabel={props.screenReaderInputCaption}
            removeTermCaption={props.removeTermCaption}
            onCommit={() => {
                //
            }}
            onRemove={() => {
                //
            }}
            onRemoveLast={() => {
                //
            }}
            onClear={() => {
                //
            }}
            onInputChange={() => {
                //
            }}
        />
    );
}
