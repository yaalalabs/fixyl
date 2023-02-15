import React, { useState } from 'react';
import { Tooltip } from "antd";
import "./IgnorableInput.scss";
import { LM } from 'src/translations/language-manager';
import { LogoutOutlined, RollbackOutlined } from '@ant-design/icons';
import { FixField } from 'src/services/fix/FixDefs';
import { Select, Input, } from 'antd';
import { ListInput } from '../ListInput/ListInput';
import { FieldWrapper } from './FieldWrapper/FieldWrapper';
import { DatePicker, } from 'antd';


const { Option } = Select


const FieldRenderEx = ({ value, field, required, parent, fieldIterationIndex, onChange, }:
    { value: any, field: FixField, required: boolean, parent: string, fieldIterationIndex: number, onChange: (value: any) => void }) => {
    const [inputValue, setValue] = useState(value ? value : "");

    const onChangeEx = (value: any) => {
        setValue(value);
        onChange(value)
    }

    const { def } = field;
    if (def.options && def.type.toLowerCase() !== "multiplecharvalue") {
        return <FieldWrapper onChange={onChangeEx} value={inputValue} disableAutogen ><Select onChange={onChangeEx} value={inputValue}>
            {def.options.map((option, i) => {
                return <Option value={option.value} key={i}>{option.displayValue}</Option>
            })}
        </Select>
        </FieldWrapper>
    }


    switch (def.type.toLowerCase()) {
        case "boolean":
            let ret = inputValue;
            if (typeof inputValue === "boolean") {
                ret = inputValue ? "Y" : "N"
            }

            return <FieldWrapper onChange={onChangeEx} value={inputValue} disableAutogen > <Select onChange={onChangeEx} value={ret} >
                <Option key={"1"} value={""}>{""}</Option>
                <Option key={"Y"} value="Y">Y</Option>
                <Option key={"N"} value="N">N</Option>
            </Select>
            </FieldWrapper>
        case "utctimestamp":
            return <FieldWrapper onChange={onChangeEx} value={inputValue} >
                <DatePicker onChange={onChangeEx} showTime format="YYYY-MM-DD hh:mm:ss:ms" value={inputValue} />
            </FieldWrapper>
        case "multiplecharvalue":
        case "multiplevaluestring":
            return <ListInput onChange={onChangeEx} name={def.name} parent={parent} options={def.options}
                required={required} fieldIterationIndex={fieldIterationIndex} value={inputValue} />
        case "monthyear":
            return <FieldWrapper onChange={onChangeEx} value={inputValue} >
                <DatePicker onChange={onChangeEx} picker="month" value={inputValue} />
            </FieldWrapper>
        case "utcdateonly":
            return <FieldWrapper onChange={onChangeEx} value={inputValue} >
                <DatePicker onChange={onChangeEx} format="YYYY-MM-DD" value={inputValue} />
            </FieldWrapper>
        case "utctimeonly":
            return <FieldWrapper onChange={onChangeEx} value={inputValue} >
                <DatePicker picker="time" onChange={onChangeEx} value={inputValue} />
            </FieldWrapper>
    }

    return <FieldWrapper onChange={onChangeEx} value={inputValue} >
        <Input onChange={(event) => onChangeEx(event.target.value)} value={inputValue} />
    </FieldWrapper>
}

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`ignore_input.${msg}`, options);
}

export interface IgnorableInputProps {
    value?: any;
    componentProps: any;
    enableIgnore?: boolean;
    onChange?: (data: string) => void,
}

export const IgnorableInput = ({ enableIgnore, componentProps, onChange, value }: IgnorableInputProps) => {
    const [ignored, setIgnore] = useState(value === "{ignore}")

    if (!enableIgnore) {
        return <FieldRenderEx {...{ value, onChange, ...componentProps }} />
    }

    return (
        <div className="ignorable-input-container">
            {!ignored && <React.Fragment>
                <Tooltip title={getIntlMessage("ignore")}>
                    <div onClick={() => {
                        setIgnore(true)
                        onChange?.("{ignore}")
                    }} className="ignore-btn"><LogoutOutlined /></div>
                </Tooltip>
                {<FieldRenderEx {...{ value, onChange, ...componentProps }} />}
            </React.Fragment>}
            {ignored && <React.Fragment><Tooltip title={getIntlMessage("stop_ignore")}>
                <div onClick={() => {
                    setIgnore(false)
                    onChange?.("")
                }} className="ignore-btn"><RollbackOutlined /></div>
            </Tooltip>
                <div className="ignore-msg">{getIntlMessage("ignored_msg")}</div>

            </React.Fragment>}
        </div>
    );
};

