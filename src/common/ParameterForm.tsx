import {FixSession} from "../services/fix/FixSession";
import React, {useRef, useState} from "react";
import {Button, Form, Input, Select} from "antd";
import DatePicker from "antd/lib/date-picker";

const { Option } = Select;

export const ParameterForm = ({ onChange, session, togglePopover, messageFunc }: {
    onChange: (key: string, value: any) => void,
    togglePopover: (state: boolean) => void,
    session?: FixSession,
    messageFunc: (msg: string, options?: any) => string,
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
            <Form.Item label={messageFunc("select_type")} labelCol={{ span: 24 }}>
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
                }]} label={messageFunc("key")}>
                    <Input />
                </Form.Item>

                <Form.Item name="value" rules={[{
                    required: true,
                }]} label={messageFunc("value")}>
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
                    {messageFunc("save").toUpperCase()}
                </Button>
            </div>
        </Form>
    </div>);
}