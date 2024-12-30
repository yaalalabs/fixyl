import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Select } from 'antd';
import React from 'react';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LanguageCodes, LM } from 'src/translations/language-manager';
import { BasePanel } from '../BasePanel';
import './SettingsPanel.scss';
import { WorkingDirSelector } from './WorkingDirSelector';
var pjson = require('../../../../../package.json');

const { Option } = Select;
const getIntlMessage = (msg: string) => {
  return LM.getMessage(`settings.${msg}`);
}

interface SettingsPanelProps {
  onClose: () => void;
}

export class SettingsPanel extends React.Component<SettingsPanelProps, any> {
  state = {
    lang: GlobalServiceRegistry.appManager.getPreferredLanguage(),
    theme: GlobalServiceRegistry.appManager.getPreferredTheme(),
    workingDir: GlobalServiceRegistry.appManager.getWorkingDir(),
    showDialog: false
  }

  render() {
    const { theme, lang, workingDir, showDialog } = this.state;

    return <BasePanel className="settings-management" title={<React.Fragment>{getIntlMessage("title")}
      <div className="actions">        
        <Button shape="circle" icon={<CloseOutlined />} onClick={this.props.onClose} />
      </div>
    </React.Fragment>}>
      <div className="field-container">
        <div className="field-name">{getIntlMessage("theme")}</div>
        <div className="field-value"><Select value={theme} onChange={(value) => {
          const theme = value?.toString() ?? "dark";
          this.setState({ theme })
          document.documentElement.setAttribute('data-theme', theme);
          GlobalServiceRegistry.appManager.setPreferredTheme(theme);
        }}>
          <Option value="dark">{getIntlMessage("dark")}</Option>
          <Option value="light">{getIntlMessage("light")}</Option>
        </Select></div>
      </div>
      <div className="field-container">
        <div className="field-name">{getIntlMessage("language")}</div>
        <div className="field-value"><Select value={lang} onChange={(value) => {
          const lang = value?.toString() ?? LanguageCodes.ENGLISH;
          this.setState({ lang })
          LM.switchLanguage(lang as any);
          GlobalServiceRegistry.appManager.setPreferredLanguage(lang);
        }}>
          <Option value={LanguageCodes.ENGLISH}>{getIntlMessage("en")}</Option>
          <Option value={LanguageCodes.SINHALA}>{getIntlMessage("si")}</Option>
        </Select></div>
      </div>
      <div className="field-container">
        <div className="field-name">{getIntlMessage("working_dir")}</div>
        <div className="field-value"><span className="value-container">{workingDir}</span>
          <div className="working-dir-selector" onClick={() => {
            this.setState({ showDialog: true })
          }}> <MoreOutlined></MoreOutlined></div>
          <WorkingDirSelector visible={showDialog} onDialogClosed={() => {
            this.setState({ showDialog: false })
            this.setState({ workingDir: GlobalServiceRegistry.appManager.getWorkingDir() })
          }} />
        </div>
      </div>
      <div className="field-container">
        <div className="field-name">{getIntlMessage("version")}</div>
        <div className="field-value" style={{ marginRight: 15 }}>{pjson.version}</div>
      </div>
    </BasePanel>
  }
}

