import { LM } from "src/translations/language-manager";
import React from "react";
import ReactDiffViewer from 'react-diff-viewer';
import "./DiffViewer.scss";
import { DiffOutlined } from '@ant-design/icons';
import { IntraTabCommunicator } from "src/common/IntraTabCommunicator";
import { Skeleton } from 'antd';
import { Subscription } from "rxjs";

interface DiffViewerProps {
    communicator: IntraTabCommunicator;
}

interface DiffViewerState {
    msg1?: string
    msg2?: string
}

const getIntlMessage = (msg: string) => {
    return LM.getMessage(`message_diff_viewer.${msg}`);
}

export class DiffViewer extends React.Component<DiffViewerProps, DiffViewerState> {
    private msgSelectSubscription?: Subscription;

    constructor(props: any) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.msgSelectSubscription = this.props.communicator.getMessageSelectObservable().subscribe(selectedMsg => {
            if (selectedMsg?.metaData?.diff) {
                const { msg1, msg2 } = selectedMsg.metaData.diff;
                this.setState({ msg1: msg1 as string, msg2: msg2 as string })
            }
        })
    }

    componentWillUnmount() {
        this.msgSelectSubscription?.unsubscribe();
    }

    render() {
        const { msg1, msg2 } = this.state;

        return (
            <div className="msg-diff-view-wrapper">
                <div className="header">
                    <div className="title"><DiffOutlined />{getIntlMessage("viewer_title")}</div>
                </div>
                <div className="body">
                    {msg1 && msg2 && <ReactDiffViewer oldValue={msg1} newValue={msg2} useDarkTheme={true} showDiffOnly={false}
                        leftTitle={getIntlMessage("raw_msg_1")} rightTitle={getIntlMessage("raw_msg_2")} />}
                    {(!msg1 || !msg2) && <Skeleton />}
                </div>

            </div>
        )
    }
}