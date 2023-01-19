import { Switch } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import React from 'react';
import { Subscription } from 'rxjs';
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { FixHeaderForm } from './FixHeaderForm';
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
    showHeaderFields: boolean;
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
            showHeaderFields: false,
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

    private toggleHeaderFields = () => {
        this.setState({ showHeaderFields: !this.state.showHeaderFields })
    }

    render() {
        const { session } = this.props;
        const { name, ip, port, senderCompId, targetCompId, } = session.profile;
        const { connected, hbEnabled, testRequestEnabled, showHeaderFields } = this.state;
        return <div className="general-info">
            <div className="header">
                {getIntlMessage("general_info_title")}
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
            <div className='header-field-title' onClick={this.toggleHeaderFields}>
                <span>{getIntlMessage("header_fields")} </span>
                <div className="icon-container">
                    <RightOutlined className={showHeaderFields ? "rotate-90" : "rotate-0"} />
                </div>
            </div>
            <div className={`header-field-body vivify ${showHeaderFields ? "fadeIn" : "fadeOut header-body-hide"}`}>
                {<FixHeaderForm session={session} />}
            </div>
        </div>
    }
}


