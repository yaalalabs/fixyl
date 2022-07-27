import React from 'react';
import './SessionManagement.scss';
import { Tabs } from 'antd';
import { FixSession } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { NewMessage } from './NewMessage';
import { IntraTabCommunicator } from '../../../../common/IntraTabCommunicator';
import { GeneralInfo } from './GeneralInfo';
import { Favorites } from './Favorites';
import { Scenarios } from './Scenarios/Scenarios';
import { NewMessageFromRaw } from './NewMessageFromRaw';

const { TabPane } = Tabs;

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`session_management.${msg}`);
}

interface SessionManagementProps {
  session: FixSession;
  communicator: IntraTabCommunicator;
}

export class SessionManagement extends React.Component<SessionManagementProps, any> {

  render() {
    const { session } = this.props;
    return <div className="session-management-warpper">
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

