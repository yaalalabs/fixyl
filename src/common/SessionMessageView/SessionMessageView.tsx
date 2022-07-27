import { MessageOutlined } from '@ant-design/icons';
import { Skeleton } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { SOH } from 'src/services/fix/FixDefinitionParser';
import { FixFieldDef } from 'src/services/fix/FixDefs';
import { LM } from 'src/translations/language-manager';
import { removeFalsyKeys } from 'src/utils/utils';
import { FixCommMsg, IntraTabCommunicator } from '../IntraTabCommunicator';
import './SessionMessageView.scss';


const getIntlMessage = (msg: string, options?: any) => {
  return LM.getMessage(`session_message_view.${msg}`, options);
}

interface SessionMessageViewProps {
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

  componentWillUnmount() {
    this.msgSelectSubscription?.unsubscribe();
  }

  private isEmpty = (value: any) => {
    const processedValue = JSON.parse(JSON.stringify(value));
    removeFalsyKeys(processedValue);

    return !processedValue || (typeof processedValue === "object" && Object.keys(processedValue).length === 0)
  }

  private isNotMulti = (def?: FixFieldDef) => {
    return def && ["multiplevaluestring", "multiplecharvalue"].indexOf(def.type.toLowerCase()) > -1
  }

  private getValueFromOptions = (options: { value: string, displayValue: string }[], value: string) => {
    const option = options.filter(inst => inst.value === value)[0];
    if (option) {
      return option.displayValue;
    }

    return value;
  }

  private renderValues = (value: any): any => {
    const processedValue = JSON.parse(JSON.stringify(value));
    removeFalsyKeys(processedValue);

    if (!processedValue || this.isEmpty(processedValue)) {
      return null
    }

    const { selectedMsg } = this.state;
    if (!selectedMsg) {
      return
    }
    
    const { session } = selectedMsg;
    if (Array.isArray(processedValue)) {
      return processedValue.map((inst: any, index) => {
        if (typeof inst === "object") {
          return this.renderValues(inst);
        } else {
          return `${inst},`
        }

      });
    }

    return <table className="styled-table">
      <thead>
        <tr>
          <th>{getIntlMessage("tag")}</th>
          <th>{getIntlMessage("name")}</th>
          <th>{getIntlMessage("value")}</th>
        </tr>
      </thead>

      <tbody>
        {Object.keys(processedValue).map((key, index) => {
          const def = session.getFieldDef(key)
          if (typeof processedValue[key] === "object") {

            return <tr key={index}>
              <td>{def?.number}</td>
              <td>{key}</td>
              <td>
                {Array.isArray(processedValue[key]) && !this.isNotMulti(def) && <div className="group-size">{processedValue[key].length} </div>}
                {this.renderValues(processedValue[key])}
              </td>
            </tr>;
          } else {
            return <tr key={index}>
              <td>{def?.number}</td>
              <td>{key}</td>
              <td>{def?.options ? this.getValueFromOptions(def.options, processedValue[key]) : processedValue[key]}</td>
            </tr>
          }
        })}
      </tbody>
    </table>
  }

  private copyToClipboard = (msg: string) => {
    navigator.clipboard.writeText(msg);
  }

  private alterMsgToDisplay = (rawMsg: string) => {
    return rawMsg.replaceAll(SOH, "^");
  }

  render() {
    const { selectedMsg } = this.state;
    return <div className="session-message-view-wrapper ">
      <div className="header">
        <div className="title"><MessageOutlined />{getIntlMessage("title")}</div>
      </div>
      <div className="body">

        {selectedMsg && <div className="message-wrapper">
          <div className="title">{getIntlMessage("message", { msg: selectedMsg.def.name })}</div>
          {!this.isEmpty(selectedMsg.def.getValue()) ? this.renderValues(selectedMsg.def.getValue()) : <div className="no-data">{getIntlMessage("no_data")}</div>}
        </div>}

        {selectedMsg && <div className="raw-message-wrapper">
          <div className="title">{getIntlMessage("raw_message")}</div>
          <div className="raw-msg" onClick={() => this.copyToClipboard(selectedMsg.rawMsg)}>
            {this.alterMsgToDisplay(selectedMsg.rawMsg)}
            <div className="copy-indicator">{getIntlMessage("copy")}</div>
          </div>
        </div>}
        {!selectedMsg && <Skeleton />}
      </div>
    </div>
  }
}

