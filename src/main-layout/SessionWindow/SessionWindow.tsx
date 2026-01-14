import React, { FC, useEffect, useState } from 'react';
import './SessionWindow.scss';
import FlexLayout from "flexlayout-react";
import { FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { LauncherTab } from './LauncherTab/LauncherTab';
import { SessionTab } from './SessionTab/SessionTab';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { IntraTabCommunicator } from '../../common/IntraTabCommunicator';
import { Toast } from 'src/common/Toast/Toast';
import { MessageViewerTab } from './MessageViewerTab/MessageViewerTab';
import { MessageDiffViewerTab } from './MessageDiffViewerTab/MessageDiffViewerTab';
import { Subscription } from 'rxjs';
import { ServerTab } from './ServerTab/ServerTab';
import { ProfileWithCredentials } from 'src/services/profile/ProfileDefs';
import { LogService } from 'src/services/log-management/LogService';

export const Title: FC<{ node: any }> = ({ node }) => {
  const config: { session: FixSession } | undefined = node.getConfig();
  const name = node.getName();
  const component = node.getComponent();
  const [connected, setConnected] = useState(config?.session?.isReady());

  useEffect(() => {
    const sub = config?.session?.getFixEventObservable().subscribe((event) => {
      if (event.event === FixSessionEventType.DISCONNECT) {
        setConnected(false)
      } else {
        setConnected(true)
      }
    })
    return () => {
      sub?.unsubscribe();
    }
  }, [config])

  return (<div className="tab-title">
    <div className="name">{name}</div>
    {(!["launcher", "message_viewer", "message_diff_viewer", "server"].includes(component)) && <div className={connected ? "connected" : "disconnected"}></div>}
  </div>)
}

const getIntlMessage = (msg: string, opts?: any) => {
  return LM.getMessage(`session_window.${msg}`, opts);
}


interface SessionWindowState {
  model: any;
  allSessions: FixSession[];
}

export class SessionWindow extends React.Component<any, SessionWindowState> {
  private layoutRef = React.createRef<any>();
  private actionSub?: Subscription;

  constructor(props: any) {
    super(props);

    this.state = {
      allSessions: [],
      model: FlexLayout.Model.fromJson({
        global: {
          splitterSize: 2,
          enableEdgeDock: false,
          tabEnableClose: false,
        },
        borders: [],
        layout: {
          type: "row",
          weight: 100,
          children: [
            {
              type: "tabset",
              id: "MAIN",
              weight: 100,
              selected: 0,
              enableMaximize: false,
              children: [
                {
                  type: "tab",
                  name: getIntlMessage("lancher"),
                  component: "launcher",
                },
              ]
            }
          ]
        }
      })
    };
  }

  componentDidMount() {
    this.subscribeToSessionCreations();
  }

  componentWillUnmount(): void {
    this.actionSub?.unsubscribe();
  }

  private subscribeToSessionCreations() {
    this.actionSub = GlobalServiceRegistry.appManager.getSessionActionObservable().subscribe(action => {
      if (action.type === "new" && action.profile && action.profile.type !== "SERVER") {
        let session = GlobalServiceRegistry.fix.getFixSession(action.profile as ProfileWithCredentials);
        let hasSession = true;

        if (!session || session.isSessionDestroyed()) {
          session = GlobalServiceRegistry.fix.getNewFixSession(action.profile as ProfileWithCredentials);
          hasSession = false;
        }

        if (!hasSession) {
          session.connect().catch((err) => {
            LogService.log(err);
            Toast.error(getIntlMessage("msg_connection_failed_title"), getIntlMessage("msg_connection_failed_desc", { error: err.message }))
            LogService.error("Failed to connect to fix session", action.profile)
          })

          const communicator = new IntraTabCommunicator();
          this.setState({ allSessions: [...this.state.allSessions, session] });

          this.layoutRef.current?.addTabToTabSet("MAIN", {
            type: "tab", component: "session", enableClose: true, id: session.getProfile().name,
            name: session.getProfile().name, config: { session, communicator }
          })
        } else {
          this.state.model?.doAction(FlexLayout.Actions.selectTab(session.getProfile().name));
        }
      } else if (action.type === "message_viewer" || action.type === "message_diff_viewer") {
        const communicator = new IntraTabCommunicator();

        this.layoutRef.current?.addTabToTabSet("MAIN", {
          type: "tab", component: action.type, enableClose: true,
          name: getIntlMessage(action.type), config: { communicator }
        })
      } else if (action.type === "server") {
        const communicator = new IntraTabCommunicator();

        this.layoutRef.current?.addTabToTabSet("MAIN", {
          type: "tab", component: action.type, enableClose: true,
          name: getIntlMessage(action.type), config: { communicator }
        })
      }
    })
  }

  private tabFactory = (node: any) => {
    var component = node.getComponent();
    if (component === "launcher") {
      return <LauncherTab />
    }

    if (component === "message_viewer") {
      const config: { communicator: IntraTabCommunicator } | undefined = node.getConfig();
      if (config) {
        return <MessageViewerTab communicator={config.communicator} />
      }
    }

    if (component === "message_diff_viewer") {
      const config: { communicator: IntraTabCommunicator } | undefined = node.getConfig();
      if (config) {
        return <MessageDiffViewerTab communicator={config.communicator} />
      }
    }

    if (component === "server") {
      const config: { communicator: IntraTabCommunicator } | undefined = node.getConfig();
      if (config) {
        return <ServerTab communicator={config.communicator} />
      }
    }

    const config: { session: FixSession, communicator: IntraTabCommunicator } | undefined = node.getConfig();
    if (config) {
      return <SessionTab session={config.session} communicator={config.communicator} />
    }
  }

  private titleFactory = (node: any) => {
    return <Title node={node} />;
  }


  render() {
    return <div className="session-window">
      <FlexLayout.Layout ref={this.layoutRef} model={this.state.model} factory={this.tabFactory} titleFactory={this.titleFactory} />
    </div>
  }
}

