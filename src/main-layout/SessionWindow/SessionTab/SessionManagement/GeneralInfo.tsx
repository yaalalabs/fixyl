import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Switch } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { Toast } from 'src/common/Toast/Toast';
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import './GeneralInfo.scss';

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`session_management.${msg}`);
}

interface GeneralInfoProps {
    session: FixSession;
}

interface GeneralInfoState {
    connected: boolean;
    hbEnabled: boolean;
    testRequestEnabled: boolean;
    connecting: boolean;
}


export class GeneralInfo extends React.Component<GeneralInfoProps, GeneralInfoState> {
    private sessionSub?: Subscription;

    constructor(props: any) {
        super(props)
        const { session } = this.props;
        this.state = {
            connected: session.isReady(),
            hbEnabled: session.isHBEnabled(),
            connecting: false,
            testRequestEnabled: session.isTestRequestEnabled()
        }

    }

    componentDidMount() {
        this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
            this.forceUpdate();
            this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT, connecting: false })
        })
    }

    componentWillUnmount() {
        this.sessionSub?.unsubscribe()
    }

    private getFieldValue(field: string, value: any) {
        return <div className="field-container">
            <div className="field-name">{field}</div>
            <div className="field-value">{value}</div>
        </div>
    }

    render() {
        const { session } = this.props;
        const { name, ip, port, senderCompId, targetCompId, } = session.profile;
        const { connected, hbEnabled, testRequestEnabled, connecting } = this.state;
        return <div className="general-info">
            <div className="header">
                {getIntlMessage("general_info_title")}
                <div className="connect-btn-wrapper">
                    {!connected && <Button loading={connecting} icon={<SendOutlined />} type="primary" onClick={() => {
                        this.setState({ connecting: true })
                        
                        session.connect().catch((err) => {
                            this.setState({ connecting: false })
                            console.log(err);
                            Toast.error(getIntlMessage("msg_connection_failed_title"), getIntlMessage("msg_connection_failed_desc"))
                        })
                    }}>{getIntlMessage("connect")}</Button>}
                    {connected && <Button className="disconnect-btn" icon={<StopOutlined />} type="ghost" onClick={() => {
                        session.disconnect();
                    }}>{getIntlMessage("disconnect")}</Button>}
                </div>
            </div>
            <div className="body">
                {this.getFieldValue(getIntlMessage("name"), name)}
                {this.getFieldValue(getIntlMessage("ip"), ip)}
                {this.getFieldValue(getIntlMessage("port"), port)}
                {this.getFieldValue(getIntlMessage("sender_comp_id"), senderCompId)}
                {this.getFieldValue(getIntlMessage("target_comp_id"), targetCompId)}
                {this.getFieldValue(getIntlMessage("connected_time"), session.getConnectedTime())}
                {this.getFieldValue(getIntlMessage("state"), connected ? <div className="connected">{getIntlMessage("connect")}</div> :
                    <div className="disconnected">{getIntlMessage("disconnect")}</div>)}

                <div className="action-container">
                    <div className="header">
                        {getIntlMessage("actions")}
                    </div>

                    {this.getFieldValue(getIntlMessage("enable_hb"), <Switch checked={hbEnabled}
                        disabled={!connected} onChange={(checked) => {
                            this.setState({ hbEnabled: checked })
                            session.enableHB(checked)
                        }} />)}
                    {this.getFieldValue(getIntlMessage("enable_test_request"), <Switch checked={testRequestEnabled}
                        disabled={!connected} onChange={(checked) => {
                            this.setState({ testRequestEnabled: checked })
                            session.enableTestRequest(checked)
                        }} />)}

                </div>
            </div>
        </div>
    }
}


