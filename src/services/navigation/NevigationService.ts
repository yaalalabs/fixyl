import { Observable, Subject } from "rxjs";

export interface NavigationEvent {
    path: NavigationPathPart[];
    data?: any;
}

export interface NavigationPathPart {
    partName: string;
    action?: NavigationPathAction;
}

export interface NavigationPathAction {
    action: "select" | "click" | "open",
    id?: string,
    metaData?: any
}

export class NavigationService {
    private navigationSubject = new Subject<NavigationEvent>();

    navigate(event: NavigationEvent): void {
        this.navigationSubject.next(event);
    }

    getNavigationEventObservable(): Observable<NavigationEvent> {
        return this.navigationSubject.asObservable();
    }

    getNavigationInfoIfApplicable(path: NavigationPathPart[], partName: string): NavigationPathPart | undefined {
        const currentPart = path[0];
        if (currentPart.partName === partName) {
            return currentPart;
        }

        return undefined;
    }

    propergate(event: NavigationEvent): void {
        setTimeout(() => {
            if (event.path.length > 1) {
                event.path.shift();
                this.navigate(event);
            }
        }, 0);
    }
}