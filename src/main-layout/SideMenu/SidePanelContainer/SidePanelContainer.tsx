import {Drawer} from 'antd';
import React from 'react';
import {ActionPanelType} from 'src/common/CommonDefs';
import {ProfilePanel} from './ProfilePanel/ProfilePanel';
import {SettingsPanel} from './SettingsPanel/SettingsPanel';
import {GlobalParamsPanel} from "./GlobalParams/GlobalParamsPanel";
import "./SidePanelContainer.scss";

export interface SidePanelContainerState {
    drawerOpened: boolean;
}

export interface SidePanelContainerProps {
    activePanel?: ActionPanelType;
    onDrawerClosed: () => void;
}

export class SidePanelContainer extends React.Component<SidePanelContainerProps, SidePanelContainerState> {
    constructor(props: any) {
        super(props);

        this.state = {
            drawerOpened: false
        }
    }

    componentDidUpdate(prevProp: SidePanelContainerProps) {
        if (!!this.props.activePanel && prevProp.activePanel !== this.props.activePanel) {
            this.setState({ drawerOpened: true })
        }
    }

    onDrawerToggle = () => {
        this.props.onDrawerClosed();
        this.setState({ drawerOpened: false });
    }

    render() {
        const { activePanel } = this.props;
        const { drawerOpened } = this.state;

        return <div className="side-panel-container">
            <Drawer
                placement="left"
                closable={false}
                onClose={this.onDrawerToggle}
                visible={drawerOpened}
                getContainer={false}
                width={420}
            >
                {activePanel === ActionPanelType.PROFILE && <ProfilePanel />}
                {activePanel === ActionPanelType.SETTINGS && <SettingsPanel />}
                {activePanel === ActionPanelType.GLOBAL_PARAMS && <GlobalParamsPanel />}
            </Drawer>
        </div>
    }
}

