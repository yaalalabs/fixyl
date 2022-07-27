import React from 'react';
import './MessageViewerTab.scss';
import FlexLayout, { IJsonModel } from "flexlayout-react";
import { MessageViewerManagement } from './MessageViewerManagement/MessageViewerManagement';
import { SessionMessageView } from 'src/common/SessionMessageView/SessionMessageView';

enum MessageViewerTabComponents {
  MESSAGE_VIEWER_MANAGER = "message_viewer_manager",
  MESSAGE_VIEW = "message_view"
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
        weight: 35,
        selected: 0,
        enableMaximize: true,
        children: [
          {
            type: "tab",
            component: MessageViewerTabComponents.MESSAGE_VIEWER_MANAGER,
          },
        ]
      }, {
        type: "tabset",
        weight: 55,
        selected: 0,
        enableMaximize: false,
        children: [
          {
            type: "tab",
            component: MessageViewerTabComponents.MESSAGE_VIEW,
          },
        ]
      },
    ]
  }
};


interface MessageViewerTabState {
  model: any
}

export class MessageViewerTab extends React.Component<any, MessageViewerTabState> {
  
  constructor(props: any) {
    super(props);

    this.state = {
      model: FlexLayout.Model.fromJson(MAXIMIZED_VERSION)
    };
  }


  private tabFactory = (node: any) => {
    const { communicator } = this.props;
    const comp = node.getComponent();

    switch (comp) {
      case MessageViewerTabComponents.MESSAGE_VIEWER_MANAGER:
        return <MessageViewerManagement communicator={communicator} />
      case MessageViewerTabComponents.MESSAGE_VIEW:
        return <SessionMessageView communicator={communicator} />
    }
  }

  render() {
    return <FlexLayout.Layout model={this.state.model} factory={this.tabFactory} />
  }
}

