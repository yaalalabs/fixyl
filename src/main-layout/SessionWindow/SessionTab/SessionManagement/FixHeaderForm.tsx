import {
    MinusCircleOutlined, PlusOutlined,
    SendOutlined
} from '@ant-design/icons';
import { Form, Button, } from 'antd';
import moment from 'moment';
import React from 'react';
import { IgnorableInput } from 'src/common/IgnorableInput/IgnorableInput';
import { Toast } from 'src/common/Toast/Toast';
import { FixComplexType, FixField, FixFieldValueFiller } from 'src/services/fix/FixDefs';
import { FixMessage, FixSession } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import "./FixHeaderForm.scss";


const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_form.${msg}`, options);
}


interface FixHeaderFormProps {
    session: FixSession;
}

interface FixHeaderFormState {
    initialized: boolean;
}


export class FixHeaderForm extends React.Component<FixHeaderFormProps, FixHeaderFormState> {
    fieldIterationIndex = 0;
    private formRef: any = React.createRef();
    private initialRenderTimer: any;

    constructor(props: any) {
        super(props)
        this.state = {
            initialized: false,
        }
    }


    componentDidMount(): void {
        this.initialRenderTimer = setTimeout(() => {
            this.setState({ initialized: true })
        }, 100)
    }

    componentWillUnmount(): void {
        clearTimeout(this.initialRenderTimer)
    }

    private getFieldValueDirect = (field: FixField, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const name = field.def.name;
        const ret: any = {};
        const properties = Object.keys(inputData)
        const filteredProperties = properties.filter(property => property.indexOf(`${namePrefix}__${name}__${fieldIterationIndex}`) > -1)
        filteredProperties.forEach(property => {
            let value = inputData[property];
            switch (field.def.type.toLowerCase()) {
                case "utctimestamp":
                case 'monthyear':
                case 'utcdateonly':
                case 'utctimeonly':
                    if (typeof value === "object") {
                        value = value?.toISOString();
                    }                        
                    break;
            }

            ret[name] = value
        })

        return ret;
    }

    private getFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        let ret: any = {};
        def.fields.forEach(field => {
            ret = { ...ret, ...this.getFieldValueDirect(field, inputData, namePrefix, fieldIterationIndex) }
        })

        return ret;
    }

    private getGroupValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const ret: any = [];
        (def.groupInstances[namePrefix] as any[])?.forEach((inst: any, index) => {
            const fieldData = this.getFieldValues(def, inputData, `${namePrefix}|G:${def.name}:${index}`, index)
            let groupData: any = {};
            def.groups.forEach(group => {
                groupData[group.name] = this.getGroupValues(group, inputData, `${namePrefix}|G:${def.name}:${index}`);
            })

            let componentData: any = {};
            def.components.forEach(comp => {
                componentData[comp.name] = this.getComponentValues(comp, inputData, `${namePrefix}|G:${def.name}:${index}`);
            })

            ret.push({ ...fieldData, ...groupData, ...componentData })
        })


        return ret;
    }

    private getComponentValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const fieldData = this.getFieldValues(def, inputData, `${namePrefix}|C:${def.name}:0`, 0)
        let groupData: any = {};
        def.groups.forEach(group => {
            groupData[group.name] = this.getGroupValues(group, inputData, `${namePrefix}|C:${def.name}:0`);
        })

        let componentData: any = {};
        def.components.forEach(comp => {
            componentData[comp.name] = this.getComponentValues(comp, inputData, `${namePrefix}|C:${def.name}:0`);
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private getMessageData = (data: any) => {
        const { session } = this.props;
        const headerFields = session.getHeaderFields();
        let out = {};
        headerFields.forEach((message) => {
            switch (message.type) {
                case "field":
                    const field = message.field as FixField;
                    const fieldData = this.getFieldValueDirect(field, data, "root", 0);
                    out = { ...out, ...fieldData };
                    break;
                case "component":
                    let componentData: any = {};
                    const comp = message.field as FixComplexType;
                    componentData[comp.name] = this.getComponentValues(comp, data, "root")
                    out = { ...out, ...componentData };
                    break;
                case "group":
                    let groupData: any = {};
                    const group = message.field as FixComplexType;
                    groupData[group.name] = this.getGroupValues(group, data, "root")
                    out = { ...out, ...groupData };
                    break;
            }

        })

        return out;
    }

    onFinished = (data: any) => {
        const { session } = this.props;
        session.profile.headerFields = this.getMessageData(data);
        const ret = GlobalServiceRegistry.profile.addOrEditProfile(session.profile);
        if (ret) {
            Toast.success(getIntlMessage("profile_saving_success_title"), getIntlMessage("profile_saving_success"))
        } else {
            Toast.error(getIntlMessage("profile_saving_failed_title"), getIntlMessage("profile_saving_failed"))
        }
    }

    private getValue = (field: FixField, inputData: any) => {
        if (!inputData) {
            return undefined;
        }

        const name = field.def.name;
        const value = inputData[name];
        if (!value) {
            return undefined;
        }

        const type = field.def.type.toLowerCase();
        switch (type) {
            case "utctimestamp":
            case "monthyear":
            case "utcdateonly":
            case "utctimeonly": {
                if (typeof value === "string" && (
                    value === FixFieldValueFiller.AUTO_GEN ||
                    value.startsWith("{set:") ||
                    value.startsWith("{get:") ||
                    value.startsWith("{incr:")
                )) {
                    return value;
                }
                const fixFormats: Record<string, string> = {
                    utctimestamp: "YYYYMMDD-HH:mm:ss.SSS",
                    monthyear: "YYYYMM",
                    utcdateonly: "YYYYMMDD",
                    utctimeonly: "HH:mm:ss.SSS",
                };
                return moment(value, [fixFormats[type], moment.ISO_8601]);
            }
            default:
                return value;
        }
    }

    private createFieldValuesDirect = (field: FixField, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const ret: any = {};
        const name = field.def.name;
        ret[`${namePrefix}__${name}__${fieldIterationIndex}`] = this.getValue(field, inputData)
        return ret;
    }

    private createFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        let ret: any = {};
        def.fields.forEach(field => {
            ret = { ...ret, ...this.createFieldValuesDirect(field, inputData, namePrefix, fieldIterationIndex) }
        })

        return ret;
    }

    private createGroupValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        let ret: any = {};
        inputData?.forEach((inst: any, index: number) => {
            const groupName = `${namePrefix}|G:${def.name}:${index}`;

            const fieldData = this.createFieldValues(def, inst, groupName, index)
            let groupData: any = {};
            def.groups.forEach(group => {
                groupData = { ...groupData, ...this.createGroupValues(group, inst?.[group.name], groupName) };
            })

            let componentData: any = {};
            def.components.forEach(comp => {
                componentData = { ...componentData, ...this.createComponentValues(comp, inst?.[comp.name], groupName) };
            })

            ret = { ...ret, ...fieldData, ...groupData, ...componentData }
        });

        def.groupInstances[namePrefix] = def.groupInstances[namePrefix] ?? (inputData ? inputData.map(() => ({})) : [])

        return ret;
    }

    private createComponentValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const fieldData = this.createFieldValues(def, inputData, `${namePrefix}|C:${def.name}:0`, 0)
        let groupData: any = {};
        def.groups.forEach(group => {
            groupData = { ...groupData, ...this.createGroupValues(group, inputData?.[group.name], `${namePrefix}|C:${def.name}:0`) };
        })

        let componentData: any = {};
        def.components.forEach(comp => {
            componentData = { ...componentData, ...this.createComponentValues(comp, inputData?.[comp.name], `${namePrefix}|C:${def.name}:0`) };
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private createFormData = (data: any) => {
        const { session } = this.props;
        const headerFields = session.getHeaderFields();
        let out = {};
        headerFields.forEach((message) => {
            switch (message.type) {
                case "field":
                    const field = message.field as FixField;
                    const fieldData = this.createFieldValuesDirect(field, data, "root", 0)
                    out = { ...out, ...fieldData };
                    break;
                case "component":
                    const comp = message.field as FixComplexType;
                    const componentData = this.createComponentValues(comp, data[comp.name], "root")
                    out = { ...out, ...componentData };
                    break;
                case "group":
                    const group = message.field as FixComplexType;
                    const groupData = this.createGroupValues(group, data[group.name], `root`)
                    out = { ...out, ...groupData };
                    break;
            }

        })

        return out;
    }

    private getInitialValues() {
        const { session } = this.props;
        const value = session.profile.headerFields;
        if (value) {
            return this.createFormData(value);
        }

        return undefined;
    }


    private getFieldRender = (field: FixField, required: boolean, parent: string, fieldIterationIndex: number) => {
        return <IgnorableInput componentProps={{ field, required, parent, fieldIterationIndex }} />
    }

    renderField = (field: FixField, level: number, fieldIterationIndex: number, parent: string) => {
        const { def } = field;
        const fieldName = `${parent}__${def.name}__${fieldIterationIndex}`;

        return <div className="fix-field-wrapper" key={fieldName} style={{ marginLeft: level * 10 }}>
            {<Form.Item name={fieldName} label={<span>{def.name}<span className="field-number">[{def.number}]</span></span>}
                rules={[{ required: field.required, message: 'Please input valid value!' }]} >
                {this.getFieldRender(field, field.required, parent, fieldIterationIndex)}
            </Form.Item>}
        </div>
    }

    renderGroups = (group: FixComplexType, level: number, fieldIterationIndex: number, parent: string) => {
        const newLevel = level++;
        if (!group.groupInstances[parent]) {
            if (group.required) {
                group.groupInstances[parent] = [{}];
            } else {
                group.groupInstances[parent] = [];
            }
        }

        const remove = (index: number) => {
            const array = group.groupInstances[parent];
            array.splice(index, 1);
            group.groupInstances[parent] = [...array];
            this.forceUpdate();
        }

        return <div className="fix-group" style={{ marginLeft: level * 10 }}>
            <div className="fix-group-title">{getIntlMessage("group", { type: `${group.name} [${group.id}]` })}
                <div className="fix-group-insert" onClick={() => {
                    group.groupInstances[parent].push({})
                    this.forceUpdate();
                }}><PlusOutlined /></div></div>
            <div className="fix-group-fields">
                {(group.groupInstances[parent] as any[])?.map((val, i) => {
                    return <div className="repitition-block" key={i}>
                        <div className="repitition-block-content">
                            {this.renderFormFields(group, newLevel, i, `${parent}|G:${group.name}:${i}`)}
                        </div>
                        <MinusCircleOutlined
                            className="dynamic-delete-button"
                            onClick={() => remove(i)}
                        />
                    </div>
                })}
            </div>
        </div>
    }

    renderComponents = (component: FixComplexType, level: number, fieldIterationIndex: number, parent: string) => {
        const newLevel = level++;
        return <div className="fix-component" style={{ marginLeft: level * 10 }} key={component.name + newLevel}>
            <div className="fix-component-title">{getIntlMessage("component", { type: component.name })}</div>
            <div className="fix-component-fields">
                {this.renderFormFields(component, newLevel, fieldIterationIndex, `${parent}|C:${component.name}:0`)}
            </div>
        </div>
    }

    private renderFormFields = (message: FixComplexType, level: number, fieldIterationIndex: number, parent: string) => {
        return message.getFieldOrder().map(inst => {
            switch (inst.type) {
                case "field":
                    const field = message.fields.get(inst.name);
                    return field && this.renderField(field, level, fieldIterationIndex, parent)
                case "component":
                    const comp = message.components.get(inst.name);
                    return comp && this.renderComponents(comp, level, fieldIterationIndex, parent)
                case "group":
                    const group = message.groups.get(inst.name);
                    return group && this.renderGroups(group, level, fieldIterationIndex, parent)
                default:
                    return null;
            }
        })
    }

    private renderHeaderFormValues = () => {
        const { session } = this.props;
        const headerFields = session.getHeaderFields();
        return headerFields.map((message) => {
            switch (message.type) {
                case "field":
                    return this.renderField(message.field as FixField, 0, 0, "root")
                case "component":
                    return this.renderComponents(message.field as FixComplexType, 0, 0, "root")
                case "group":
                    return this.renderGroups(message.field as FixComplexType, 0, 0, "root")
                default:
                    return null
            }
        })
    }

    render() {
        const { initialized } = this.state;

        return <div className="fix-header-form-container">
            {initialized && <Form ref={this.formRef} layout="horizontal" initialValues={this.getInitialValues()} labelCol={{ span: 10 }} labelAlign="left"
                onFinish={this.onFinished}>
                <div className="form-body" >
                    {this.renderHeaderFormValues()}
                </div>
                {<div className="form-footer">
                    <Button htmlType="submit" type="primary" icon={<SendOutlined />}>{getIntlMessage("save")}</Button>
                </div>}
            </Form>}
        </div>

    }

}
