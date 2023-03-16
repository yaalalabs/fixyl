import { Switch, Form, Button, Popover, Select } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import React, { useEffect, useRef, useState } from 'react';
import { Subscription } from 'rxjs';
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { FixHeaderForm } from './FixHeaderForm';
import './GeneralInfo.scss';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { makeCancelable } from 'src/utils/utils';
import { SessionParamsForm } from './SessionParamsForm';

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`session_management.${msg}`);
}

const AutoLoginForm = ({ onChange, session, togglePopover }: {
    onChange: (state: boolean, loginMsg: any) => void,
    togglePopover: (state: boolean) => void,
    session: FixSession
}) => {
    const formRef: any = useRef(null);
    const [favorites, setFavorites] = useState([]);

    useEffect(() => {
        let favPromise = makeCancelable(GlobalServiceRegistry.favoriteManager.getAllFavorites(session));
        favPromise.promise.then((favorites: any) => {
            setFavorites(favorites);
        }).catch((error: any) => {
            if (error.isCanceled) {
                return;
            }
            console.log("Failed to load favorites")
        })

        return () => {
            favPromise.cancel();
        }
    }, [session]);



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
        <Form ref={formRef} initialValues={{ state: session.profile.autoLoginEnabled, loginMsg: session.profile.autoLoginMsg }} layout="vertical" className="save-as-form"
            onFinish={(values) => { onChange(values.state, values.loginMsg) }}>
            <div className="form-item-container">
                <Form.Item valuePropName="checked" name="state" rules={[{
                    required: true,
                }]} label={getIntlMessage("enable_auto_login")}>
                    <Switch />
                </Form.Item>
                <Form.Item name="loginMsg" rules={[{
                    required: true,
                }]} label={getIntlMessage("auto_login_msg")}>
                    <Select options={favorites.filter(({ msg }: any) => msg.name === "Logon").map(({ name }) => {
                        return { value: name }
                    })} />
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


interface GeneralInfoProps {
    session: FixSession;
}

interface GeneralInfoState {
    connected: boolean;
    hbEnabled: boolean;
    testRequestEnabled: boolean;
    sequenceResetRequestEnabled: boolean;
    resendRequestEnabled: boolean;
    autoLoginEnabled: boolean;
    connecting: boolean;
    showHeaderFields: boolean;
    showSessionParams: boolean;
    autoLoginFormVisible: boolean;
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
            showSessionParams: false,
            resendRequestEnabled: session.isResendRequestEnabled(),
            sequenceResetRequestEnabled: session.isSequenceResetRequestEnabled(),
            testRequestEnabled: session.isTestRequestEnabled(),
            autoLoginEnabled: session.isAutoLoginEnabled(),
            autoLoginFormVisible: false
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
        this.setState({ showHeaderFields: !this.state.showHeaderFields, showSessionParams: false })
    }

    private toggleSessionParams = () => {
        this.setState({ showSessionParams: !this.state.showSessionParams, showHeaderFields: false })
    }

    private autoLoginField = () => {
    }

    private togglePopover = (state: boolean) => {
        this.setState({ autoLoginFormVisible: state })
    }

    render() {
        const { session } = this.props;
        const { name, ip, port, senderCompId, targetCompId, } = session.profile;
        const { connected, hbEnabled, testRequestEnabled, showHeaderFields, showSessionParams,
            resendRequestEnabled, autoLoginEnabled, autoLoginFormVisible } = this.state;

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
                    {/* {this.getFieldValue(getIntlMessage("enable_seq_rest_request"), <Switch checked={sequenceResetRequestEnabled}
                        disabled={!connected} onChange={(checked) => {
                            this.setState({ sequenceResetRequestEnabled: checked })
                            session.enableSequenceResetRequest(checked)
                        }} />)} */}
                    {this.getFieldValue(getIntlMessage("enable_resend_request"), <Switch checked={resendRequestEnabled}
                        disabled={!connected} onChange={(checked) => {
                            this.setState({ resendRequestEnabled: checked })
                            session.enableResendRequest(checked)
                        }} />)}
                    {this.getFieldValue(getIntlMessage("enable_auto_login"),
                        <Popover
                            content={<AutoLoginForm togglePopover={this.togglePopover} session={session} onChange={(checked, loginMsg) => {
                                this.setState({ autoLoginEnabled: checked })
                                session.enableAutoLogin(checked, loginMsg)
                            }} />}
                            title={getIntlMessage("enable_auto_login").toUpperCase()}
                            placement="top"
                            visible={autoLoginFormVisible}
                        >
                            <div onClick={() => this.togglePopover(true)}>
                                <Switch checked={autoLoginEnabled} />
                            </div>
                        </Popover>
                    )}

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
            <div className='header-field-title' onClick={this.toggleSessionParams}>
                <span>{getIntlMessage("session_params")} </span>
                <div className="icon-container">
                    <RightOutlined className={showSessionParams ? "rotate-90" : "rotate-0"} />
                </div>
            </div>
            <div className={`header-field-body vivify ${showSessionParams ? "fadeIn" : "fadeOut header-body-hide"}`}>
                {<SessionParamsForm session={session} />}
            </div>
        </div>
    }
}


