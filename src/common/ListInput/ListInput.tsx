import React, { useState } from 'react';
import { Button, Form, Input, Select } from "antd";
import "./ListInput.scss";
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { FixFieldOption } from 'src/services/fix/FixDefs';

export interface ListInputProps {
    value?: any,
    name: string,
    parent: string,
    fieldIterationIndex: number,
    required?: boolean,
    disabled?: boolean,
    options?: FixFieldOption[];
    onChange?: (data: any[]) => void,
}

const { Option } = Select;

export const ListInput = (props: ListInputProps) => {
    const { value, required, disabled, options, onChange } = props;
    const [fields, setFeilds] = useState<any[]>(value ? value : [])
    
    const add = () => {
        setFeilds([...fields, undefined])
    }

    const remove = (index: number) => {
        fields.splice(index, 1);
        setFeilds([...fields])
    }

    const setValue = (index: number, value: any) => {
        fields[index] = value;
        setFeilds([...fields])
        onChange?.(fields)
    }

    return (
        <div className="list-input-container">
            {
                fields.map((field, index) => (
                    <Form.Item
                        name={index}
                        required={required}
                    >
                        {options && <Select value={field} style={{ width: 'calc(100% - 20px)' }} onChange={(e) => setValue(index, e)}>
                            {options.map((option, i) => {
                                return <Option value={option.value} key={i}>{option.displayValue}</Option>
                            })}
                        </Select>}
                        {!options && <Input value={field} disabled={disabled} style={{ width: 'calc(100% - 20px)' }} onChange={(e) => setValue(index, e.target.value)} />}
                        {!disabled && <MinusCircleOutlined
                            className="dynamic-delete-button"
                            onClick={() => remove(index)}
                        />}
                    </Form.Item>
                ))
            }
            {
                !disabled && <Form.Item>
                    <Button
                        type="dashed"
                        onClick={() => add()}
                        icon={<PlusOutlined />}
                    >
                        Add field
                    </Button>
                </Form.Item>
            }
        </div >
    );
};

