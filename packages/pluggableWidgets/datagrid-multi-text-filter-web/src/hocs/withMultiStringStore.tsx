import { FilterAPI } from "@mendix/widget-plugin-filtering/context";
import { useSetup } from "@mendix/widget-plugin-mobx-kit/react/useSetup";
import { AttributeMetaData } from "mendix";
import { FC } from "react";
import { MatchModeEnum } from "../../typings/DatagridMultiTextFilterProps";
import { MultiStringFilterProps } from "../components/typings";
import { MultiStringStoreProvider } from "../stores/MultiStringStoreProvider";

interface RequiredProps {
    attributes: Array<{ attribute: AttributeMetaData<string> }>;
    matchMode: MatchModeEnum;
    maxTerms: number;
    name: string;
}

export function withMultiStringStore<P extends RequiredProps>(
    Component: FC<P & MultiStringFilterProps>
): FC<P & { filterAPI: FilterAPI }> {
    return function MultiStringStoreHost(props) {
        const { store } = useSetup(
            () =>
                new MultiStringStoreProvider(props.filterAPI, {
                    attributes: props.attributes.map(obj => obj.attribute),
                    matchMode: props.matchMode,
                    maxTerms: props.maxTerms,
                    dataKey: props.name
                })
        );

        return <Component {...props} filterStore={store} parentChannelName={props.filterAPI.parentChannelName} />;
    };
}
