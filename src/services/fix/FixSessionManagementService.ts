import { Observable, Subject } from "rxjs";
import { BaseProfile, ProfileWithCredentials, ServerProfile } from "../profile/ProfileDefs";
import { FixSession } from "./FixSession";
import { FixServerSession } from "./FixServerSession";

export interface FixSessionEvent {
    type: "new" | "destroy";
    session: FixSession;
    profile: BaseProfile;
}


export interface FixServerSessionEvent {
    type: "new" | "destroy";
    session: FixServerSession;
    profile: ServerProfile;
}

export class FixSessionManagementService {
    private sessions = new Map<BaseProfile, FixSession>();
    private serverSessions = new Map<ServerProfile, FixServerSession>();
    private fixSessionEventSubject = new Subject<FixSessionEvent>();
    private fixServerSessionEventSubject = new Subject<FixServerSessionEvent>();

    getNewFixSession(profile: ProfileWithCredentials): FixSession {
        let session = this.sessions.get(profile);
        if (!session) {
            session = new FixSession(profile);
            this.sessions.set(profile, session);
            this.fixSessionEventSubject.next({ session, profile, type: "new" })
        }

        return session;
    }

    getNewServerFixSession(profile: ServerProfile): FixServerSession {
        let session = this.serverSessions.get(profile);
        if (!session) {
            session = new FixServerSession(profile);
            this.serverSessions.set(profile, session);
            this.fixServerSessionEventSubject.next({ session, profile, type: "new" })
        }

        return session;
    }

    destroyServerFixSession(profile: ServerProfile) {
        const session = this.serverSessions.get(profile);
        if (session) {
            session.destroy();
            this.serverSessions.delete(profile);
            this.fixServerSessionEventSubject.next({ session, profile, type: "destroy" })
        }
    }

    destroyFixSession(profile: BaseProfile) {
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

    
    getFixServerSession(profile: ServerProfile): FixServerSession | undefined {
        return this.serverSessions.get(profile);
    }

    getAllFixSessions() {
        return Array.from(this.sessions.values());
    }

    getFixSessionObservable(): Observable<FixSessionEvent> {
        return this.fixSessionEventSubject.asObservable()
    }
}