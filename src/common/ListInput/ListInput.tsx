import React from 'react';
import { Button, Form, Input } from "antd";
import "./ListInput.scss";
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

export interface ListInputProps {
    value?: any,
    name: string,
    parent: string,
    fieldIterationIndex: number,
    required?: boolean,
    disabled?: boolean,
    onChange?: (data: string) => void,
}

export const ListInput = (props: ListInputProps) => {
    const { name, parent, required, disabled, fieldIterationIndex } = props;


    return (
        <div className="list-input-container">
            <Form.List name={`${parent}__${name}__${fieldIterationIndex}`} >
                {(fields, { add, remove }, { errors }) => (
                    <>
                        {fields.map((field, index) => (
                            <Form.Item
                                required={required}
                                key={field.key}
                            >
                                <Form.Item
                                    {...field}
                                    validateTrigger={['onChange', 'onBlur']}
                                    noStyle
                                >
                                    <Input disabled={disabled} style={{ width: 'calc(100% - 20px)' }} />
                                </Form.Item>
                                {!disabled && <MinusCircleOutlined
                                    className="dynamic-delete-button"
                                    onClick={() => remove(field.name)}
                                />}
                            </Form.Item>
                        ))}
                       {!disabled && <Form.Item>
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                icon={<PlusOutlined />}
                            >
                                Add field
                            </Button>
                            <Form.ErrorList errors={errors} />
                        </Form.Item>}
                    </>
                )}
            </Form.List>
        </div>
    );
};

