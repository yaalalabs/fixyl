import { CopyOutlined, DeleteOutlined, SendOutlined, EditOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { FixSessionEventType } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { ServerProfile } from 'src/services/profile/ProfileDefs';
import { LM } from 'src/translations/language-manager';
import './ServerProfileInstance.scss';


const getIntlMessage = (msg: string) => {
    return LM.getMessage(`server_profile_management.${msg}`);
}

interface ServerProfileInstanceProps {
    profile: ServerProfile
    onStart: (profile: ServerProfile) => void;
    onCopy: (profile: ServerProfile) => void;
    onEdit: (profile: ServerProfile) => void;
}

enum SessionState {
    STOPPED,
    STARTING,
    READY,
    DISCONNECTED
}

interface ServerProfileInstanceState {
    state: SessionState;
}

export class ServerProfileInstance extends React.Component<ServerProfileInstanceProps, ServerProfileInstanceState> {
    private sessionEventSub?: Subscription;
    private sessionSub?: Subscription;

    constructor(props: any) {
        super(props);
        const session = GlobalServiceRegistry.fix.getFixServerSession(this.props.profile);

        this.state = {
            state: session ? (session.isLive() ? SessionState.READY : SessionState.DISCONNECTED) : SessionState.STOPPED
        }
    }

    componentDidMount() {
        this.sessionEventSub = GlobalServiceRegistry.fix.getFixSessionObservable().subscribe(event => {
            const { profile, session, type } = event;

            if (profile === this.props.profile) {
                this.setState({ state: type === "new" ? SessionState.STARTING : SessionState.STOPPED });
                this.sessionSub?.unsubscribe()

                if (type === "new") {
                    this.setState({ state: session.isReady() ? SessionState.READY : SessionState.DISCONNECTED })

                    this.sessionSub = session.getFixEventObservable().subscribe(sessionEvent => {
                        if (sessionEvent.event === FixSessionEventType.DISCONNECT) {
                            this.setState({ state: SessionState.DISCONNECTED })
                        } else {
                            this.setState({ state: SessionState.READY })
                        }
                    })
                }
            }
        })
    }

    componentWillUnmount() {
        this.sessionEventSub?.unsubscribe();
        this.sessionSub?.unsubscribe();
    }

    private getField = (name: string, value: any) => {
        return <div className="field-container">
            <div className="field-name">{name}</div>
            <div className="field-value">{value ?? "-"}</div>
        </div>
    }

    private isConnected = (state: SessionState) => {
        return state !== SessionState.STOPPED && state !== SessionState.DISCONNECTED;
    }

    render() {
        const { profile } = this.props;
        const { state } = this.state;
        const copyProfile = { ...profile }

        return <div className="server-profile-wrapper">
            <div className="info-panel">
                <div className="title">{profile.name}</div>
                {this.getField(getIntlMessage("port"), profile.port)}
                {this.getField(getIntlMessage("target_comp"), profile.targetCompId)}
                {this.getField(getIntlMessage("sender_comp"), profile.senderCompId)}
                {this.getField(getIntlMessage("fix_version_selector"), profile.fixVersion)}                
            </div>
            <div className="action-panel">
                <Button disabled={this.isConnected(state)} size="small" type="ghost" className={`connect ${this.isConnected(state) ? "connect-disabled" : ""}`} icon={<SendOutlined />}
                    onClick={() => this.props.onStart(profile)}>
                    {getIntlMessage("connect")}
                </Button>
                <Button
                    size="small"
                    type="ghost"
                    className="edit"
                    icon={<EditOutlined />}
                    onClick={() => this.props.onEdit(copyProfile)}
                >
                    {getIntlMessage("edit")}
                </Button>
                <Button
                    size="small"
                    type="ghost"
                    className="copy"
                    icon={<CopyOutlined />}
                    onClick={() => this.props.onCopy(copyProfile)}
                >
                    {getIntlMessage("copy")}
                </Button>
                <Button size="small" type="ghost" className="delete" icon={<DeleteOutlined />}
                    onClick={() => GlobalServiceRegistry.profile.removeProfile(profile)}>
                    {getIntlMessage("delete")}
                </Button>
            </div>
        </div>
    }
}

