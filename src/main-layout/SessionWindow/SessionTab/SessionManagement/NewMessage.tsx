import { AutoComplete, Empty, Input } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { FixMessage, FixSession, FixSessionEventType } from 'src/services/fix/FixSession';
import { LM } from 'src/translations/language-manager';
import { FixForm } from './FixForm';
import './NewMessage.scss';

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`session_management.${msg}`);
}

interface NewMessageProps {
    session: FixSession;
}

interface NewMessageState {
    selectedMessage?: FixMessage;
    sending: boolean;
    connected: boolean;
}

export class NewMessage extends React.Component<NewMessageProps, NewMessageState> {
    private sessionSub?: Subscription;

    constructor(props: any) {
        super(props);
        this.state = {
            selectedMessage: undefined,
            sending: false,
            connected: this.props.session.isReady()
        }
    }

    componentDidMount() {
        this.sessionSub = this.props.session.getFixEventObservable().subscribe(eventData => {
            this.forceUpdate();
            this.setState({ connected: eventData.event !== FixSessionEventType.DISCONNECT })
        })
    }

    componentWillUnmount() {
        this.sessionSub?.unsubscribe()
    }

    private getOptions = () => {
        const { session } = this.props;
        const messages = session.getAllMessageDefs();
        return messages.map(msg => ({ value: msg.name }));
    }

    private onMessageSelected = (event: any) => {
        const { session } = this.props;
        const selectedMessage = session.createNewMessageInst(event);

        if (selectedMessage) {
            this.setState({ selectedMessage });
        }
    }

    private onSend = (data: any) => {
        const { selectedMessage } = this.state;
        selectedMessage?.setValue(data);

        if (selectedMessage) {
            this.setState({ sending: false });
            this.props.session.send(selectedMessage).then(() => {
                this.setState({ sending: false });
            }).catch(error => {
                this.setState({ sending: false });
            });
        }
    }

    render() {
        const { session } = this.props;
        const { selectedMessage, sending, connected } = this.state;

        return <div className="new-message-wrapper">
            <div className="header">
                <AutoComplete
                    options={this.getOptions()}
                    filterOption={(inputValue, option) =>
                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                    }
                    onChange={this.onMessageSelected}
                >
                    <Input.Search placeholder={getIntlMessage("add_new_message")} enterButton />
                </AutoComplete>
            </div>
            <div className="body">
                {!selectedMessage && <div className="no-message-msg">
                    <Empty
                        image={require("../../../../assets/form-maker.svg").default}
                        description={getIntlMessage("no_message_selected")}>

                    </Empty>
                </div>}
                {selectedMessage && <FixForm session={session} message={selectedMessage} disabled={sending || !connected} onSend={this.onSend} />}
            </div>
        </div>
    }
}

