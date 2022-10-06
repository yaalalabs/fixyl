import { Skeleton } from 'antd';
import React from 'react';
import { SOH } from 'src/services/fix/FixDefinitionParser';
import { FixFieldDef } from 'src/services/fix/FixDefs';
import { LM } from 'src/translations/language-manager';
import { removeFalsyKeys } from 'src/utils/utils';
import { FixCommMsg, } from '../IntraTabCommunicator';
import './MessageView.scss';


const getIntlMessage = (msg: string, options?: any) => {
  return LM.getMessage(`session_message_view.${msg}`, options);
}

interface MessageViewProps {
  selectedMsg?: FixCommMsg;
  hideRawMsg?: boolean
}

export class MessageView extends React.Component<MessageViewProps, any> {


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

    const { selectedMsg } = this.props;
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
    const { selectedMsg, hideRawMsg } = this.props;
    return <div className="message-data-view-wrapper">

      {selectedMsg && <div className="message-wrapper">
        <div className="title">{getIntlMessage("message", { msg: selectedMsg.def.name })}</div>
        {!this.isEmpty(selectedMsg.def.getValue()) ? this.renderValues(selectedMsg.def.getValue()) : <div className="no-data">{getIntlMessage("no_data")}</div>}
      </div>}

      {selectedMsg && !hideRawMsg && <div className="raw-message-wrapper">
        <div className="title">{getIntlMessage("raw_message")}</div>
        <div className="raw-msg" onClick={() => this.copyToClipboard(selectedMsg.rawMsg)}>
          {this.alterMsgToDisplay(selectedMsg.rawMsg)}
          <div className="copy-indicator">{getIntlMessage("copy")}</div>
        </div>
      </div>}
      {!selectedMsg && <Skeleton />}
    </div>
  }
}

