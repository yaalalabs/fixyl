import { LM } from "src/translations/language-manager";
import React from "react";
import { ModalBox } from "src/common/Modal/ModalBox";
import "./AddMsgModal.scss";
import { FixComplexType } from "src/services/fix/FixDefs";
import { FixForm } from "../FixForm";
import { FixSession } from "src/services/fix/FixSession";
import { AutoComplete, Empty, Input } from "antd";

interface AddMsgModalProps {
    type?: "IN" | "OUT";
    editMsg?: FixComplexType;
    visible: boolean;
    closable?: boolean;
    className?: string;
    onDialogClosed: () => void;
    session: FixSession;
    onAdd: (msg: FixComplexType) => void;
}

interface AddMsgModalState {
    selectedMessage?: FixComplexType
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`scenarios.${msg}`);
}

export class AddMsgModal extends React.Component<AddMsgModalProps, AddMsgModalState> {

    constructor(props: any) {
        super(props);
        this.state = {
            selectedMessage: this.props.editMsg,
        }
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

    private onAdd = (data: any) => {
        const { selectedMessage } = this.state;
        if (selectedMessage) {
            selectedMessage.setValue(data);

            const { onAdd } = this.props;
            onAdd(selectedMessage);
        }
    }

    render() {
        const { visible, className, onDialogClosed, closable, session, editMsg, type } = this.props;
        const { selectedMessage } = this.state;

        return (
            <ModalBox
                visible={visible}
                title={editMsg ? getIntlMessage("edit_msg_title") : getIntlMessage("add_msg_title")}
                closable={closable ?? true}
                onClose={(onDialogClosed)}
                className={`modal-box add-msg-modal ${className ? className : ""}`}
                width={620}
            >
                <div className="add-msg-wrapper">
                    {!editMsg && <div className="header">
                        <AutoComplete
                            options={this.getOptions()}
                            filterOption={(inputValue, option) =>
                                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            onChange={this.onMessageSelected}
                        >
                            <Input.Search placeholder={getIntlMessage("add_new_message")} enterButton />
                        </AutoComplete>
                    </div>}
                    <div className="body">
                        {!selectedMessage && <div className="no-message-msg">
                            <Empty
                                description={getIntlMessage("no_message_selected")}>

                            </Empty>
                        </div>}
                        {selectedMessage && <FixForm enableIgnore={type === "OUT"} session={session} message={selectedMessage}
                            onSend={this.onAdd} saveMode={true} value={editMsg?.getValue()} />}
                    </div>
                </div>
            </ModalBox>)
    }
}