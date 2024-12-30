import { FixSession } from "../services/fix/FixSession";
import React, { useRef, useState } from "react";
import { Button, Form, Input, Select } from "antd";
import DatePicker from "antd/lib/date-picker";

const { Option } = Select;

enum ParamType {
    boolean = "boolean",
    utctimestamp = "utctimestamp",
    monthyear = "monthyear",
    utcdateonly = "utcdateonly",
    utctimeonly = "utctimeonly",
    string = "string"
}

const getInput = (variableType: ParamType) => {
    switch (variableType) {
        case ParamType.boolean:
            return <Select>
                <Option key={"1"} value={""}>{""}</Option>
                <Option key={"Y"} value="Y">Y</Option>
                <Option key={"N"} value="N">N</Option>
            </Select>

        case ParamType.utctimestamp:
            return <DatePicker showTime format="YYYY-MM-DD hh:mm:ss:ms" />

        case ParamType.monthyear:
            return <DatePicker picker="month" />

        case ParamType.utcdateonly:
            return <DatePicker format="YYYY-MM-DD" />

        case ParamType.utctimeonly:
            return <DatePicker picker="time" />

        default:
            return <Input />;
    }
}


const formatOutput = (variableType: ParamType, value: any) => {
    switch (variableType) {
        case ParamType.utctimestamp:
            return value?.format("YYYYMMDD-hh:mm:ss")

        case ParamType.monthyear:
            return value?.format("YYYYMM")

        case ParamType.utcdateonly:
            return value?.format("YYYYMMDD")

        case ParamType.utctimeonly:
            return value?.format("hh:mm:ss")

        default:
            return value;
    }
}



export const ParameterForm = ({ onChange, session, togglePopover, messageFunc }: {
    onChange: (key: string, value: any) => void,
    togglePopover: (state: boolean) => void,
    session?: FixSession,
    messageFunc: (msg: string, options?: any) => string,
}) => {
    const formRef: any = useRef(null);
    const [variableType, setVariableType] = useState<ParamType>(ParamType.string)

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
                    <Option key={ParamType.string} value={ParamType.string}>String</Option>
                    <Option key={ParamType.boolean} value={ParamType.boolean}>Boolean</Option>
                    <Option key={ParamType.utctimestamp} value={ParamType.utctimestamp}>Timestamp</Option>
                    <Option key={ParamType.monthyear} value={ParamType.monthyear}>Month Year</Option>
                    <Option key={ParamType.utcdateonly} value={ParamType.utcdateonly}>UTC Date Only</Option>
                    <Option key={ParamType.utctimeonly} value={ParamType.utctimeonly}>UTC Time Only</Option>
                </Select>
            </Form.Item>
        </div>
        <Form ref={formRef} initialValues={{ state: session?.profile.autoLoginEnabled, loginMsg: session?.profile.autoLoginMsg }} layout="vertical" className="save-as-form"
            onFinish={(values) => { onChange(values.key, formatOutput(variableType, values.value)) }}>
            <div className="form-item-container">
                <Form.Item name="key" rules={[{
                    required: true,
                }]} label={messageFunc("key")}>
                    <Input />
                </Form.Item>

                <Form.Item name="value" rules={[{
                    required: true,
                }]} label={messageFunc("value")}>
                    {getInput(variableType)}
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