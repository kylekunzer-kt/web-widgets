import { withAttributeGuard } from "@mendix/widget-plugin-filtering/helpers/withAttributeGuard";
import { withFilterAPI } from "@mendix/widget-plugin-filtering/helpers/withFilterAPI";
import { withPreloader } from "@mendix/widget-plugin-platform/hoc/withPreloader";
import { ReactElement } from "react";
import { DatagridMultiTextFilterContainerProps } from "../typings/DatagridMultiTextFilterProps";
import { MultiTextFilterContainer } from "./components/MultiTextFilterContainer";
import { withMultiStringStore } from "./hocs/withMultiStringStore";
import { isLoadingDefaultValues } from "./utils/widget-utils";

const Container = withPreloader<DatagridMultiTextFilterContainerProps>(
    MultiTextFilterContainer,
    isLoadingDefaultValues
);

const Filter = withAttributeGuard(withFilterAPI(withMultiStringStore(Container)));

export default function DatagridMultiTextFilter(props: DatagridMultiTextFilterContainerProps): ReactElement {
    return <Filter {...props} />;
}
