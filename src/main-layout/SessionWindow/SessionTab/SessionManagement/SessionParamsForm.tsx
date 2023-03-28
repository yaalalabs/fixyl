import {
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { Form, Button, Popover, Select, Input } from 'antd';
import DatePicker from 'antd/lib/date-picker';
import React, { useRef, useState } from 'react';
import { FixSession } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import "./ParamsForm.scss";

const { Option } = Select;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`session_params.${msg}`, options);
}


interface SessionParamsFormProps {
    session: FixSession;
}

interface SessionParamsFormState {
    initialized: boolean;
    addFormVisible: boolean;
}


export const ParameterForm = ({ onChange, session, togglePopover }: {
    onChange: (key: string, value: any) => void,
    togglePopover: (state: boolean) => void,
    session?: FixSession
}) => {
    const formRef: any = useRef(null);
    const [variableType, setVariableType] = useState("string")

    const checkFormHasErrors = (): boolean => {
        const fields = formRef.current?.getFieldsError() ?? [];

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.errors.length > 0) {
                return true;
            }
        }

        return false;
    }

    let input: any;

    switch (variableType) {
        case "boolean":
            input = <Select>
                <Option key={"1"} value={""}>{""}</Option>
                <Option key={"Y"} value="Y">Y</Option>
                <Option key={"N"} value="N">N</Option>
            </Select>
            break;
        case "utctimestamp":
            input = <DatePicker showTime format="YYYY-MM-DD hh:mm:ss:ms" />
            break;
        case "monthyear":
            input = <DatePicker picker="month" />
            break;
        case "utcdateonly":
            input = <DatePicker format="YYYY-MM-DD" />
            break;
        case "utctimeonly":
            input = <DatePicker picker="time" />
            break;
        default:
            input = <Input />;
    }

    return (<div className="params-form-container">
        <div className="header">
            <div className="close" onClick={() => togglePopover(false)}>✕</div>
        </div>
        <div className="data-type-selector">
            <Form.Item label={getIntlMessage("select_type")} labelCol={{ span: 24 }}>
                <Select value={variableType} onChange={(value) => {
                    setVariableType(value);
                    formRef.current?.setFieldsValue({ "value": undefined })
                }}>
                    <Option key={"string"} value={"string"}>String</Option>
                    <Option key={"boolean"} value={"boolean"}>Boolean</Option>
                    <Option key={"utctimestamp"} value={"utctimestamp"}>Timestamp</Option>
                    <Option key={"monthyear"} value={"monthyear"}>Month Year</Option>
                    <Option key={"utcdateonly"} value={"utcdateonly"}>UTC Date Only</Option>
                    <Option key={"utctimeonly"} value={"utctimeonly"}>UTC Time Only</Option>
                </Select>
            </Form.Item>
        </div>
        <Form ref={formRef} initialValues={{ state: session?.profile.autoLoginEnabled, loginMsg: session?.profile.autoLoginMsg }} layout="vertical" className="save-as-form"
            onFinish={(values) => { onChange(values.key, values.value) }}>
            <div className="form-item-container">
                <Form.Item name="key" rules={[{
                    required: true,
                }]} label={getIntlMessage("key")}>
                    <Input />
                </Form.Item>

                <Form.Item name="value" rules={[{
                    required: true,
                }]} label={getIntlMessage("value")}>
                    {input}
                </Form.Item>
            </div>
            <div style={{ textAlign: "center" }}>
                <Button className="button-v2" type="primary" style={{ marginLeft: "auto" }}
                    htmlType="submit" onClick={() => {
                        setTimeout(() => {
                            if (!checkFormHasErrors()) {
                                togglePopover(false)
                            }
                        }, 10)
                    }}>
                    {getIntlMessage("save").toUpperCase()}
                </Button>
            </div>
        </Form>
    </div>);
}


export class SessionParamsForm extends React.Component<SessionParamsFormProps, SessionParamsFormState> {
    fieldIterationIndex = 0;
    private formRef: any = React.createRef();
    private initialRenderTimer: any;

    constructor(props: any) {
        super(props)
        this.state = {
            initialized: false,
            addFormVisible: false
        }
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
        return this.props.session.getSessionParameters(false);
    }

    private togglePopover = (state: boolean) => {
        this.setState({ addFormVisible: state })
    }

    render() {
        const { initialized, addFormVisible } = this.state;
        const { session } = this.props;
        const allParams = session.getSessionParameters(false);

        return <div className="params-container">
            {initialized && <React.Fragment>
                <div className="params-header">
                    <Popover
                        content={addFormVisible ? <ParameterForm togglePopover={this.togglePopover} session={session} onChange={(key, value) => {
                            session.setSessionParameter(key, value);
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
                                        session.removeSessionParameter(key)
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
