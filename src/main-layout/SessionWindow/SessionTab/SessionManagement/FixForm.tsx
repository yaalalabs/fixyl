import {
    CloseOutlined, MinusCircleOutlined, PlusOutlined,
    SendOutlined, StarOutlined, DownOutlined, UpOutlined
} from '@ant-design/icons';
import { Form, Input, Button, Popover } from 'antd';
import moment from 'moment';
import React, { useRef } from 'react';
import { IgnorableInput } from 'src/common/IgnorableInput/IgnorableInput';
import { KeyboardEventDispatcher } from 'src/common/KeyboardEventDispatcher/KeyboardEventDispatcher';
import { Toast } from 'src/common/Toast/Toast';
import { FixComplexType, FixField } from 'src/services/fix/FixDefs';
import { FixMessage, FixSession } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import "./FixForm.scss";

const Mark = require("mark.js");

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_form.${msg}`, options);
}

const SaveAsForm = ({ togglePopover, onAddToFavorites, name }: {
    togglePopover: (state: boolean) => void,
    onAddToFavorites: (data: any) => void,
    name?: string
}) => {
    const formRef: any = useRef(null);

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

    return (<div className="save-as-form-container">
        <div className="header">
            <div className="close" onClick={() => togglePopover(false)}>✕</div>
        </div>
        <Form ref={formRef} layout="vertical" initialValues={{ name }} className="save-as-form"
            onFinish={(values) => { 
                onAddToFavorites(values)
                 }}>
            <div className="form-item-container">
                <Form.Item name="name" rules={[{
                    required: true,
                }]} label={getIntlMessage("name")}>
                    <Input />
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

interface FixFormProps {
    message: FixMessage;
    session: FixSession;
    hideTitle?: boolean;
    removeNonFilledFields?: boolean;
    value?: any;
    disabled?: boolean;
    viewOnly?: boolean;
    onSend?: (data: any) => void;
    name?: string;
    saveMode?: boolean;
    enableIgnore?: boolean;
    preferredFavName?: string;
}

interface FixFormState {
    initialized: boolean;
    saving: boolean;
    confirmVisible: boolean;
    searchText?: string;
    showSearch: boolean;
    markedItems: any[];
    currentMarkedIndex?: any;
}

export class FixForm extends React.Component<FixFormProps, FixFormState> {
    fieldIterationIndex = 0;
    private formRef: any = React.createRef();
    private markInstance: any;
    private martkUpdateTimeout: any;

    constructor(props: any) {
        super(props)
        this.state = {
            initialized: true,
            saving: false,
            confirmVisible: false,
            showSearch: false,
            markedItems: []
        }
    }

    componentDidUpdate(prevProp: FixFormProps) {
        if (prevProp.message !== this.props.message || prevProp.value !== this.props.value) {
            this.setState({ initialized: false })

            setTimeout(() => {
                this.setState({ initialized: true })
            }, 10)
        }
    }

    private getFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const ret: any = {};
        const properties = Object.keys(inputData)
        def.fields.forEach(field => {
            const name = field.def.name;
            const filteredProperties = properties.filter(property => property.indexOf(`${namePrefix}__${name}__${fieldIterationIndex}`) > -1)
            filteredProperties.forEach(property => {
                let value = inputData[property]
                switch (field.def.type.toLowerCase()) {
                    case "utctimestamp":
                    case 'monthyear':
                    case 'utcdateonly':
                    case 'utctimeonly':
                        value = value?.toISOString();
                        break;
                }

                ret[name] = value
            })
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
        const { message } = this.props;
        const fieldData = this.getFieldValues(message, data, "root", 0)
        let groupData: any = {};
        message.groups.forEach(group => {
            groupData[group.name] = this.getGroupValues(group, data, "root")
        })

        let componentData: any = {};
        message.components.forEach(comp => {
            componentData[comp.name] = this.getComponentValues(comp, data, "root")
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    onFinished = (data: any) => {
        const { onSend } = this.props;
        const ret = this.getMessageData(data);

        onSend?.(ret);
    }

    private onAddToFavorites = (name: string) => {
        const { session, message } = this.props;
        const data = this.formRef.current?.getFieldsValue();
        const ret = this.getMessageData(data);
        this.setState({ saving: true })

        GlobalServiceRegistry.favoriteManager.addToFavorites(session.profile, message, name, ret).then(() => {
            this.setState({ saving: false })
            Toast.success(getIntlMessage("msg_saving_success_title"), getIntlMessage("msg_saving_success", { name }))
        }).catch(error => {
            this.setState({ saving: false })
            console.log('Saving failed', error);
            Toast.error(getIntlMessage("msg_saving_failed_title"), getIntlMessage("msg_saving_failed"))
        });
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

        switch (field.def.type.toLowerCase()) {
            case "utctimestamp":
            case "monthyear":
            case "utcdateonly":
            case "utctimeonly":
                return moment(value);
            default:
                return value;
        }
    }

    private createFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const ret: any = {};
        def.fields.forEach(field => {
            const name = field.def.name;
            ret[`${namePrefix}__${name}__${fieldIterationIndex}`] = this.getValue(field, inputData)
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
        const { message } = this.props;
        const fieldData = this.createFieldValues(message, data, "root", 0)
        let groupData: any = {};
        message.groups.forEach(group => {
            groupData = { ...groupData, ...this.createGroupValues(group, data[group.name], `root`) }
        })

        let componentData: any = {};
        message.components.forEach(comp => {
            componentData = { ...componentData, ...this.createComponentValues(comp, data[comp.name], "root") }
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private getInitialValues() {
        const { session, value } = this.props;
        const { hbInterval, password } = session.profile;
        if (value) {
            return this.createFormData(value);
        }

        return {
            root__HeartBtInt__0: hbInterval,
            root__Password__0: password
        };
    }

    private togglePopover = (state: boolean) => {
        this.setState({ confirmVisible: state })
    }

    private getGetKeyEvents = () => {
        return [
            {
                keys: "Ctrl+f",
                event: () => {
                    this.setState({ showSearch: true })
                },
            },
        ];
    }

    private getFieldRender = (field: FixField, required: boolean, parent: string, fieldIterationIndex: number) => {
        const { enableIgnore } = this.props;
        return <IgnorableInput enableIgnore={enableIgnore} componentProps={{ field, required, parent, fieldIterationIndex }} />
    }

    renderField = (field: FixField, level: number, fieldIterationIndex: number, parent: string) => {
        const { def } = field;
        const fieldName = `${parent}__${def.name}__${fieldIterationIndex}`;

        if (this.props.removeNonFilledFields) {
            const initialValues = this.getInitialValues();
            if (initialValues[fieldName] === undefined) {
                return null
            }
        }

        return <div className="fix-field-wrapper" style={{ marginLeft: level * 10 }}>
            {<Form.Item name={fieldName} label={<span>{def.name}<span className="field-number">[{def.number}]</span></span>}
                rules={[{ required: field.required, message: 'Please input valid value!' }]} >
                {this.getFieldRender(field, field.required, parent, fieldIterationIndex)}
            </Form.Item>}
        </div>
    }

    renderGroups = (group: FixComplexType, level: number, parent: string) => {
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

    renderComponents = (component: FixComplexType, level: number, parent: string) => {
        const newLevel = level++;
        return <div className="fix-component" style={{ marginLeft: level * 10 }} key={component.name + newLevel}>
            <div className="fix-component-title">{getIntlMessage("component", { type: component.name })}</div>
            <div className="fix-component-fields">
                {this.renderFormFields(component, newLevel, 0, `${parent}|C:${component.name}:0`)}
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
                    return comp && this.renderComponents(comp, level, parent)
                case "group":
                    const group = message.groups.get(inst.name);
                    return group && this.renderGroups(group, level, parent)
                default:
                    return null;
            }
        })
    }

    render() {
        const { hideTitle, message, viewOnly, disabled, name, saveMode, preferredFavName } = this.props;
        const { initialized, confirmVisible, saving, showSearch, currentMarkedIndex, markedItems } = this.state;

        return <KeyboardEventDispatcher events={this.getGetKeyEvents()}>
            <div className="fix-form-container">

                {!hideTitle && <div className="form-header">
                    <div className="title">
                        {getIntlMessage("title", { type: message.name })}
                    </div>
                </div>}
                {showSearch && <div className="search-wrapper vivify fadeInTop">
                    <Input autoFocus={true} placeholder={getIntlMessage("search")} onChange={(e) => {
                        this.setState({ searchText: e.target.value, markedItems: [], currentMarkedIndex: undefined }, () => {
                            clearTimeout(this.martkUpdateTimeout);
                            const itemArray: any[] = [];

                            this.markInstance = new Mark(document.querySelector(`#search-node${name}`));
                            this.markInstance.unmark({
                                done: () => {
                                    this.markInstance.mark(this.state.searchText, {
                                        each: (data: any) => {
                                            clearTimeout(this.martkUpdateTimeout);
                                            itemArray.push(data);

                                            this.martkUpdateTimeout = setTimeout(() => {
                                                let currentMarkedIndex = undefined;
                                                if (itemArray.length > 0) {
                                                    currentMarkedIndex = 0;
                                                    itemArray[0].scrollIntoView();
                                                }

                                                this.setState({ markedItems: itemArray, currentMarkedIndex })
                                            })
                                        },
                                    });
                                }
                            });
                        });

                    }} />
                    {currentMarkedIndex !== undefined && <div className="search-selector">
                        <DownOutlined onClick={() => {
                            const markedIndex = currentMarkedIndex + 1;
                            if (markedIndex < markedItems.length) {
                                markedItems[markedIndex]?.scrollIntoView();
                                this.setState({ currentMarkedIndex: markedIndex })
                            }
                        }} />
                        <UpOutlined onClick={() => {
                            const markedIndex = currentMarkedIndex - 1;
                            if (markedIndex > -1) {
                                markedItems[markedIndex]?.scrollIntoView();
                                this.setState({ currentMarkedIndex: markedIndex })
                            }
                        }} />
                        <span className="search-selector-text">{(currentMarkedIndex + 1)}/{markedItems.length}  </span>
                    </div>}
                    <CloseOutlined onClick={() => {
                        this.setState({ showSearch: false, markedItems: [], currentMarkedIndex: undefined })
                        this.markInstance?.unmark();
                    }} />
                </div>}
                {initialized && <Form ref={this.formRef} layout="horizontal" initialValues={this.getInitialValues()} labelCol={{ span: 10 }} labelAlign="left" onFinish={this.onFinished}>
                    <div className="form-body" id={`search-node${name}`}>
                        {this.renderFormFields(message, 0, 0, "root")}
                    </div>
                    {!viewOnly && <div className="form-footer">
                        {!saveMode && <React.Fragment>
                            <Popover
                                content={<SaveAsForm togglePopover={this.togglePopover} name={preferredFavName}
                                    onAddToFavorites={(data) => { this.onAddToFavorites(data.name); }} />}
                                title={getIntlMessage("save_as").toUpperCase()}
                                placement="top"
                                visible={confirmVisible}
                            >
                                <Button type="ghost" loading={saving} icon={<StarOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add_to_fav")}</Button>
                            </Popover>

                            <Button disabled={disabled} htmlType="submit" type="primary" icon={<SendOutlined />}>{getIntlMessage("send")}</Button>
                        </React.Fragment>}
                        {saveMode && <Button disabled={disabled} htmlType="submit" type="primary" className="save-btn" icon={<SendOutlined />}>{getIntlMessage("save")}</Button>}
                    </div>}
                </Form>}
            </div>
        </KeyboardEventDispatcher>

    }

}
