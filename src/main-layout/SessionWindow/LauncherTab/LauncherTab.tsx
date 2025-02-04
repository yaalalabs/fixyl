import { PlusOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import React from 'react';
import { Subscription } from 'rxjs';
import { ActionPanelType } from 'src/common/CommonDefs';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { BaseProfile } from 'src/services/profile/ProfileDefs';
import { LM } from 'src/translations/language-manager';
import './LauncherTab.scss';

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`launcher_tab.${msg}`);
}

interface LauncherTabState {
  profiles: BaseProfile[],
  serverProfiles: BaseProfile[],
  filter?: string
  filterServer?: string
}

export class LauncherTab extends React.Component<any, LauncherTabState> {
  private profileSub?: Subscription;

  constructor(props: any) {
    super(props);

    this.state = {
      profiles: GlobalServiceRegistry.profile.getAllClientProfiles(),
      serverProfiles: GlobalServiceRegistry.profile.getAllServerProfiles(),
    }
  }

  componentDidMount() {
    this.subscribeToProfiles();
    this.setState({ profiles: GlobalServiceRegistry.profile.getAllClientProfiles() })
  }

  componentWillUnmount() {
    this.profileSub?.unsubscribe();
  }

  private subscribeToProfiles() {
    const { profile } = GlobalServiceRegistry;

    this.profileSub = profile.getProfileUpdateObservable().subscribe(() => {
      this.setState({ profiles: profile.getAllClientProfiles() })
    })
  }

  render() {
    const { profiles, filter, serverProfiles, filterServer } = this.state;
    const filteredProfiles = profiles.filter(inst => !filter || (inst.name.toLowerCase()).includes(filter.toLowerCase()))
    const filteredServerProfiles = serverProfiles.filter(inst => !filterServer || (inst.name.toLowerCase()).includes(filterServer.toLowerCase()))

    return <div className="launcher-tab-wrapper">
      <div className="title-section">
        <div className="title">{getIntlMessage("title")}</div>
        <div className="sub-title">{getIntlMessage("sub_title")}</div>
      </div>
      <div className="launcher-actions">
        <div className="clients">
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

        <div className="servers">
          <div className="action-title">{getIntlMessage("action_server_title")}</div>
          <div>
            <Input placeholder={getIntlMessage("filter_server")} onChange={e => this.setState({ filterServer: e.target.value })} />
          </div>
          <ul className="profiles">
            {filteredServerProfiles.map((profile, i) => <li className="profile" key={i} onClick={() => {
              GlobalServiceRegistry.appManager.onSessionAction({ type: "server" })
              setTimeout(() => {
                GlobalServiceRegistry.appManager.onSessionAction({ profile, type: "new" })
              }, 200)
            }}>
              {profile.name}
            </li>)}
          </ul>
          <div className="actions">
            <Button type="ghost" icon={<PlusOutlined />} onClick={() => {
              GlobalServiceRegistry.appManager.onSessionAction({ type: "server" })
              setTimeout(() => {
                GlobalServiceRegistry.appManager.onSessionAction({  type: "new", metaData: "new_server" })
              }, 200)
            }}>{getIntlMessage("create_server")}</Button>
          </div>
        </div>
      </div>
      <div className="launcher-img" />
    </div>
  }
}

