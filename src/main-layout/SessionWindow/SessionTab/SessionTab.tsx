import React from 'react';
import { BaseClientFixSession, FixSession } from 'src/services/fix/FixSession';
import './SessionTab.scss';
import FlexLayout, { IJsonModel } from "flexlayout-react";
import { SessionManagement } from './SessionManagement/SessionManagement';
import { SessoinMessageStream } from './SessoinMessageStream/SessoinMessageStream';
import { SessionMessageView } from '../../../common/SessionMessageView/SessionMessageView';
import { IntraTabCommunicator } from '../../../common/IntraTabCommunicator';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';


export enum SessionTabComponents {
  SESSION_MANAGEMENT = "session_management",
  SESSION_MESSSAGE_STREAM = "session_messsage_stream",
  SESSION_MESSAGE_VIEW = "session_message_view"
}

interface SessionTabProps {
  session: BaseClientFixSession;
  communicator: IntraTabCommunicator;
}

interface SessionTabState {
  model?: any;
}

const MAXIMIZED_VERSION: IJsonModel = {
  global: {
    splitterSize: 2,
    enableEdgeDock: false,
    tabEnableClose: false,
    tabSetEnableTabStrip: false,
  },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 25,
        selected: 0,
        enableMaximize: true,
        children: [
          {
            type: "tab",
            component: SessionTabComponents.SESSION_MANAGEMENT,
          },
        ]
      },
      {
        type: "tabset",
        weight: 35,
        selected: 0,
        enableMaximize: false,
        children: [
          {
            type: "tab",
            component: SessionTabComponents.SESSION_MESSSAGE_STREAM,
          },
        ]
      }, {
        type: "tabset",
        weight: 40,
        selected: 0,
        enableMaximize: false,
        children: [
          {
            type: "tab",
            component: SessionTabComponents.SESSION_MESSAGE_VIEW,
          },
        ]
      },
    ]
  }
};

export class SessionTab extends React.Component<SessionTabProps, SessionTabState> {

  constructor(props: any) {
    super(props);
    this.state = {
      model: FlexLayout.Model.fromJson(MAXIMIZED_VERSION)
    }
  }

  componentWillUnmount() {
    GlobalServiceRegistry.fix.destroyFixSession(this.props.session.getProfile());
  }

  private tabFactory = (node: any) => {
    const { session, communicator } = this.props;
    const comp = node.getComponent();

    switch (comp) {
      case SessionTabComponents.SESSION_MANAGEMENT:
        return <SessionManagement session={session} communicator={communicator} />
      case SessionTabComponents.SESSION_MESSSAGE_STREAM:
        return <SessoinMessageStream session={session} communicator={communicator} />
      case SessionTabComponents.SESSION_MESSAGE_VIEW:
        return <SessionMessageView session={session} communicator={communicator} />
    }
  }

  render() {
    return <FlexLayout.Layout model={this.state.model} factory={this.tabFactory} />
  }
}

