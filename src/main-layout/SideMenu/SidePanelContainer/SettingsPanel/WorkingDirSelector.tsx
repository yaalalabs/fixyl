import { LM } from "src/translations/language-manager";
import React from "react";
import { ModalBox } from "src/common/Modal/ModalBox";
import { FileSelect } from "src/common/FileSelect/FileSelect";
import { GlobalServiceRegistry } from "src/services/GlobalServiceRegistry";

interface WorkingDirSelectorProps {
    visible: boolean;
    closable?: boolean;
    className?: string;
    onDialogClosed: () => void;
}

interface WorkingDirSelectorState {
    path?: string
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`working_dir_selector.${msg}`);
}

export class WorkingDirSelector extends React.Component<WorkingDirSelectorProps, WorkingDirSelectorState> {
    state = {
        path: GlobalServiceRegistry.appManager.getWorkingDir()
    }

    render() {
        const { visible, className, onDialogClosed, closable } = this.props;
        const { path } = this.state;
        return (
            <ModalBox
                visible={visible}
                title={getIntlMessage("title")}
                closable={closable ?? true}
                onClose={(onDialogClosed)}
                className={`modal-box ${className ? className : ""}`}
                width={520}
            >
                <div>
                    <div className="message">{getIntlMessage("desc")}</div>
                </div>
                <div className="modal-footer">

                    <FileSelect options={["openDirectory"]} value={path} label={getIntlMessage("browse")} onChange={(path: any) => {
                        if (path) {
                            this.setState({ path })
                            GlobalServiceRegistry.appManager.setWorkingDir(path);
                            onDialogClosed();
                        }
                        
                    }} />
                </div>
            </ModalBox>)
    }
}