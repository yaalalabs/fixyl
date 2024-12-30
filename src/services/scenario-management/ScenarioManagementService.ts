import { Observable, Subject } from "rxjs";
import { Scenario } from "src/main-layout/SessionWindow/SessionTab/SessionManagement/Scenarios/ScenarioDefs";
import { AppManagementService } from "../app-management/AppManagementService";
import { FileManagementService } from "../file-management/FileManagementService";
import { BaseClientFixSession, FixSession } from "../fix/FixSession";
import { BaseProfile } from "../profile/ProfileDefs";


export class ScenarioManagementService {
    private favoriteUpdateSubject = new Subject<void>();
    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {

    }

    private getDictionaryName(profile: BaseProfile) {
        return profile.dictionaryLocation.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, "");
    }

    getScenarioUpdateObservable(): Observable<any> {
        return this.favoriteUpdateSubject.asObservable()
    }

    async saveScenario(session: BaseClientFixSession, scenario: Scenario) {
        const dictionaryName = this.getDictionaryName(session.profile);
        let saveDirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/scenarios";

        if (session.getType() === "SERVER_SIDE_CLIENT") {
            saveDirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/server_scenarios";
        }
        try {
            await this.fileManager.createDir(saveDirPath);
            await this.fileManager.writeFile(`${saveDirPath}/${scenario.name}.json`, JSON.stringify(scenario.getDataToSave()));
            this.favoriteUpdateSubject.next();
        } catch (error) {
            return error
        }
    }

    async getAllScenarios(session: BaseClientFixSession): Promise<Scenario[]> {
        const dictionaryName = this.getDictionaryName(session.profile);        
        let dirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/scenarios";

        if (session.getType() === "SERVER_SIDE_CLIENT") {
            dirPath = this.appManager.getWorkingDir() + "/" + dictionaryName + "/server_scenarios";
        }

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