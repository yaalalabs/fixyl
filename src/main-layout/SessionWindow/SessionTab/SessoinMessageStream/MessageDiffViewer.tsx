import { LM } from "src/translations/language-manager";
import React from "react";
import { ModalBox } from "src/common/Modal/ModalBox";
import ReactDiffViewer from 'react-diff-viewer';
import "./MessageDiffViewer.scss";
import { FixCommMsg } from "src/common/IntraTabCommunicator";
import { MessageView } from "src/common/MessageView/MessageView";

interface MessageDiffViewerProps {
    visible: boolean;
    closable?: boolean;
    className?: string;
    onDialogClosed: () => void;
    msg1?: string;
    msg2?: string;
    sideBySide?: boolean;
    msgObj1?: FixCommMsg;
    msgObj2?: FixCommMsg;
}

interface MessageDiffViewerState {
    path?: string
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`session_message_stream.${msg}`);
}

export class MessageDiffViewer extends React.Component<MessageDiffViewerProps, MessageDiffViewerState> {

    render() {
        const { visible, className, onDialogClosed, closable, msg1, msg2, sideBySide, msgObj1, msgObj2 } = this.props;
        return (
            <ModalBox
                visible={visible}
                title={sideBySide ? getIntlMessage("side_by_side") : getIntlMessage("diff_title")}
                closable={closable ?? true}
                onClose={(onDialogClosed)}
                className={`modal-box diff-viewer-modal ${className ? className : ""}`}
                width={sideBySide ? "80vw" : 820}
            >
                {!sideBySide && <div className="diff-view-wrapper">
                    <ReactDiffViewer oldValue={msg1} newValue={msg2} useDarkTheme={true} showDiffOnly={false} />
                </div>}
                {sideBySide && <div className="side-by-side-wrapper">
                    <MessageView selectedMsg={msgObj1} hideRawMsg />
                    <MessageView selectedMsg={msgObj2} hideRawMsg />
                </div>}
            </ModalBox>)
    }
}