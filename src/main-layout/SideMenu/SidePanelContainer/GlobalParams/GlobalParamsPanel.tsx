import React from 'react';
import {BasePanel} from "../BasePanel";
import {LM} from "../../../../translations/language-manager";
import {GlobalParamsForm} from "./GlobalParamsForm";

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`global_params.${msg}`);
}

export class GlobalParamsPanel extends React.Component<any, any> {
    render() {
        return <BasePanel className="profile-management" title={<React.Fragment>{getIntlMessage("title")}</React.Fragment>}>
            <GlobalParamsForm />
        </BasePanel>
    }
}