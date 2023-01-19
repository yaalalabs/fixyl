import React from 'react';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { Toast } from 'src/common/Toast/Toast';
import './SessionManagement.scss';
import { Tabs, Button } from 'antd';
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { NewMessage } from './NewMessage';
import { IntraTabCommunicator } from '../../../../common/IntraTabCommunicator';
import { GeneralInfo } from './GeneralInfo';
import { Favorites } from './Favorites';
import { Scenarios } from './Scenarios/Scenarios';
import { NewMessageFromRaw } from './NewMessageFromRaw';
import { Subscription } from 'rxjs';

const { TabPane } = Tabs;

const getIntlMessage = (msg: string, opt?: any) => {
  return LM.getMessage(`session_management.${msg}`, opt);
}

interface SessionManagementProps {
  session: FixSession;
  communicator: IntraTabCommunicator;
}

interface SessionManagementoState {
  connected: boolean;
  connecting: boolean;
}

export class SessionManagement extends React.Component<SessionManagementProps, SessionManagementoState> {
  private sessionSub?: Subscription;

  constructor(props: any) {
    super(props)
    const { session } = this.props;
    this.state = {
      connected: session.isReady(),
      connecting: false,
    }
  }

  componentDidMount() {
    this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
      this.forceUpdate();
      this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT, connecting: false })
    })
  }

  componentWillUnmount() {
    this.sessionSub?.unsubscribe();
  }

  render() {
    const { session } = this.props;
    const { connected, connecting } = this.state;

    return <div className="session-management-warpper">
      <div className="fix-session-connectivity">
        <div className="fix-session-title">
          <div className={`status-indic ${connected ? "connected" : "disconnected"}`}></div>
          <div className="fix-session-title-text">{getIntlMessage("fix_session_connectivity", { name: session.profile.name })}</div>
        </div>
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
      <div className="tab-view">
        <Tabs defaultActiveKey="0">
          <TabPane tab={getIntlMessage("general")} key="0">
            <GeneralInfo session={session} />
          </TabPane>
          <TabPane tab={getIntlMessage("new_msg")} key="1">
            <NewMessage session={session} />
          </TabPane>
          <TabPane tab={getIntlMessage("new_msg_from_raw_data")} key="2">
            <NewMessageFromRaw session={session} />
          </TabPane>
          <TabPane tab={getIntlMessage("favorites")} key="3">
            <Favorites session={session} />
          </TabPane>
          <TabPane tab={getIntlMessage("scenarios")} key="4">
            <Scenarios session={session} />
          </TabPane>
        </Tabs>
      </div>
    </div>
  }
}

