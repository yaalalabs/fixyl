import React from 'react';
import { Popover, Radio, Space, Input, Button } from "antd";
import "./FieldWrapper.scss";
import { LM } from 'src/translations/language-manager';
import { MoreOutlined, FormOutlined } from '@ant-design/icons';
import { FixFieldValueFiller } from 'src/services/fix/FixDefs';

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`field_input_wrapper.${msg}`, options);
}

const PrefixedInput = ({ disabled, prefix, onChange, valueRegx, value, title }: {
    disabled: boolean,
    title: string,
    value: any,
    prefix: string,
    onChange: (value: any) => void,
    valueRegx: RegExp
}) => {
    let newValue = "";
    const match = valueRegx.exec(value);
    if (match) {
        newValue = match[1].trim();
    }

    if (disabled) {
        return <div>{title}</div>;
    }

    return <Input disabled={disabled} addonBefore={prefix} suffix="}" onChange={(e) => {
        const inputValue = e.target.value;
        if (!inputValue) {
            return onChange(undefined)
        }
        onChange(prefix + inputValue + "}")
    }} defaultValue={newValue} />
}

const SET_REGEX = /{set:(.*?)}/g;
const SET_PREFIX = "{set:";
const GET_REGEX = /{get:(.*?)}/g;
const GET_PREFIX = "{get:";
const INCR_REGEX = /{incr:(.*?)}/g;
const INCR_PREFIX = "{incr:";

interface DatePrickerProps {
    onChange: (value: any) => void;
    disableAutogen?: boolean;
    value: any;
}

interface DatePrickerState {
    customActionVisible: boolean;
    currentAction: string;
}

export class FieldWrapper extends React.Component<DatePrickerProps, DatePrickerState> {
    constructor(props: DatePrickerProps) {
        super(props);
        this.state = {
            customActionVisible: false,
            currentAction: this.dereiveValue(props.value)
        };
    }

    componentDidUpdate(prevProps: Readonly<DatePrickerProps>, prevState: Readonly<DatePrickerState>, snapshot?: any): void {
        if (this.props.value && prevProps.value !== this.props.value) {
            const currentAction = this.dereiveValue(this.props.value)
            if (currentAction && currentAction !== this.state.currentAction) {
                this.setState({ currentAction, customActionVisible: true })
            }
        }
    }

    private dereiveValue = (value: string) => {
        if (value === FixFieldValueFiller.AUTO_GEN) {
            return FixFieldValueFiller.AUTO_GEN;
        } else if (typeof value === "string") {
            if (value.startsWith(GET_PREFIX)) {
                return GET_PREFIX;
            } else if (value.startsWith(SET_PREFIX)) {
                return SET_PREFIX;
            } else if (value.startsWith(INCR_PREFIX)) {
                return INCR_PREFIX;
            }
        }

        return "";
    }

    private getMenu = () => {
        const { onChange, value, disableAutogen } = this.props;
        const { currentAction } = this.state;

        return <div className="custom-action-menu-wrapper">
            <Radio.Group value={currentAction} onChange={e => this.setState({ currentAction: e.target.value })}>
                <Space direction="vertical">
                    {!disableAutogen && <Radio value={FixFieldValueFiller.AUTO_GEN} onClick={() => onChange(FixFieldValueFiller.AUTO_GEN)}>
                        <div className="custom-action-btn"><FormOutlined /> {getIntlMessage("auto_gen")}</div>
                    </Radio>}
                    <Radio value={GET_PREFIX} onClick={() => onChange(undefined)}>
                        <PrefixedInput disabled={currentAction !== GET_PREFIX} title={getIntlMessage("get")}
                            prefix={GET_PREFIX} onChange={onChange} value={value} valueRegx={GET_REGEX} />
                    </Radio>
                    <Radio value={SET_PREFIX} onClick={() => onChange(undefined)}>
                        <PrefixedInput disabled={currentAction !== SET_PREFIX} title={getIntlMessage("set")}
                            prefix={SET_PREFIX} onChange={onChange} value={value} valueRegx={SET_REGEX} />
                    </Radio>
                    <Radio value={INCR_PREFIX} onClick={() => onChange(undefined)}>
                        <PrefixedInput disabled={currentAction !== INCR_PREFIX} title={getIntlMessage("incr")}
                            prefix={INCR_PREFIX} onChange={onChange} value={value} valueRegx={INCR_REGEX} />
                    </Radio>
                </Space>
            </Radio.Group>
            <Button type="primary" disabled={!value} className="clear-btn" onClick={() => {
                onChange(undefined);
                this.setState({ currentAction: "" })
            }}> {getIntlMessage("clear")}
            </Button>
        </div>
    }

    private isCustomValue = () => {
        const { value, } = this.props;
        return value === FixFieldValueFiller.AUTO_GEN || (typeof value === "string" && (value.startsWith(SET_PREFIX)
            || value.startsWith(GET_PREFIX) || value.startsWith(INCR_PREFIX)));
    }

    render() {
        const { value, children } = this.props;
        const { customActionVisible } = this.state;
        const isCustomValue = this.isCustomValue();

        return (
            <div className="field-wrapper">
                <Popover
                    content={this.getMenu()}
                    placement="top"
                    onVisibleChange={e => this.setState({ customActionVisible: e })}
                    visible={customActionVisible}
                    overlayClassName="custom-action-overlay"
                >
                    <div className="custom-btn" ><MoreOutlined /></div>
                </Popover>

                {isCustomValue && <div className="custom-field">{value}</div>}
                {!isCustomValue && children}
            </div>
        );
    }
}