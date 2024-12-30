import React from 'react';
import { BasePanel } from "../BasePanel";
import { LM } from "../../../../translations/language-manager";
import { GlobalParamsForm } from "./GlobalParamsForm";
import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import "./GlobalParamsPanel.scss";

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`global_params.${msg}`);
}

export class GlobalParamsPanel extends React.Component<any, any> {
    render() {
        return <BasePanel className="global-param-management" title={<React.Fragment>{getIntlMessage("title")}
            <div className="actions">
                <Button shape="circle" icon={<CloseOutlined />} onClick={this.props.onClose} />
            </div>
        </React.Fragment>}>
            <GlobalParamsForm />
        </BasePanel >
    }
}