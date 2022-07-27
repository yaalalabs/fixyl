import { LM } from "src/translations/language-manager";
import React from "react";
import { ModalBox } from "src/common/Modal/ModalBox";
import ReactDiffViewer from 'react-diff-viewer';
import "./MessageDiffViewer.scss";

interface MessageDiffViewerProps {
    visible: boolean;
    closable?: boolean;
    className?: string;
    onDialogClosed: () => void;
    msg1: string;
    msg2: string;
}

interface MessageDiffViewerState {
    path?: string
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`session_message_stream.${msg}`);
}

export class MessageDiffViewer extends React.Component<MessageDiffViewerProps, MessageDiffViewerState> {

    render() {
        const { visible, className, onDialogClosed, closable, msg1, msg2 } = this.props;
        return (
            <ModalBox
                visible={visible}
                title={getIntlMessage("diff_title")}
                closable={closable ?? true}
                onClose={(onDialogClosed)}
                className={`modal-box diff-viewer-modal ${className ? className : ""}`}
                width={820}
            >
                <div className="diff-view-wrapper">
                    <ReactDiffViewer oldValue={msg1} newValue={msg2} useDarkTheme={true} showDiffOnly={false}/>
                </div>
            </ModalBox>)
    }
}