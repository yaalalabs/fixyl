import { Observable, Subject } from "rxjs";
import { FixComplexType } from "src/services/fix/FixDefs";
import { BaseClientFixSession } from "src/services/fix/FixSession";

export interface FixCommMsg {
    def: FixComplexType,
    session: BaseClientFixSession,
    rawMsg: string,
    metaData?: any
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