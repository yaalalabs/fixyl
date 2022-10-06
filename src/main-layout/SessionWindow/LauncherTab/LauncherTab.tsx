import { PlusOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { ActionPanelType } from 'src/common/CommonDefs';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { ProfileWithCredentials } from 'src/services/profile/ProfileDefs';
import { LM } from 'src/translations/language-manager';
import './LauncherTab.scss';

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`launcher_tab.${msg}`);
}

interface LauncherTabState {
  profiles: ProfileWithCredentials[],
  filter?: string
}

export class LauncherTab extends React.Component<any, LauncherTabState> {
  private profileSub?: Subscription;

  constructor(props: any) {
    super(props);

    this.state = {
      profiles: GlobalServiceRegistry.profile.getAllProfiles()
    }
  }

  componentDidMount() {
    this.subscribeToProfiles();
    this.setState({ profiles: GlobalServiceRegistry.profile.getAllProfiles() })
  }

  componentWillUnmount() {
    this.profileSub?.unsubscribe();
  }

  private subscribeToProfiles() {
    const { profile } = GlobalServiceRegistry;

    this.profileSub = profile.getProfileUpdateObservable().subscribe(() => {
      this.setState({ profiles: profile.getAllProfiles() })
    })
  }

  render() {
    const { profiles, filter } = this.state;
    const filteredProfiles = profiles.filter(inst => !filter || inst.name.includes(filter))

    return <div className="launcher-tab-wrapper">
      <div className="title-section">
        <div className="title">{getIntlMessage("title")}</div>
        <div className="sub-title">{getIntlMessage("sub_title")}</div>
      </div>
      <div className="launcher-actions">
        <div className="action-title">{getIntlMessage("action_title")}</div>
        <div>
          <Input placeholder={getIntlMessage("filter")} onChange={e => this.setState({ filter: e.target.value })} />
        </div>
        <ul className="profiles">
          {filteredProfiles.map((profile, i) => <li className="profile" key={i} onClick={() => GlobalServiceRegistry.appManager.onSessionAction({ profile, type: "new" })}>
            {profile.name}
          </li>)}
        </ul>
        <div className="actions">
          <Button type="ghost" icon={<PlusOutlined />} onClick={() => {
            GlobalServiceRegistry.navigation.navigate({
              path: [
                { partName: "main", action: { action: 'select', id: ActionPanelType.PROFILE } },
                { partName: "profile", action: { action: 'open', id: "new_profile" } }
              ],
            })
          }}>{getIntlMessage("create_profile")}</Button>
        </div>
      </div>
      <img className="launcher-img" alt="" src={require("../../../assets/launcher.png").default} />
    </div>
  }
}

