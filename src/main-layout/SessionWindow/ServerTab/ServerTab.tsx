import React from 'react';
import './ServerTab.scss';
import FlexLayout, { IJsonModel } from "flexlayout-react";
import { SessionMessageView } from 'src/common/SessionMessageView/SessionMessageView';
import { SessionTab } from '../SessionTab/SessionTab';
import { BaseClientFixSession, FixSession } from 'src/services/fix/FixSession';
import { ServerManager } from './ServerManager/ServerManager';

enum ServerTabComponents {
  SERVER_MANAGER = "server_manager",
  SESSION_VIEW = "session_view"
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
        weight: 20,
        selected: 0,
        enableMaximize: true,
        children: [
          {
            type: "tab",
            component: ServerTabComponents.SERVER_MANAGER,
          },
        ]
      }, {
        type: "tabset",
        weight: 80,
        selected: 0,
        enableMaximize: false,
        children: [
          {
            type: "tab",
            component: ServerTabComponents.SESSION_VIEW,
          },
        ]
      },
    ]
  }
};


interface ServerTabState {
  model: any;
  activeFixSession?: BaseClientFixSession;
}

export class ServerTab extends React.Component<any, ServerTabState> {

  constructor(props: any) {
    super(props);

    this.state = {
      model: FlexLayout.Model.fromJson(MAXIMIZED_VERSION)
    };
  }


  private tabFactory = (node: any) => {
    const { communicator } = this.props;
    const { activeFixSession } = this.state;
    const comp = node.getComponent();

    switch (comp) {
      case ServerTabComponents.SERVER_MANAGER:
        return <ServerManager communicator={communicator} onFixSessionSelected={activeFixSession => this.setState({ activeFixSession })}
          activeSession={activeFixSession} />
      case ServerTabComponents.SESSION_VIEW:
        return activeFixSession ? <SessionTab session={activeFixSession} communicator={communicator} /> : <div></div>
    }
  }

  render() {
    return <FlexLayout.Layout model={this.state.model} factory={this.tabFactory} />
  }
}

