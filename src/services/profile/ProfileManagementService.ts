import { Observable, Subject } from "rxjs";
import { APP_NAME } from "../../common/CommonDefs";
import { AppManagementService } from "../app-management/AppManagementService";
import { FileManagementService } from "../file-management/FileManagementService";
import { BaseProfile, Profile, ProfileWithCredentials, ServerProfile } from "./ProfileDefs";
import { SecureKeyManager } from "./SecureKeyManager";

export class ProfileManagementService {
    private profiles = new Map<string, BaseProfile>();
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
            let profile: BaseProfile;
            if (inst.type !== "SERVER") {
                const clProfile: ProfileWithCredentials = ({ ...inst, username: "", password: "" })
                const credentials = await this.secureKeyManager.findKeyForService(`${APP_NAME}.${inst.name}.credentials`);
                if (credentials) {
                    clProfile.username = credentials.account;
                    clProfile.password = credentials.password;
                }

                const certCredentials = await this.secureKeyManager.findKeyForService(`${APP_NAME}.${inst.name}.certificate_credentials`);
                if (certCredentials) {
                    clProfile.sslCertificatePassword = certCredentials.password;
                }

                profile = clProfile;
            } else {
                profile = { ...inst };
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
                } else {
                    resolve([])
                }
            } catch (err) {
                resolve([])
            }
        })

    }

    getProfile(name: string): BaseProfile | undefined {
        return this.profiles.get(name)
    }

    getAllClientProfiles(): BaseProfile[] {
        return Array.from(this.profiles.values()).filter(inst => inst.type !== "SERVER");
    }

    getAllServerProfiles(): BaseProfile[] {
        return Array.from(this.profiles.values()).filter(inst => inst.type === "SERVER");
    }

    getProfileUpdateObservable(): Observable<void> {
        return this.profileUpdateSubject.asObservable();
    }

    addOrEditServerProfile(profile: ServerProfile): boolean {
        this.profiles.set(profile.name, profile);
        this.saveAllProfilesInDevice();
        this.profileUpdateSubject.next();
        return true
    }

    addOrEditProfile(profile: ProfileWithCredentials): boolean {
        this.profiles.set(profile.name, profile);
        this.saveAllProfilesInDevice();
        this.addCredentialsToDevice(profile.name, { username: profile.username, password: profile.password, certPassword: profile.sslCertificatePassword });


        this.profileUpdateSubject.next();
        return true
    }

    removeProfile(profile: BaseProfile) {
        this.profiles.delete(profile.name);
        this.saveAllProfilesInDevice();
        this.profileUpdateSubject.next();
    }

    private saveAllProfilesInDevice() {
        const data: BaseProfile[] = Array.from(this.profiles.values()).map(profile => {
            const temp = { ...profile };
            if (profile.type !== "SERVER") {
                delete (temp as any).username;
                delete (temp as any).password;
                delete (temp as any).sslCertificatePassword;
            }
            return temp;
        })

        this.fileManager.writeFile(this.appManager.getProfilesFile(), JSON.stringify(data));
    }

    private addCredentialsToDevice(name: string, credentials: { username: string, password: string, certPassword?: string }) {
        this.secureKeyManager.addKey(`${APP_NAME}.${name}.credentials`, credentials.username, credentials.password);
        if (credentials.certPassword) {
            this.secureKeyManager.addKey(`${APP_NAME}.${name}.certificate_credentials`, credentials.username, credentials.certPassword);
        }
    }
}