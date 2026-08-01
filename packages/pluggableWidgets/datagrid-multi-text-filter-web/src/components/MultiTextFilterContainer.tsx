import { Alert } from "@mendix/widget-plugin-component-kit/Alert";
import { useOnResetValueEvent, useOnSetValueEvent } from "@mendix/widget-plugin-external-events/hooks";
import { useSetup } from "@mendix/widget-plugin-mobx-kit/react/useSetup";
import { generateUUID } from "@mendix/widget-plugin-platform/framework/generate-uuid";
import classNames from "classnames";
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
                maxTerms: props.maxTerms,
                matchModeAdjustable: props.adjustable
            });
        }, [props.filterStore, props.attributes, props.matchMode, props.maxTerms, props.adjustable]);

        useTermsSync(props, props.filterStore);

        useOnResetValueEvent({
            widgetName: props.name,
            parentChannelName: props.parentChannelName,
            listener: controller.handleResetValue
        });

        useOnSetValueEvent({ widgetName: props.name, listener: controller.handleSetValue });

        const applied = controller.appliedCount;
        const suppressed = controller.liveTermSuppressed;
        // Total candidate terms: applied + truncated-by-paste + a cap-suppressed live term,
        // which are mutually exclusive causes of overflow but both must count toward the
        // total so the message never reads e.g. "Only 2 of 2 terms were applied".
        const total = applied + controller.droppedCount + (suppressed ? 1 : 0);

        return (
            <div className={classNames("widget-multi-text-filter-wrapper", props.class)} style={props.style}>
                <TermChipInput
                    id={id}
                    tabIndex={props.tabIndex}
                    terms={controller.terms}
                    inputValue={controller.inputValue}
                    placeholder={props.placeholder?.value}
                    ariaLabel={props.screenReaderInputCaption?.value}
                    removeTermCaption={props.removeTermCaption?.value}
                    adjustable={props.adjustable}
                    matchMode={controller.matchMode}
                    matchModeCaption={props.screenReaderButtonCaption?.value}
                    onMatchModeChange={controller.handleMatchModeChange}
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
                        Only {applied} of {total} terms were applied. Remove some terms or raise the maximum terms
                        setting.
                    </Alert>
                )}
            </div>
        );
    }
);
