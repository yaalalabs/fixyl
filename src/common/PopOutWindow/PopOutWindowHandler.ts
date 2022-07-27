import { Subject, Observable } from 'rxjs';
const { v4: uuidv4 } = require('uuid');

export interface PopOutWindowProps {
    inPoppedOutWindow?: boolean;
}

export interface PopOutEvent {
    name: string;
    component: any;
    key: string;
    props: any;
    width?: number;
    height?: number;
    left?: number;
    top?: number;
}

export class PopOutWindowHandler {

    static getInstance(): PopOutWindowHandler {
        if (!this.inst) {
            this.inst = new PopOutWindowHandler();
        }

        return this.inst;
    }

    private static inst: PopOutWindowHandler;
    private popoutEvent = new Subject<PopOutEvent>();
    private popoutCloseEvent = new Subject<string>();
    private windowMap = new Map<string, any>();

    getNewWindowKey(): string {
        return uuidv4();
    }

    popOutWindow(data: PopOutEvent) {
        this.popoutEvent.next(data);
    }

    getPopOutEventObservable(): Observable<PopOutEvent> {
        return this.popoutEvent.asObservable();
    }

    getPopOutCloseEventObservable(): Observable<string> {
        return this.popoutCloseEvent.asObservable();
    }

    registerPoppedOutWindow(key: string, windowRef: any) {
        if (windowRef) {
            this.windowMap.set(key, windowRef);
        }
    }

    isWindowOpened(key: string) {
        return this.windowMap.get(key) !== undefined;
    }

    closeWindow(key: string) {
        const windowRef = this.windowMap.get(key);
        if (windowRef) {
            windowRef?.close();
            this.windowMap.delete(key);
            this.popoutCloseEvent.next(key);
        }
    }

    destroyAll() {
        this.windowMap.forEach(ref => {
            ref?.close();
        });
        this.windowMap.clear();
    }
}

export const POP = PopOutWindowHandler.getInstance();