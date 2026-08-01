import { hidePropertyIn, Properties } from "@mendix/pluggable-widgets-tools";
import {
    containsIcon,
    containsIconDark,
    equalsIcon,
    equalsIconDark,
    startsWithIcon,
    startsWithIconDark
} from "@mendix/widget-plugin-filtering/preview/editor-preview-icons";
import {
    ContainerProps,
    ImageProps,
    structurePreviewPalette,
    StructurePreviewProps,
    text
} from "@mendix/widget-plugin-platform/preview/structure-preview-api";
import { DatagridMultiTextFilterPreviewProps, MatchModeEnum } from "../typings/DatagridMultiTextFilterProps";

export function getProperties(values: DatagridMultiTextFilterPreviewProps, defaultProperties: Properties): Properties {
    // The button caption is only reachable when the match-mode button is rendered.
    if (!values.adjustable) {
        hidePropertyIn(defaultProperties, values, "screenReaderButtonCaption");
    }

    // linkedDs is populated by the platform from the parent grid, never by the
    // user, and it generates no prop at all in the preview typings — hence the
    // synthetic cast instead of referencing values.linkedDs.
    hidePropertyIn(defaultProperties, {} as { linkedDs: unknown }, "linkedDs");

    return defaultProperties;
}

export const getPreview = (values: DatagridMultiTextFilterPreviewProps, isDarkMode: boolean): StructurePreviewProps => {
    const palette = structurePreviewPalette[isDarkMode ? "dark" : "light"];

    return {
        type: "RowLayout",
        columnSize: "grow",
        borders: true,
        borderRadius: 5,
        borderWidth: 1,
        children: [
            {
                type: "RowLayout",
                columnSize: "grow",
                backgroundColor: palette.background.container,
                children: [
                    {
                        type: "Container",
                        padding: 2,
                        grow: 0,
                        children: [
                            {
                                type: "Image",
                                document: getSvgContent(values.matchMode, isDarkMode)
                            } as ImageProps
                        ]
                    } as ContainerProps,
                    {
                        type: "Container",
                        borders: true,
                        borderWidth: 0.5,
                        grow: 0
                    } as ContainerProps,
                    {
                        type: "Container",
                        padding: 8,
                        children: [
                            text({
                                fontColor: palette.text.secondary,
                                italic: true
                            })(values.placeholder || " ")
                        ],
                        grow: 1
                    } as ContainerProps
                ]
            }
        ]
    };
};

function getSvgContent(mode: MatchModeEnum, isDarkMode: boolean): string {
    switch (mode) {
        case "contains":
            return isDarkMode ? containsIconDark : containsIcon;
        case "equal":
            return isDarkMode ? equalsIconDark : equalsIcon;
        case "startsWith":
            return isDarkMode ? startsWithIconDark : startsWithIcon;
    }
}
