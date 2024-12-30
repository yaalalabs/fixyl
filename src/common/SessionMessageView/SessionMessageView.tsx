import { MessageOutlined } from '@ant-design/icons';
import React from 'react';
import { Subscription } from 'rxjs';
import { LM } from 'src/translations/language-manager';
import { FixCommMsg, IntraTabCommunicator } from '../IntraTabCommunicator';
import { MessageView } from '../MessageView/MessageView';
import './SessionMessageView.scss';
import { BaseClientFixSession } from 'src/services/fix/FixSession';


const getIntlMessage = (msg: string, options?: any) => {
  return LM.getMessage(`session_message_view.${msg}`, options);
}

interface SessionMessageViewProps {
  session?: BaseClientFixSession;
  communicator: IntraTabCommunicator;
}

interface SessionMessageViewState {
  selectedMsg?: FixCommMsg;
}
export class SessionMessageView extends React.Component<SessionMessageViewProps, SessionMessageViewState> {
  private msgSelectSubscription?: Subscription;

  constructor(props: any) {
    super(props);
    this.state = {}
  }

  componentDidMount() {
    this.msgSelectSubscription = this.props.communicator.getMessageSelectObservable().subscribe(selectedMsg => {
      this.setState({ selectedMsg })
    })

  }

  componentDidUpdate(prevProps: Readonly<SessionMessageViewProps>, prevState: Readonly<SessionMessageViewState>, snapshot?: any): void {
    if (prevProps.session !== this.props.session) {
      this.setState({ selectedMsg: undefined })
    }
  }

  componentWillUnmount() {
    this.msgSelectSubscription?.unsubscribe();
  }

  render() {
    const { selectedMsg } = this.state;
    return <div className="session-message-view-wrapper ">
      <div className="header">
        <div className="title"><MessageOutlined />{getIntlMessage("title")}</div>
      </div>
      <div className="body">
        <MessageView selectedMsg={selectedMsg} />
      </div>
    </div>
  }
}

