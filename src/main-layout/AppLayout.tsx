import React from 'react';
import { LoadingScreen } from 'src/common/LoadingScreen/LoadingScreen';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import './AppLayout.scss';
import { SessionWindow } from './SessionWindow/SessionWindow';
import { SideMenu } from './SideMenu/SideMenu';
import { WorkingDirSelector } from './SideMenu/SidePanelContainer/SettingsPanel/WorkingDirSelector';

interface AppLayoutState {
    isReady: boolean;
    showFileDialog: boolean;
}

export class AppLayout extends React.Component<any, AppLayoutState> {

    constructor(props: any) {
        super(props)
        this.state = {
            isReady: false,
            showFileDialog: false
        }
    }

    componentDidMount() {
        GlobalServiceRegistry.appManager.getApplicationReadyObservable().subscribe(isReady => {
            setTimeout(() => {
                if (isReady) {
                    this.setState({ isReady, showFileDialog: !!!GlobalServiceRegistry.appManager.getWorkingDir() })
                }                
            }, 1000)
        })

        window.addEventListener('unload', (e) => {
            GlobalServiceRegistry.fix.destroyAllFixSessions()
        })
    }

    componentWillUnmount() {

    }

    render() {
        const { showFileDialog, isReady } = this.state;
        if (!isReady) {
            return <LoadingScreen></LoadingScreen>;
        }

        return <div className="app-layout-wrapper">
            <div className="side-menu-wrapper">
                <SideMenu />
            </div>
            <div className="session-window-wrapper">
                <SessionWindow />
            </div>

            <WorkingDirSelector visible={showFileDialog} closable={false} onDialogClosed={() => {
                this.setState({ showFileDialog: false })
            }} />
        </div>
    }
}

