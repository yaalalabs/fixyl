import { Observable, Subject } from "rxjs";
import { APP_NAME } from "../../common/CommonDefs";
import { AppManagementService } from "../app-management/AppManagementService";
import { FileManagementService } from "../file-management/FileManagementService";
import { Profile, ProfileWithCredentials } from "./ProfileDefs";
import { SecureKeyManager } from "./SecureKeyManager";

export class ProfileManagementService {
    private profiles = new Map<string, ProfileWithCredentials>();
    private profileUpdateSubject = new Subject<void>();
    private secureKeyManager = new SecureKeyManager();

    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {
        this.appManager.getServiceInitObservable().subscribe((state) => {
            if (state) {
                if (this.appManager.getWorkingDir()) {
                    this.loadFromDevice().then(() => {
                        this.appManager.onApplicationReady();
                    })
                } else {
                    this.appManager.onApplicationReady();
                }
            }
        })
    }

    private async loadFromDevice() {
        const profileInfo = await this.loadGeneralProfileInfo();
        profileInfo.forEach(async inst => {
            const profile: ProfileWithCredentials = { ...inst, username: "", password: "" };
            const credentials = await this.secureKeyManager.findKeyForService(`${APP_NAME}.${inst.name}.credentials`);
            if (credentials) {
                profile.username = credentials.account;
                profile.password = credentials.password;
            }

            this.profiles.set(profile.name, profile);
        })
    }

    private loadGeneralProfileInfo(): Promise<Profile[]> {
        return new Promise(async (resolve) => {
            try {
                const data = await this.fileManager.readFile(this.appManager.getProfilesFile());
                if (data.fileData) {
                    resolve(JSON.parse(data.fileData.data))
                }
            } catch (err) {
                resolve([])
            }
        })

    }

    getProfile(name: string): ProfileWithCredentials | undefined {
        return this.profiles.get(name)
    }
    
    getAllProfiles(): ProfileWithCredentials[] {
        return Array.from(this.profiles.values());
    }

    getProfileUpdateObservable(): Observable<void> {
        return this.profileUpdateSubject.asObservable();
    }

    addOrEditProfile(profile: ProfileWithCredentials): boolean {
        this.profiles.set(profile.name, profile);
        this.saveAllProfilesInDevice();
        this.addCredentialsToDevice(profile.name, { username: profile.username, password: profile.password });


        this.profileUpdateSubject.next();
        return true
    }

    removeProfile(profile: ProfileWithCredentials) {
        this.profiles.delete(profile.name);
        this.saveAllProfilesInDevice();
        this.profileUpdateSubject.next();
    }

    private saveAllProfilesInDevice() {
        const data: Profile[] = this.getAllProfiles().map(profile => {
            const temp = { ...profile };
            delete (temp as any).username;
            delete (temp as any).password;
            return temp;
        })

        this.fileManager.writeFile(this.appManager.getProfilesFile(), JSON.stringify(data));
    }

    private addCredentialsToDevice(name: string, credentials: { username: string, password: string }) {
        this.secureKeyManager.addKey(`${APP_NAME}.${name}.credentials`, credentials.username, credentials.password);
    }
}