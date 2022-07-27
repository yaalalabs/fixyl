import { Observable, Subject } from "rxjs";
import { FixComplexType } from "src/services/fix/FixDefs";
import { FixSession } from "src/services/fix/FixSession";

export interface FixCommMsg {
    def: FixComplexType,
    session: FixSession,
    rawMsg: string
}
export class IntraTabCommunicator {
    private msgSelectSubject = new Subject<FixCommMsg | undefined>();

    onMessageSelected(msg: FixCommMsg | undefined) {
        this.msgSelectSubject.next(msg)
    }

    getMessageSelectObservable(): Observable<FixCommMsg | undefined> {
        return this.msgSelectSubject.asObservable();
    }
}