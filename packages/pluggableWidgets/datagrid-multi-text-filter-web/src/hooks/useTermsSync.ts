import { ActionValue, EditableValue } from "mendix";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";
import { MultiStringFilterStore } from "../stores/MultiStringFilterStore";

interface SyncProps {
    valueAttribute?: EditableValue<string>;
    onChange?: ActionValue;
}

/**
 * Writes the applied terms to the configured "Saved attribute" as a comma-joined
 * string and fires the On change action.
 *
 * Joining on comma is lossless because a term can never contain a delimiter — typing
 * or pasting one splits the term.
 */
export function useTermsSync(props: SyncProps, store: MultiStringFilterStore): void {
    const pbox = useRef(props);

    useEffect(() => {
        pbox.current = props;
    });

    useEffect(
        () =>
            reaction(
                () => store.activeTerms.join(","),
                joined => {
                    const { valueAttribute, onChange } = pbox.current;
                    valueAttribute?.setValue(joined === "" ? undefined : joined);
                    if (onChange?.canExecute) {
                        onChange.execute();
                    }
                }
            ),
        [store]
    );
}
