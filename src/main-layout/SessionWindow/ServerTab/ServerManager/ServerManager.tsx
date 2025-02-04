import { Button, Empty, Form, Input, InputNumber, Select, Tooltip } from "antd";
import React, { useEffect, useState } from "react";
import { Subscription } from "rxjs";
import { FileSelect } from "src/common/FileSelect/FileSelect";
import { IntraTabCommunicator } from "src/common/IntraTabCommunicator";
import { FixServerSession } from "src/services/fix/FixServerSession";
import { BaseClientFixSession, ServerSideFixClientSession } from "src/services/fix/FixSession";
import { FixVersion, ServerProfile } from "src/services/profile/ProfileDefs";
import { ApiOutlined, PlusOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { LM } from "src/translations/language-manager";
import "./ServerManager.scss"
import { Toast } from "src/common/Toast/Toast";
import { ServerGeneralInfo } from "./ServerGeneralInfo";
import { deepCopyObject } from "src/utils/utils";
import { ServerProfileInstance } from "./ServerProfileInstance";
import { GlobalServiceRegistry } from "src/services/GlobalServiceRegistry";
import Checkbox from "antd/lib/checkbox/Checkbox";
import { ServerSideClientList } from "./ServerSideClientList";

const { Option } = Select;

const getIntlMessage = (msg: string, opt?: any) => {
    return LM.getMessage(`server.${msg}`, opt);
}

interface ServerManagerProps {
    communicator: IntraTabCommunicator,
    activeSession?: BaseClientFixSession,
    onFixSessionSelected: (session: BaseClientFixSession) => void
}

interface ServerManagerState {
    serverFixSession?: FixServerSession;
    requireTransportDic: boolean;
    isLive: boolean;
    connecting?: boolean;
    showNewForm?: boolean;
    isNewForm?: boolean;
    currentProfile?: ServerProfile;
    profiles: ServerProfile[];

}

export class ServerManager extends React.Component<ServerManagerProps, ServerManagerState> {
    private formRef: any = React.createRef();
    private sessionSub?: Subscription;
    private actionSub?: Subscription;
    private profilesSubscription?: Subscription;

    constructor(props: any) {
        super(props);
        this.state = {
            profiles: GlobalServiceRegistry.profile.getAllServerProfiles() as any,
            requireTransportDic: false,
            isLive: false
        }
    }



    componentDidMount() {
        const { profile } = GlobalServiceRegistry;
        this.subscribeToSessionCreations();
        this.profilesSubscription = profile.getProfileUpdateObservable().subscribe(() => {
            this.setState({ profiles: profile.getAllServerProfiles() as any })
        })
    }

    subscribeToServerSession(session: FixServerSession): void {
        this.sessionSub = session.getUpdateObservable().subscribe(() => {
            this.setState({ isLive: session.isLive() })
        })
    }

    private subscribeToSessionCreations() {
        this.actionSub = GlobalServiceRegistry.appManager.getSessionActionObservable().subscribe(action => {
            if (action.type === "new" && action.profile && action.profile.type === "SERVER") {
                this.onStart(action.profile as any)
                this.actionSub?.unsubscribe();
            } else if (action.type === "new" && action.metaData === "new_server") {
                this.onNewProfile()
                this.actionSub?.unsubscribe();
            }
        })
    }

    componentWillUnmount(): void {
        this.state.serverFixSession?.destroy();
        this.sessionSub?.unsubscribe();
        this.actionSub?.unsubscribe();
        this.profilesSubscription?.unsubscribe();
    }

    onNewSession = (values: any) => {
        const {
            name,
            port,
            fixVersion,
            transportDictionaryLocation,
            dictionaryLocation,
            senderCompId,
            targetCompId,
            save,
        } = values;

        const profile: ServerProfile = {
            name,
            type: "SERVER",
            transportDictionaryLocation,
            dictionaryLocation,
            port,
            fixVersion,
            senderCompId,
            targetCompId,
        }

        this.onStart(profile)

        if (save) {
            GlobalServiceRegistry.profile.addOrEditServerProfile(profile);
        }

        this.onCloseNewPanel();
    }

    private onCloseNewPanel = () => {
        this.formRef.current?.resetFields();
        this.setState({ showNewForm: false, currentProfile: undefined })
    }

    private getNewServerForm = () => {
        const { showNewForm, currentProfile, isNewForm, requireTransportDic } = this.state;
        return <div className={`new-profile-form-wrapper-${showNewForm ? "open" : "close"}`}>
            {showNewForm && <div className="server-profile-management-wrapper">
                <div className="title"><ApiOutlined />{getIntlMessage(isNewForm ? "new_profile_title" : "edit_profile_title")}</div>

                <Form ref={this.formRef} layout="vertical" className="new-profile-form" autoComplete={"off"}
                    onFinish={this.onNewSession} initialValues={currentProfile ? { ...currentProfile, save: true } : { save: true }} onValuesChange={(val) => {
                        val["fixVersion"] && this.setState({ requireTransportDic: val["fixVersion"] === FixVersion.FIX_5 })
                    }}>

                    <Form.Item name="name" label={getIntlMessage("name")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="port" label={getIntlMessage("port")} rules={[{ required: true }]}>
                        <InputNumber />
                    </Form.Item>
                    <Form.Item name="hbInterval" label={getIntlMessage("hb_interval")}>
                        <InputNumber />
                    </Form.Item>
                    <Form.Item name="senderCompId" label={getIntlMessage("sender_comp_id")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="targetCompId" label={getIntlMessage("target_comp_id")} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="fixVersion" label={getIntlMessage("fix_version_selector")} rules={[{ required: true }]}>
                        <Select >
                            <Option value={FixVersion.FIX_4}>FIX 4.x</Option>
                            <Option value={FixVersion.FIX_5}>FIX 5.x</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="dictionaryLocation" label={getIntlMessage("dictionary_location")} rules={[{ required: true }]}>
                        <FileSelect label={"Browse"} />
                    </Form.Item>
                    {requireTransportDic && <Form.Item name="transportDictionaryLocation" label={getIntlMessage("transport_dictionary_location")} rules={[{ required: true }]}>
                        <FileSelect label={"Browse"} />
                    </Form.Item>}
                    <Form.Item name="save" className="save-as-checkbox" label={getIntlMessage("save_profile")} valuePropName="checked">
                        <Checkbox></Checkbox>
                    </Form.Item>

                    <div className="footer">
                        <Button type="ghost" onClick={this.onCloseNewPanel}>{getIntlMessage("cancel")}</Button>
                        <Button type="primary" htmlType="submit">{getIntlMessage("save")}</Button>
                    </div>
                </Form>
            </div>}
        </div>
    }

    private getServerInfo = () => {
        const { serverFixSession, isLive, connecting } = this.state;

        return <div className="server-session-management-warpper">
            <div className="fix-session-connectivity">
                <div className="fix-session-title">
                    <div className={`status-indic ${isLive ? "connected" : "disconnected"}`}></div>
                    <div className="fix-session-title-text">{getIntlMessage("fix_session_connectivity", { name: serverFixSession?.profile.name })}</div>
                </div>
                <div className="connect-btn-wrapper">
                    {!isLive && <Button loading={connecting} icon={<SendOutlined />} type="primary" onClick={() => {

                        this.setState({ connecting: true });

                        serverFixSession?.connect().catch((err) => {
                            this.setState({ connecting: false })
                            console.log(err);
                            Toast.error(getIntlMessage("msg_connection_failed_title"), getIntlMessage("msg_connection_failed_desc", { error: err.message }))
                        })

                    }}>{getIntlMessage("start")}</Button>}
                    {isLive && <Button className="disconnect-btn" icon={<StopOutlined />} type="ghost" onClick={() => {
                        serverFixSession?.destroy();
                    }}>{getIntlMessage("stop")}</Button>}
                </div>
            </div>
            <div className="server-info-view">
                <ServerGeneralInfo session={serverFixSession!} />
                <ServerSideClientList serverSession={serverFixSession!} currentClientSession={this.props.activeSession}
                    onClientSelected={(session) => this.props.onFixSessionSelected(session)} />
            </div>
        </div>
    }


    private onNewProfile = () => {
        this.setState({ showNewForm: true, isNewForm: true })
    }

    private onCopy = (profile: ServerProfile) => {
        const currentProfile = deepCopyObject(profile);
        currentProfile["name"] = currentProfile["name"] + "__copy";
        this.setState({ showNewForm: true, currentProfile, isNewForm: true, requireTransportDic: profile["fixVersion"] === FixVersion.FIX_5 })
    }

    private onStart = (profile: ServerProfile) => {
        const session = new FixServerSession(profile)
        session?.connect().catch((err) => {
            this.setState({ connecting: false })
            console.log(err);
            Toast.error(getIntlMessage("msg_connection_failed_title"), getIntlMessage("msg_connection_failed_desc", { error: err.message }))
        })

        this.subscribeToServerSession(session)
        this.setState({ serverFixSession: session, isLive: session.isLive() })
    }

    private onEdit = (profile: ServerProfile) => {
        this.setState({ showNewForm: true, currentProfile: profile, isNewForm: false, requireTransportDic: profile["fixVersion"] === FixVersion.FIX_5 })
    }

    private getAllServerProfilesView = () => {
        const { profiles } = this.state;

        return <div className="all-profile-wrapper">
            {profiles.map((profile, i) => <ServerProfileInstance onStart={this.onStart} onCopy={this.onCopy} onEdit={this.onEdit} profile={profile} key={i} />)}
            {profiles.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={getIntlMessage("no_profiles")} />}
        </div >
    }


    render() {
        const { serverFixSession } = this.state;


        return <div className="server-manager-wrapper">
            <div className="header">
                <div className="title">{getIntlMessage("title")}</div>
                {!serverFixSession && <div className="actions">
                    <Tooltip placement="bottom" title={getIntlMessage("new_profile")}>
                        <Button shape="circle" icon={<PlusOutlined />} onClick={this.onNewProfile} />
                    </Tooltip>
                </div>}

            </div>
            <div className="body">
                {!serverFixSession && <div>
                    {this.getNewServerForm()}
                    {this.getAllServerProfilesView()}
                </div>}
                {serverFixSession && this.getServerInfo()}
            </div>
        </div >
    }
}