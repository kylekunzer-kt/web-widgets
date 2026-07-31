/**
 * This file was generated from DatagridMultiTextFilter.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { ActionValue, AttributeMetaData, DynamicValue, EditableValue } from "mendix";
import { CSSProperties } from "react";

export interface AttributesType {
    attribute: AttributeMetaData<string>;
}

export type MatchModeEnum = "contains" | "equal" | "startsWith";

export interface AttributesPreviewType {
    attribute: string;
}

export interface DatagridMultiTextFilterContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    attributes: AttributesType[];
    matchMode: MatchModeEnum;
    maxTerms: number;
    defaultValue?: DynamicValue<string>;
    placeholder?: DynamicValue<string>;
    delay: number;
    valueAttribute?: EditableValue<string>;
    onChange?: ActionValue;
    screenReaderInputCaption?: DynamicValue<string>;
    removeTermCaption?: DynamicValue<string>;
}

export interface DatagridMultiTextFilterPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    attributes: AttributesPreviewType[];
    matchMode: MatchModeEnum;
    maxTerms: number | null;
    defaultValue: string;
    placeholder: string;
    delay: number | null;
    valueAttribute: string;
    onChange: {} | null;
    screenReaderInputCaption: string;
    removeTermCaption: string;
}
