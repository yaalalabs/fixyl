import { Observable, Subject } from "rxjs";
import { ProfileWithCredentials } from "../profile/ProfileDefs";
import { FixSession } from "./FixSession";

export interface FixSessionEvent {
    type: "new" | "destroy";
    session: FixSession;
    profile: ProfileWithCredentials;
}

export class FixSessionManagementService {
    private sessions = new Map<ProfileWithCredentials, FixSession>();
    private fixSessionEventSubject = new Subject<FixSessionEvent>();

    getNewFixSession(profile: ProfileWithCredentials): FixSession {
        let session = this.sessions.get(profile);
        if (!session) {
            session = new FixSession(profile);
            this.sessions.set(profile, session);
            this.fixSessionEventSubject.next({ session, profile, type: "new" })
        }

        return session;
    }

    destroyFixSession(profile: ProfileWithCredentials) {
        const session = this.sessions.get(profile);
        if (session) {
            session.destroy();
            this.sessions.delete(profile);
            this.fixSessionEventSubject.next({ session, profile, type: "destroy" })
        }
    }

    destroyAllFixSessions() {
        this.sessions.forEach((session, profile) => {
            session.destroy();
            this.fixSessionEventSubject.next({ session, profile, type: "destroy" })
        })
        
        this.sessions.clear();
    }

    getFixSession(profile: ProfileWithCredentials): FixSession | undefined {
        return this.sessions.get(profile);
    }

    getAllFixSessions() {
        return Array.from(this.sessions.values());
    }

    getFixSessionObservable(): Observable<FixSessionEvent> {
        return this.fixSessionEventSubject.asObservable()
    }
}