import { Tooltip } from 'antd';
import React, { FC, ReactComponentElement } from 'react';
import { ActionPanelType } from 'src/common/CommonDefs';
import './SideMenu.scss';
import { SidePanelContainer } from './SidePanelContainer/SidePanelContainer';
import { ProfileOutlined, SettingOutlined, EyeOutlined, DiffOutlined, GlobalOutlined } from '@ant-design/icons';
import { LM } from 'src/translations/language-manager';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { Subscription } from 'rxjs';
import { NavigationPathAction } from 'src/services/navigation/NevigationService';
import ReactJoyride, { CallBackProps } from "react-joyride";
import { SessionActionType } from 'src/services/app-management/AppManagementService';
import { VersionAlert } from './VersionAlert/VersionAlert';


export interface MenuItemProps {
  onSelected: (name: ActionPanelType) => void;
  icon: ReactComponentElement<any>;
  name: string;
  isActive?: boolean;
  id: ActionPanelType;
}

export const MenuItem: FC<MenuItemProps> = ({ icon, name, isActive, id, onSelected }) => {
  return (<Tooltip placement="right" title={name} overlayClassName="menu-item-tooltip">
    <div onClick={() => { onSelected(id) }} id={id}>
      <div className={`menu-item ${isActive ? 'active' : ''} menu-${id.toLowerCase().replaceAll(" ", "-")}`} >
        <div className="icon">{icon}</div>
        <div className="name">{name}</div>
      </div>
    </div>
  </Tooltip>
  )
}

export interface SideMenuState {
  activePanel?: ActionPanelType,
  steps: any,
  run: boolean

}

const getIntlMessage = (msg: string) => {
  return LM.getMessage(`menu.${msg}`);
}

const SHOW_DEMO_KEY = "ui_demo_completed";

const DemoContent = ({ title, text }: { title: string, text: string }) => {
  return <div className="demo-content">
    <div className="title">{title}</div>
    <div className="text">{text}</div>
  </div>
}
export class SideMenu extends React.Component<any, SideMenuState> {
  private navSubscription?: Subscription;
  private ref = React.createRef<SidePanelContainer>();

  constructor(props: any) {
    super(props);
    this.state = {
      steps: [
        {
          target: '.menu-profile',
          content: <DemoContent title="Profile Management" text={'You can manage your fix sessions as profiles.'} />,
        },
        {
          target: '.menu-message-viewer',
          content: <DemoContent title="Message Viewer" text={'The section of the app lets you import a raw message and view its content in a tabular format.'} />,
        },
        {
          target: '.menu-message-diff-viewer',
          content: <DemoContent title="Message Diff Viewer" text={'The section of the app lets you compare raw messages.'} />,
        },
        {
          target: '.menu-settings',
          content: <DemoContent title="Settings" text={'You can control settings such as themes, language and workign directory using settings.'} />,
        },
      ],
      run: localStorage.getItem(SHOW_DEMO_KEY) !== "done",
    }
  }

  componentDidMount() {
    this.subscribeToNavigations();
  }

  componentWillUnmount() {
    this.navSubscription?.unsubscribe();
  }

  onDrawerClosed = () => {
    this.setState({ activePanel: undefined })
  }

  onSelected = (activePanel: ActionPanelType) => {
    this.setState({ activePanel })
  }

  onMessageViewer = (type: SessionActionType) => {
    this.ref?.current?.onDrawerToggle();
    GlobalServiceRegistry.appManager.onSessionAction({ type })
  }

  handleClickStart = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    this.setState({
      run: true,
    });
  };

  handleJoyrideCallback = (data: CallBackProps) => {
    const { action, } = data;
    if (action === "stop" || action === "reset") {
      this.setState({ run: false });
      localStorage.setItem(SHOW_DEMO_KEY, "done")
    }
  };

  private subscribeToNavigations = () => {
    const { navigation } = GlobalServiceRegistry;
    this.navSubscription = navigation.getNavigationEventObservable().subscribe(event => {
      const pathPart = navigation.getNavigationInfoIfApplicable(event.path, "main");
      if (pathPart) {
        if (pathPart.action) {
          this.performNavAction(pathPart.action);
        }
        navigation.propergate(event);
      }
    });
  }

  private performNavAction = (actionObj: NavigationPathAction) => {
    const { action, id } = actionObj;
    switch (action) {
      case "select":
      case "click":
        id && this.setState({ activePanel: id as ActionPanelType })
        break;
    }
  }

  render() {
    const { activePanel } = this.state;
    return <React.Fragment>
      <ReactJoyride
        steps={this.state.steps}
        callback={this.handleJoyrideCallback}
        continuous
        hideBackButton
        hideCloseButton
        run={this.state.run}
        scrollToFirstStep
        showProgress
        showSkipButton
        styles={{
          options: {
            zIndex: 100000,
            backgroundColor: "var(--shade-350)",
            arrowColor: "var(--shade-350)",
            textColor: "var(--text-color)"
          },
          buttonNext: {
            backgroundColor: "var(--accent-2)"
          }
        }}
      />
      <div className="side-menu-container">
        <MenuItem icon={<ProfileOutlined />} name={getIntlMessage("profile")} id={ActionPanelType.PROFILE}
          isActive={activePanel === ActionPanelType.PROFILE} onSelected={this.onSelected} />
        <MenuItem icon={<EyeOutlined />} name={getIntlMessage("message_viewer")} id={ActionPanelType.MESSAGE_VIEWER}
          isActive={activePanel === ActionPanelType.MESSAGE_VIEWER} onSelected={() => this.onMessageViewer("message_viewer")} />
        <MenuItem icon={<DiffOutlined />} name={getIntlMessage("message_diff_viewer")} id={ActionPanelType.MESSAGE_DIFF_VIEWER}
          isActive={activePanel === ActionPanelType.MESSAGE_DIFF_VIEWER} onSelected={() => this.onMessageViewer("message_diff_viewer")} />
        <MenuItem icon={<GlobalOutlined />} name={getIntlMessage("global_params")} id={ActionPanelType.GLOBAL_PARAMS}
                  isActive={activePanel === ActionPanelType.GLOBAL_PARAMS} onSelected={this.onSelected} />
        <MenuItem icon={<SettingOutlined />} name={getIntlMessage("settings")} id={ActionPanelType.SETTINGS}
          isActive={activePanel === ActionPanelType.SETTINGS} onSelected={this.onSelected} />
      </div>
      <SidePanelContainer ref={this.ref} onDrawerClosed={this.onDrawerClosed} activePanel={activePanel} />
      <VersionAlert />
    </React.Fragment>
  }
}

