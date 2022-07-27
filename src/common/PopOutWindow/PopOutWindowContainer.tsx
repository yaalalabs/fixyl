import React from 'react';
import { PopOutWindow } from './PopOutWindow';
import { PopOutEvent, POP } from './PopOutWindowHandler';


export class PopOutWindowContainer extends React.Component<any, any> {
    private eventMap = new Map<string, PopOutEvent>();

    constructor(props: any) {
        super(props);
        this.init();
    }

    private init() {
        POP.getPopOutEventObservable().subscribe(event => {
            this.eventMap.set(event.key, event);
            this.forceUpdate();
        });

        POP.getPopOutCloseEventObservable().subscribe(key => {
            this.eventMap.delete(key);
            this.forceUpdate();
        });

        window.addEventListener('beforeunload', () => {
            POP.destroyAll();
        });
    }

    componentWillUnmount() {
        POP.destroyAll();
    }

    render() {
        return <React.Fragment>
            {Array.from(this.eventMap.values()).map(event => {
                return <PopOutWindow {...event} windowKey={event.key}></PopOutWindow>
            })}
        </React.Fragment>;
    }

}
