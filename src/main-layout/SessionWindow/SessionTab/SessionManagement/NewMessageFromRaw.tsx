import { EditOutlined, SendOutlined, StarOutlined } from '@ant-design/icons';
import { Button, Drawer, Form, Input, Popover, Switch } from 'antd';
import React, { useRef } from 'react';
import { Subscription } from 'rxjs';
import { Toast } from 'src/common/Toast/Toast';
import { SOH } from 'src/services/fix/FixDefinitionParser';
import { FixComplexType } from 'src/services/fix/FixDefs';
import { BaseClientFixSession, FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import { FixForm } from './FixForm';
import './NewMessageFromRaw.scss';
import { LogService } from 'src/services/log-management/LogService';

const { TextArea } = Input;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`session_management.${msg}`, options);
}


const SaveAsForm = ({ togglePopover, onAddToFavorites }: {
    togglePopover: (state: boolean) => void,
    onAddToFavorites: (data: any) => void,
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
        <Form ref={formRef} layout="vertical" className="save-as-form"
            onFinish={(values) => { onAddToFavorites(values) }}>
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

interface NewMessageFromRawProps {
    session: BaseClientFixSession;
}

interface NewMessageFromRawState {
    inProgress: boolean;
    confirmVisible: boolean;
    connected: boolean;
    removeNonFilledFields: boolean,
    message?: FixComplexType,
    editVisible: boolean
}

export class NewMessageFromRaw extends React.Component<NewMessageFromRawProps, NewMessageFromRawState> {
    private sessionSub?: Subscription;
    private formRef: any = React.createRef();

    constructor(props: any) {
        super(props);
        this.state = {
            inProgress: false,
            confirmVisible: false,
            removeNonFilledFields: false,
            editVisible: false,
            connected: this.props.session.isReady(),
            message: undefined
        }
    }

    componentDidMount() {
        this.subscribeSession()
    }

    componentDidUpdate(prevProps: Readonly<NewMessageFromRawProps>, prevState: Readonly<NewMessageFromRawState>, snapshot?: any): void {
        if (prevProps.session !== this.props.session) {
            this.subscribeSession()
        }
    }


    private subscribeSession() {
        this.sessionSub?.unsubscribe();
        this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
            this.forceUpdate();
            this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT })
        })
    }

    componentWillUnmount() {
        this.sessionSub?.unsubscribe()
    }

    private onSend = (data: any) => {
        const message = this.getMessageData(data.rawMsg, data.fieldSeparator);
        if (!message) {
            Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message"))
            return;
        }

        this.setState({ inProgress: true });
        this.props.session.send(message).then(() => {
            this.setState({ inProgress: false });
        }).catch(error => {
            this.setState({ inProgress: false });
        });
    }

    private getMessageData = (data: string, fieldSeparator: string): FixComplexType | undefined => {
        const separator = fieldSeparator ?? "^";
        const processedData = data.replaceAll(separator, SOH);
        return this.props.session.decodeFixMessage(processedData)
    }

    private onAddToFavorites = (name: string) => {
        const { session } = this.props;
        const data = this.formRef.current?.getFieldsValue();
        const message = this.getMessageData(data.rawMsg, data.fieldSeparator);
        if (!message) {
            Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message"))
            return;
        }

        this.setState({ inProgress: true })
        GlobalServiceRegistry.favoriteManager.addToFavorites((session as FixSession).profile, message, name, message.getValue()).then(() => {
            this.setState({ inProgress: false })
            LogService.log('Add to favorites successful', name);
            Toast.success(getIntlMessage("msg_saving_success_title"), getIntlMessage("msg_saving_success", { name }))
        }).catch(error => {
            this.setState({ inProgress: false })
            LogService.error('Saving failed', error);
            Toast.error(getIntlMessage("msg_saving_failed_title"), getIntlMessage("msg_saving_failed"))
        });
    }

    private togglePopover = (state: boolean) => {
        this.setState({ confirmVisible: state })
    }

    private onNonFilledChanged = (removeNonFilledFields: boolean) => {
        this.setState({ removeNonFilledFields })
    }

    private onEditOpen = () => {
        const data = this.formRef.current?.getFieldsValue();
        const message = this.getMessageData(data.rawMsg, data.fieldSeparator);
        if (!message) {
            Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message"))
            return;
        }

        this.setState({ editVisible: true, message })
    }

    private onEditClose = () => {
        this.setState({ editVisible: false });

        setTimeout(() => {
            this.setState({ message: undefined })
        }, 120)
    }

    render() {
        const { session } = this.props;
        const { inProgress, connected, confirmVisible, removeNonFilledFields, message, editVisible } = this.state;

        return <div className="new-raw-message-wrapper">
            <div className="header">
                <p>{getIntlMessage("raw_msg_desc")}</p>
            </div>
            <div className="body">
                <Form ref={this.formRef} initialValues={{ fieldSeparator: "^A" }} onFinish={this.onSend} layout="vertical">
                    <Form.Item name="fieldSeparator" label={getIntlMessage("field_separator")} required>
                        <Input />
                    </Form.Item>
                    <Form.Item name="rawMsg" label={getIntlMessage("raw_msg")} required>
                        <TextArea rows={8} />
                    </Form.Item>
                    <div className="footer">
                        <Popover
                            content={<SaveAsForm togglePopover={this.togglePopover} onAddToFavorites={(data) => { this.onAddToFavorites(data.name) }} />}
                            title={getIntlMessage("save_as").toUpperCase()}
                            placement="top"
                            visible={confirmVisible}
                        >
                            <Button type="ghost" loading={inProgress} icon={<StarOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add_to_fav")}</Button>
                        </Popover>
                        <Button type="primary" loading={inProgress} icon={<EditOutlined />} disabled={!connected} onClick={this.onEditOpen}> {getIntlMessage("edit")}
                        </Button>
                        <Button type="primary" htmlType="submit" loading={inProgress} icon={<SendOutlined />} disabled={!connected}> {getIntlMessage("send")}
                        </Button>
                    </div>
                </Form>

                {message && <Drawer
                    title={<div className="edit-drawer-header">{getIntlMessage("edit_msg", { msg: message.name })}
                        <Form className="form-container">
                            <Form.Item name="switch" label={getIntlMessage("remove_non_filled_fields")} >
                                <Switch checked={removeNonFilledFields} onChange={this.onNonFilledChanged} />
                            </Form.Item>
                        </Form>
                    </div>}
                    placement="right"
                    onClose={this.onEditClose}
                    visible={editVisible}
                    getContainer={false}
                    width={420}
                    style={{ position: 'absolute' }}
                >
                    <FixForm message={message} session={session} name="fav" value={message.getValue()} hideTitle={true}
                        removeNonFilledFields={removeNonFilledFields}
                        disabled={!connected} onSend={(data) => {
                            const msg = message.clone();
                            msg.setValue(data);
                            session.send(msg)
                        }} />
                </Drawer>}
            </div>
        </div>
    }
}

