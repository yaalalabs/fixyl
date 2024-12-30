import React from 'react';
export interface KeyboardEventDispatcherProps {
    listenToAllEvents?: boolean;
    children: any;
    events: { keys: string | string[], event: () => void }[]
}

// Note: Key combinations can be added with + sigin
export class KeyboardEventDispatcher extends React.Component<KeyboardEventDispatcherProps> {
    private keyMap = new Map<string, any>();

    private style: React.CSSProperties = {
        width: "100%",
        height: "100%",
        background: "transparent",
        outline: "none"
    };

    constructor(props: KeyboardEventDispatcherProps) {
        super(props);
        props.events.forEach(obj => {
            if (typeof obj.keys === 'string') {
                this.keyMap.set(this.getKeyId(String(obj.keys)), obj.event);
            } else {
                obj.keys.forEach(key => {
                    this.keyMap.set(this.getKeyId(key), obj.event);
                })
            }
        });

        if (this.props.listenToAllEvents) {
            window.addEventListener('keydown', (event) => { this.onKeyDown(event) });
        }
    }

    componentWillUnmount() {
        if (this.props.listenToAllEvents) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }

    private getKeyId = (key: string) => {
        return key.replace(/\s/g, '');
    }

    private checkKeyCombinations = (event: any) => {
        let keyCobintion = event.altKey ? "Alt+" : "";
        keyCobintion += event.shiftKey ? "Shift+" : "";
        keyCobintion += event.ctrlKey ? "Ctrl+" : "";
        keyCobintion += event.metaKey ? "Ctrl+" : "";        
        keyCobintion += event.key;

        const cb = this.keyMap.get(keyCobintion);
        if (cb) {
            cb();
        }
    }

    private onKeyDown = (event: any) => {
        const cb = this.keyMap.get(event.key);
        if (cb) {
            cb();
        }

        this.checkKeyCombinations(event);
    }

    render() {
        if (this.props.listenToAllEvents) {
            return this.props.children;
        }

        return (
            <div data-testid="key-event-displatcher" style={this.style} onKeyDown={this.onKeyDown} tabIndex={0} >{this.props.children}</div>
        )
    }
}
