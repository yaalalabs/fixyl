import React from 'react';
import './MessageDiffViewerTab.scss';
import FlexLayout, { IJsonModel } from "flexlayout-react";
import { MessageDiffViewerManagement } from './MessageDiffViewerManagement/MessageDiffViewerManagement';
import { DiffViewer } from './DiffView/DiffViewer';

enum MessageDiffViewerTabComponents {
  MESSAGE_VIEW = "message_view",
  DIFF_VIEW = "diff_view"
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
    children: [{
      type: "tabset",
      weight: 35,
      selected: 0,
      enableMaximize: false,
      children: [
        {
          type: "tab",
          component: MessageDiffViewerTabComponents.MESSAGE_VIEW,
        },
      ]
    },
    {
      type: "tabset",
      weight: 65,
      selected: 0,
      enableMaximize: true,
      children: [
        {
          type: "tab",
          component: MessageDiffViewerTabComponents.DIFF_VIEW,
        },
      ]
    },
    ]
  }
};


interface MessageDiffViewerTabState {
  model: any
}

export class MessageDiffViewerTab extends React.Component<any, MessageDiffViewerTabState> {

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
      case MessageDiffViewerTabComponents.MESSAGE_VIEW:
        return <MessageDiffViewerManagement communicator={communicator} />

      case MessageDiffViewerTabComponents.DIFF_VIEW:
        return <DiffViewer communicator={communicator} />
    }
  }

  render() {
    return <FlexLayout.Layout model={this.state.model} factory={this.tabFactory} />
  }
}

