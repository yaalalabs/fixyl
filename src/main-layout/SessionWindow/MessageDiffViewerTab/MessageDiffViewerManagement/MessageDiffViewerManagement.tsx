import React from 'react';
import './MessageDiffViewerManagement.scss';
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
const getIntlMessage = (msg: string, opt?: any) => {
    return LM.getMessage(`message_diff_viewer.${msg}`, opt);
}

interface MessageDiffViewerManagementState {
    message1?: { msg: FixComplexType, rawMsg: string }[],
    message2?: { msg: FixComplexType, rawMsg: string }[],
    session?: FixSession,
    dictionaryLocation?: string,
}

export class MessageDiffViewerManagement extends React.Component<any, MessageDiffViewerManagementState> {
    private formRef: any = React.createRef();

    constructor(props: any) {
        super(props);
        this.state = {
            session: undefined,
        }
    }

    private getMessageData = (data: string, fieldSeparator: string): FixComplexType | undefined => {
        const separator = fieldSeparator ?? "^";
        const processedData = data.replaceAll(separator, SOH);
        return this.state.session?.decodeFixMessage(processedData)
    }

    private validateInputValues(expectedValues: any, receviedValues: any): boolean {
        let ret = expectedValues;

        if (!(expectedValues instanceof Object) || !(receviedValues instanceof Object)) return ret;

        if (expectedValues.constructor !== receviedValues.constructor) return ret;


        for (var p in expectedValues) {
            if (!expectedValues.hasOwnProperty(p)) continue;

            if (!receviedValues.hasOwnProperty(p)) return ret;

            // eslint-disable-next-line
            if (expectedValues[p] == receviedValues[p]) continue;

            if (typeof expectedValues[p] === "boolean") {
                if (receviedValues[p] === "Y" || receviedValues[p] === "N") {
                    continue
                }
            }

            if (!expectedValues[p]) {
                continue;
            }

            if (typeof expectedValues[p] === "string" && expectedValues[p].trim() === "{ignore}") {
                ret[p] = receviedValues[p]
                continue;
            }
            

            const getRegex = /\${(.*?)}/g;
            const match = getRegex.exec(expectedValues[p]);
            if (match) {
                const regx = new RegExp(match[1].trim())
                const receivedMatch = regx.exec(receviedValues[p]);
                if (receivedMatch) {
                    ret[p] = receviedValues[p]
                }
                continue;
            }

            if (typeof (expectedValues[p]) !== "object") return ret;

            if (!this.validateInputValues(expectedValues[p], receviedValues[p])) return ret;
        }


        return ret;
    }

    private compareObjects = (msg1: any, msg2: any): { retMsg1: any, retMsg2: any } => {
        const retMsg1 = this.validateInputValues(msg1, msg2);

        return { retMsg1, retMsg2: msg2 }
    }

    private onView = () => {
        const data = this.formRef.current?.getFieldsValue();
        const { rawMsg1, rawMsg2 } = data;

        const message1 = this.getMessageData(rawMsg1, data.fieldSeparator);
        if (!message1) {
            Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message", { msg: getIntlMessage("raw_msg_1") }))
            return;
        }

        const message2 = this.getMessageData(rawMsg2, data.fieldSeparator);
        if (!message2) {
            Toast.error(getIntlMessage("msg_invalid_message_title"), getIntlMessage("msg_invalid_message", { msg: getIntlMessage("raw_msg_2") }))
            return;
        }

        const { retMsg1, retMsg2 } = this.compareObjects(message1.getValueWithHeaders(), message2.getValueWithHeaders())
        this.props.communicator.onMessageSelected({
            def: message1, session: this.state.session, rawMsg: "", metaData: {
                diff: {
                    msg1: JSON.stringify(retMsg1, null, 2),
                    msg2: JSON.stringify(retMsg2, null, 2)
                }
            }
        })
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
        const { session, dictionaryLocation, } = this.state;

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
                            {GlobalServiceRegistry.profile.getAllProfiles().map(inst => {
                                return <Option value={inst.name} >{inst.name}</Option>
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
                    <Form.Item name="rawMsg1" label={getIntlMessage("raw_msg_1")} required>
                        <TextArea rows={8} disabled={!session} />
                    </Form.Item>
                    <Form.Item name="rawMsg2" label={getIntlMessage("raw_msg_2")} required>
                        <TextArea rows={8} disabled={!session} />
                    </Form.Item>
                    <div className="footer">
                        <Button type="primary" disabled={!session} htmlType="submit" icon={<EyeOutlined />} > {getIntlMessage("view")}
                        </Button>
                    </div>
                </Form>
            </div>
        </div >
    }
}