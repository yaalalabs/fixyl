import { Observable, Subject } from "rxjs";
import { Scenario } from "src/main-layout/SessionWindow/SessionTab/SessionManagement/Scenarios/ScenarioDefs";
import { AppManagementService } from "../app-management/AppManagementService";
import { FileManagementService } from "../file-management/FileManagementService";
import { FixSession } from "../fix/FixSession";
import { ProfileWithCredentials } from "../profile/ProfileDefs";


export class ScenarioManagementService {
    private favoriteUpdateSubject = new Subject<void>();
    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {

    }

    private getDictionaryName(profile: ProfileWithCredentials) {
        return profile.dictionaryLocation.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, "");
    }

    getScenarioUpdateObservable(): Observable<any> {
        return this.favoriteUpdateSubject.asObservable()
    }

    async saveScenario(profile: ProfileWithCredentials, scenario: Scenario) {
        const dictionaryName = this.getDictionaryName(profile);
        const saveDirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/scenarios";
        try {
            await this.fileManager.createDir(saveDirPath);
            await this.fileManager.writeFile(`${saveDirPath}/${scenario.name}.json`, JSON.stringify(scenario.getDataToSave()));
            this.favoriteUpdateSubject.next();
        } catch (error) {
            return error
        }
    }

    async getAllScenarios(session: FixSession): Promise<Scenario[]> {
        const dictionaryName = this.getDictionaryName(session.profile);
        const dirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/scenarios";
        try {
            const data = await this.fileManager.listDirContent(dirPath);
            if (data.error) {
                throw data.error
            }

            const ret: Scenario[] = [];
            if (data.files) {
                await Promise.all(data.files.map(async (file) => {
                    const name = file.replace(/\.[^/.]+$/, "");
                    const inputFileData = await this.fileManager.readFile(`${dirPath}/${file}`);
                    if (inputFileData.fileData) {
                        const inst: Scenario = new Scenario(name, session);
                        inst.loadFromFile(inputFileData.fileData.data);
                        ret.push(inst);
                    }

                }));
            }

            return ret
        } catch (error) {
            throw error
        }
    }

}