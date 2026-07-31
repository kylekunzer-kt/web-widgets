import { Alert } from "@mendix/widget-plugin-component-kit/Alert";
import { useOnResetValueEvent, useOnSetValueEvent } from "@mendix/widget-plugin-external-events/hooks";
import { useSetup } from "@mendix/widget-plugin-mobx-kit/react/useSetup";
import { generateUUID } from "@mendix/widget-plugin-platform/framework/generate-uuid";
import { observer } from "mobx-react-lite";
import { ReactElement, useEffect, useRef } from "react";
import { DatagridMultiTextFilterContainerProps } from "../../typings/DatagridMultiTextFilterProps";
import { MultiTextFilterController } from "../controllers/MultiTextFilterController";
import { useTermsSync } from "../hooks/useTermsSync";
import { TermChipInput } from "./TermChipInput";
import { MultiStringFilterProps } from "./typings";

export interface ContainerProps extends DatagridMultiTextFilterContainerProps, MultiStringFilterProps {}

export const MultiTextFilterContainer: (props: ContainerProps) => ReactElement = observer(
    function MultiTextFilterContainer(props) {
        const id = (useRef<string>(undefined).current ??= `MultiTextFilter${generateUUID()}`);

        const controller = useSetup(
            () =>
                new MultiTextFilterController({
                    filter: props.filterStore,
                    changeDelay: props.delay,
                    defaultValue: props.defaultValue?.value
                })
        );

        // Keep the store in sync with design-time properties so Studio Pro live
        // reload picks up changes to match mode, cap, and attribute selection.
        useEffect(() => {
            props.filterStore.updateProps({
                attributes: props.attributes.map(obj => obj.attribute),
                matchMode: props.matchMode,
                maxTerms: props.maxTerms
            });
        }, [props.filterStore, props.attributes, props.matchMode, props.maxTerms]);

        useTermsSync(props, props.filterStore);

        useOnResetValueEvent({
            widgetName: props.name,
            parentChannelName: props.parentChannelName,
            listener: controller.handleResetValue
        });

        useOnSetValueEvent({ widgetName: props.name, listener: controller.handleSetValue });

        const applied = controller.appliedCount;

        return (
            <div className="widget-multi-text-filter-wrapper">
                <TermChipInput
                    id={id}
                    className={props.class}
                    style={props.style}
                    tabIndex={props.tabIndex}
                    terms={controller.terms}
                    inputValue={controller.inputValue}
                    placeholder={props.placeholder?.value}
                    ariaLabel={props.screenReaderInputCaption?.value}
                    removeTermCaption={props.removeTermCaption?.value}
                    inputRef={controller.inputRef}
                    onCommit={controller.handleCommit}
                    onRemove={controller.handleRemove}
                    onRemoveLast={controller.handleRemoveLast}
                    onClear={controller.handleClear}
                    onInputChange={controller.handleInputChange}
                />
                <div className="widget-multi-text-filter-status" role="status" aria-live="polite">
                    {applied === 1 ? "1 term applied" : `${applied} terms applied`}
                </div>
                {controller.showOverflowWarning && (
                    <Alert bootstrapStyle="warning" role="alert">
                        Only {applied} of {applied + controller.droppedCount} terms were applied. Remove some terms or
                        raise the maximum terms setting.
                    </Alert>
                )}
            </div>
        );
    }
);
