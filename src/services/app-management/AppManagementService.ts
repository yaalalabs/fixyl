import { Observable, Subject, BehaviorSubject } from "rxjs";
import { APP_NAME } from "src/common/CommonDefs";
import { FileManagementService } from "../file-management/FileManagementService";
import { NetworkService } from "../network/NetworkService";
import { ProfileWithCredentials } from "../profile/ProfileDefs";

export type SessionActionType = "new" | "destroy" | "message_viewer" | "message_diff_viewer";

export interface SessionAction {
    profile?: ProfileWithCredentials;
    type: SessionActionType
}

const LATEST_RELEASE_URL = 'https://api.github.com/repos/yaalalabs/fixyl/releases/latest';

export class AppManagementService {
    private sessionActionEventSubject = new Subject<SessionAction>();
    private appReadySubject = new BehaviorSubject<boolean>(false);
    private workingDir?: string = "";
    private latestVersion?: string;
    private initializedSubject = new BehaviorSubject(false);

    constructor(private fileManager: FileManagementService, private network: NetworkService) {
        this.loadWorkingDir();
        this.loadLatestVersion();
    }

    private loadWorkingDir() {
        this.workingDir = localStorage.getItem(`${APP_NAME}.working_dir`) ?? undefined;
        if (this.workingDir) {
            this.fileManager.hasFile(this.workingDir).then(({ status }) => {
                if (!status) {
                    this.workingDir = undefined;
                }

                this.initializedSubject.next(true);
            })
        } else {
            this.initializedSubject.next(true);
        }
    }

    private async loadLatestVersion() {
        try {
            const latest = await this.network.get(LATEST_RELEASE_URL);
            const version: string | undefined = latest.payload?.name;
            if (version) {
                this.latestVersion = version.replace('v', '');
            }
        } catch (error) {
            console.error('Failed to get latest release', error);
        }
    }

    getServiceInitObservable(): Observable<boolean> {
        return this.initializedSubject.asObservable()
    }

    getWorkingDir(): string | undefined {
        return this.workingDir ?? undefined;
    }

    setWorkingDir(dir: string) {
        this.workingDir = dir;
        localStorage.setItem(`${APP_NAME}.working_dir`, dir);
    }

    getLatestVersion(): string | undefined {
        return this.latestVersion ?? undefined;
    }

    getProfilesFile() {
        return `${this.workingDir}/profiles.json`;
    }

    onApplicationReady() {
        this.appReadySubject.next(true);
    }

    getApplicationReadyObservable(): Observable<boolean> {
        return this.appReadySubject.asObservable();
    }

    onSessionAction(action: SessionAction) {
        this.sessionActionEventSubject.next(action);
    }

    getSessionActionObservable(): Observable<SessionAction> {
        return this.sessionActionEventSubject.asObservable();
    }

    getPreferredTheme() {
        return localStorage.getItem(`${APP_NAME}.theme`) ?? "dark"
    }

    setPreferredTheme(theme: string) {
        localStorage.setItem(`${APP_NAME}.theme`, theme);
    }

    getPreferredLanguage() {
        return localStorage.getItem(`${APP_NAME}.language`) ?? "en";
    }

    setPreferredLanguage(lang: string) {
        localStorage.setItem(`${APP_NAME}.language`, lang);
    }
}