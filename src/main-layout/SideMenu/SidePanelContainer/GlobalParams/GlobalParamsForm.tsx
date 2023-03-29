import {
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { Button, Popover } from 'antd';
import React from 'react';
import { LM } from 'src/translations/language-manager';
import "../../../../main-layout/SessionWindow/SessionTab/SessionManagement/ParamsForm.scss";
import { GlobalParameterService } from "../../../../services/GlobalParameterService";
import { GlobalServiceRegistry } from "../../../../services/GlobalServiceRegistry";
import { ParameterForm } from "../../../../common/ParameterForm";

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`global_params.${msg}`, options);
}

interface GlobalParamsFormState {
    initialized: boolean;
    addFormVisible: boolean;
}

export class GlobalParamsForm extends React.Component<any, GlobalParamsFormState> {
    fieldIterationIndex = 0;
    private formRef: any = React.createRef();
    private initialRenderTimer: any;
    private globalParamsManager: GlobalParameterService;

    constructor(props: any) {
        super(props)
        this.state = {
            initialized: false,
            addFormVisible: false
        }
        this.globalParamsManager = GlobalServiceRegistry.globalParamsManager;
    }


    componentDidMount(): void {
        this.loadAll();
    }

    componentWillUnmount(): void {
        clearTimeout(this.initialRenderTimer)
    }

    private loadAll() {
        this.initialRenderTimer = setTimeout(() => {
            this.setState({ initialized: true })
        }, 100)
    }

    private getInitialValues = () => {
        return this.globalParamsManager.getGlobalParameters();
    }

    private togglePopover = (state: boolean) => {
        this.setState({ addFormVisible: state })
    }

    render() {
        const { initialized, addFormVisible } = this.state;
        const allParams = this.globalParamsManager.getGlobalParameters();

        return <div className="params-container">
            {initialized && <React.Fragment>
                <div className="params-header">
                    <Popover
                        content={addFormVisible ? <ParameterForm messageFunc={getIntlMessage} togglePopover={this.togglePopover} onChange={(key, value) => {
                            this.globalParamsManager.setGlobalParameter(key, value);
                            this.loadAll();
                        }} /> : null}
                        title={getIntlMessage("add").toUpperCase()}
                        placement="top"
                        visible={addFormVisible}
                        overlayClassName="param-popper-overlay"
                    >
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add")}</Button>
                    </Popover>
                </div>
                <div className="params-table-wrapper">
                    <table className="styled-table">
                        <thead>
                        <th>{getIntlMessage("key")}</th>
                        <th>{getIntlMessage("value")}</th>
                        <th>{getIntlMessage("counter")}</th>
                        <th style={{width: 30}}></th>
                        </thead>
                        <tbody>
                        {Object.keys(allParams).map(key => {
                            const param = allParams[key];
                            return <tr>
                                <td>{key}</td>
                                <td>{param.value}</td>
                                <td>{param.count ?? "-"}</td>
                                <td><DeleteOutlined onClick={() => {
                                    this.globalParamsManager.removeGlobalParameter(key);
                                    this.loadAll();
                                }} /></td>
                            </tr>
                        })}
                        </tbody>
                    </table>
                </div>
            </React.Fragment>}
        </div>

    }

}