import { Observable, Subject, BehaviorSubject } from "rxjs";
import { APP_NAME } from "src/common/CommonDefs";
import { FileManagementService } from "../file-management/FileManagementService";
import { NetworkService } from "../network/NetworkService";
import { ProfileWithCredentials } from "../profile/ProfileDefs";

export type SessionActionType = "new" | "destroy" | "message_viewer" | "message_diff_viewer" | "global_params";

export interface SessionAction {
    profile?: ProfileWithCredentials;
    type: SessionActionType
}

const LATEST_RELEASE_URL = 'https://api.github.com/repos/yaalalabs/fixyl/releases/latest';
const VERSION_VALIDITY_PERIOD = 86400000;

export class AppManagementService {
    private sessionActionEventSubject = new Subject<SessionAction>();
    private appReadySubject = new BehaviorSubject<boolean>(false);
    private workingDir?: string = "";
    private latestVersion?: string;
    private initializedSubject = new BehaviorSubject(false);

    constructor(private fileManager: FileManagementService, private network: NetworkService) {
        this.loadWorkingDir();
        if (this.shouldCheckVersion()) {
            this.loadLatestVersion();
        }
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

    private shouldCheckVersion() {
        this.latestVersion = localStorage.getItem(`${APP_NAME}.latest_version`) ?? undefined;

        if (this.latestVersion && this.isVersionUpToDate()) {
            return false;
        }
        return true;
    }

    private async loadLatestVersion() {
        try {
            const latest = await this.network.get(LATEST_RELEASE_URL);
            const version: string | undefined = latest.payload?.name;
            if (version) {
                this.latestVersion = version.replace('v', '');
                localStorage.setItem(`${APP_NAME}.latest_version`, this.latestVersion);
                localStorage.setItem(`${APP_NAME}.version_timestamp`, `${Date.now()}`);
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

    isVersionUpToDate() {
        const versionRequestTimestamp = localStorage.getItem(`${APP_NAME}.version_timestamp`) ?? undefined;
        if (
            versionRequestTimestamp
            && !isNaN(Number(versionRequestTimestamp))
            && (Date.now() - Number(versionRequestTimestamp) < VERSION_VALIDITY_PERIOD)
        ) {
            return true;
        }
        return false;
    }

    getLatestVersion(): string | undefined {
        return this.latestVersion ?? undefined;
    }

    getProfilesFile() {
        return `${this.workingDir}/profiles.json`;
    }

    getGlobalParametersFile() {
        return `${this.workingDir}/global_params.json`
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