import React from 'react';
import './MessageViewerManagement.scss';
import { LM } from 'src/translations/language-manager';
import { FixComplexType } from 'src/services/fix/FixDefs';
import { SOH } from 'src/services/fix/FixDefinitionParser';
import { Button, Form, Input, Select } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import { Toast } from 'src/common/Toast/Toast';
import { EyeOutlined } from '@ant-design/icons';
import { FixSession } from 'src/services/fix/FixSession';
import { FileSelect } from 'src/common/FileSelect/FileSelect';
import { FixVersion } from 'src/services/profile/ProfileDefs';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
const { Option } = Select;
const getIntlMessage = (msg: string) => {
    return LM.getMessage(`message_viewer.${msg}`);
}

interface MessageViewerManagementState {
    messages?: { msg: FixComplexType, rawMsg: string }[],
    selectedMessage?: FixComplexType;
    session?: FixSession,
    dictionaryLocation?: string,
}

export class MessageViewerManagement extends React.Component<any, MessageViewerManagementState> {
    private formRef: any = React.createRef();

    constructor(props: any) {
        super(props);
        this.state = {
            messages: undefined,
            session: undefined,
        }
    }

    private getMessageData = (data: string, fieldSeparator: string): FixComplexType | undefined => {
        const separator = fieldSeparator ?? "^";
        const processedData = data.replaceAll(separator, SOH);
        return this.state.session?.decodeFixMessage(processedData)
    }

    private onView = () => {
        const data = this.formRef.current?.getFieldsValue();
        const messages: { msg: FixComplexType, rawMsg: string }[] = [];
        data.rawMsg.split("\n").forEach((rawMsg: string) => {
            if (rawMsg) {
                const msg = this.getMessageData(rawMsg, data.fieldSeparator);
                if (!msg) {
                    Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message"))
                    return;
                }

                messages.push({ msg, rawMsg })
            }
        });


        this.setState({ messages: messages.length > 0 ? messages : undefined })
    }

    private onNewSession = (dictionaryLocation: string, fixVersion = FixVersion.FIX_4, transportDictionaryLocation?: string) => {
        const session = new FixSession({
            ip: "0.0.0.0", port: 0, dictionaryLocation, name: "temp" + Date.now(),
            fixVersion, transportDictionaryLocation,
            password: "", senderCompId: "", targetCompId: "", username: ""
        })

        this.setState({ session, dictionaryLocation })
    }


    render() {
        const { communicator } = this.props;
        const { messages, session, dictionaryLocation, selectedMessage } = this.state;

        return <div className="message-viewer-man-wrapper">
            <div className="header">
                <div className="title">{getIntlMessage("title")}</div>
            </div>
            <div className="body">
                <div className="session-wrapper">
                    <Form.Item label={getIntlMessage("profile_selection")}>
                        <Select onChange={(inst: string) => {
                            const prof = GlobalServiceRegistry.profile.getProfile(inst);
                            this.onNewSession(prof!.dictionaryLocation, prof?.fixVersion, prof?.transportDictionaryLocation);
                        }}>
                            {GlobalServiceRegistry.profile.getAllClientProfiles().map((inst, i) => {
                                return <Option value={inst.name} key={i}>{inst.name}</Option>
                            })}
                        </Select>
                    </Form.Item>

                    <FileSelect value={dictionaryLocation} label={getIntlMessage("fix_definition")} onChange={this.onNewSession} />
                </div>
                <p>{getIntlMessage("raw_msg_desc")}</p>
                <Form ref={this.formRef} initialValues={{ fieldSeparator: "^A" }} onFinish={this.onView} layout="vertical">
                    <Form.Item name="fieldSeparator" label={getIntlMessage("field_separator")} required>
                        <Input disabled={!session} />
                    </Form.Item>
                    <Form.Item name="rawMsg" label={getIntlMessage("raw_msg")} required>
                        <TextArea rows={8} disabled={!session} />
                    </Form.Item>
                    <div className="footer">
                        <Button type="primary" disabled={!session} htmlType="submit" icon={<EyeOutlined />} > {getIntlMessage("view")}
                        </Button>
                    </div>
                </Form>
                {messages && <div className="message-list-wrapper">
                    <div className="message-title">{getIntlMessage("message_title")}</div>
                    {messages.map((inst, i) => <div className={`message ${inst.msg === selectedMessage ? "selected-message" : ""}`} key={i} onClick={() => {
                        this.setState({ selectedMessage: inst.msg })
                        communicator.onMessageSelected({ def: inst.msg, session: this.state.session, rawMsg: inst.rawMsg })
                    }}>{inst.msg.name}</div>)}
                </div>}
            </div>
        </div >
    }
}