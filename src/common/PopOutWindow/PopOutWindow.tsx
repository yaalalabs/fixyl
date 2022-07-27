import React, { FC } from 'react';
import ReactDOM from 'react-dom';
import { PopOutWindowHandler } from './PopOutWindowHandler';

function copyStyles(sourceDoc: any, targetDoc: any) {
    Array.from(sourceDoc.styleSheets).forEach((styleSheet: any) => {
        if (styleSheet.cssRules && styleSheet.cssRules.length > 0) { // for <style> elements
            const newStyleEl = sourceDoc.createElement('style');

            Array.from(styleSheet.cssRules).forEach((cssRule: any) => {
                // write the text of each rule into the body of the style element
                newStyleEl.appendChild(sourceDoc.createTextNode(cssRule.cssText));
            });

            targetDoc.head.appendChild(newStyleEl);
        } else if (styleSheet.href) { // for <link> elements loading CSS from a URL
            const newLinkEl = sourceDoc.createElement('link');
            newLinkEl.rel = 'stylesheet';
            newLinkEl.href = styleSheet.href;
            targetDoc.head.appendChild(newLinkEl);
        }
    });
}

interface PopOutWindowProps {
    component: any;
    props: any;
    name: string;
    windowKey: string;
    height?: number;
    width?: number;
    left?: number;
    top?: number;
}

interface PopOutWindowState {
    mainWindowVisible: boolean;
}

interface WindowInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    fullscreen: boolean;
}


const getWindowInfo = (): WindowInfo => {
    return {
        x: window.screenX,
        y: window.screenY,
        height: window.innerHeight,
        width: window.innerWidth,
        fullscreen: window.screen.availWidth - window.innerWidth === 0
    }
}

export interface PopOutWindowInnerComponentProps {
    inPoppedOutWindow: boolean;
    mainWindowVisible: boolean;
}


export class PopOutWindow extends React.Component<PopOutWindowProps, PopOutWindowState> {
    private container: any;
    private windowHandler = PopOutWindowHandler.getInstance();
    private resizeTimeout: any;
    private monitoringTimer: any;
    private localWindow: any;

    constructor(props: any) {
        super(props);
        this.container = document.createElement('div');
        this.container.setAttribute("id", "root");
        this.state = {
            mainWindowVisible: true
        }
    }

    openWindow = () => {
        const { width, height, left, top } = this.props;
        const windowWidth = width ?? 600;
        const windowHeight = height ?? 400;
        const windowLeft = left ?? 200;
        const windowTop = top ?? 200;

        return window.open('', '', `width=${windowWidth},height=${windowHeight},left=${windowLeft},top=${windowTop}`);
    }

    componentDidMount() {
        const { name, windowKey, } = this.props;
        const window: any = this.openWindow();
        window.document.body.appendChild(this.container);
        window.document.documentElement.setAttribute('data-theme', 'dark');
        window.document.title = name;
        copyStyles(document, window.document);

        this.windowHandler.registerPoppedOutWindow(windowKey, window);
        this.localWindow = window;
        this.listenToWindowEvents();
        this.startMonitoring();
    }

    componentWillUnmount() {
        const { windowKey } = this.props;
        this.windowHandler.closeWindow(windowKey);
        this.stopMonitoring();
    }

    private listenToWindowEvents() {
        const { windowKey } = this.props;

        window.addEventListener('beforeunload', () => {
            this.windowHandler.closeWindow(windowKey);
        });

        this.localWindow.addEventListener('beforeunload', () => {
            this.windowHandler.closeWindow(windowKey);
        });

        window.document.body.onclick = () => {
            this.forceUpdate();
        }

        window.addEventListener('resize', () => {
            this.forceUpdate();
        });

        window.document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.setState({ mainWindowVisible: true })
            } else {
                this.setState({ mainWindowVisible: false })
            }
        }, false);

        this.localWindow.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.saveWindowInfo(getWindowInfo());
            }, 200)
        });
    }

    private startMonitoring() {
        var oldX = window.screenX,
            oldY = window.screenY;

        this.monitoringTimer = setInterval(() => {
            if (oldX !== window.screenX || oldY !== window.screenY) {
                this.saveWindowInfo(getWindowInfo())
            }

            oldX = window.screenX;
            oldY = window.screenY;
        }, 1000);
    }

    private saveWindowInfo(windowInfo: WindowInfo) {

    }

    private rePositionWindow(windowInfo: WindowInfo) {
        window.moveTo(windowInfo.x, windowInfo.y);
        if (windowInfo.fullscreen) {
            window.resizeTo(window.screen.availWidth, window.screen.availHeight);
        } else {
            window.resizeTo(windowInfo.width, windowInfo.height)
        }
    }

    stopMonitoring() {
        clearInterval(this.monitoringTimer);
    }

    render() {
        const { mainWindowVisible } = this.state;
        const { component, props } = this.props;
        return <React.Fragment>
            {ReactDOM.createPortal(<React.Fragment>
                <PopOutWindowOverlay inPoppedOutWindow={true} mainWindowVisible={mainWindowVisible} />
                {React.createElement(component, {
                    ...props, inPoppedOutWindow: true, mainWindowVisible
                })}
            </React.Fragment>, this.container)}
        </React.Fragment>;
    }

}

export const PopOutWindowOverlay: FC<PopOutWindowInnerComponentProps> = ({ inPoppedOutWindow, mainWindowVisible }) => {
    if (!inPoppedOutWindow || mainWindowVisible) {
        return null;
    }

    return <div style={{
        position: "fixed",
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        background: "#121622b8",
        transition: "all 0.3s",
        backdropFilter: "blur(3px)"
    }}>
        <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-color-accent-2)",
            textTransform: "uppercase"
        }}>Main window is not visible</div>
    </div>
}
