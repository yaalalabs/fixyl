import {AppManagementService} from "./app-management/AppManagementService";
import {FileManagementService} from "./file-management/FileManagementService";
import { Parameters } from "./fix/FixSession";

export class GlobalParameterService {
    private globalParams: Parameters = {};

    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {
        if (this.appManager.getWorkingDir()) {
            this.loadGlobalParametersFromDevice();
        }
    }
    
    getGlobalParameters(): Parameters {
        return this.globalParams;
    }

    setGlobalParameter(param: string, value: any) {
        this.globalParams[param] = { value };
        this.saveGlobalParametersInDevice();
    }

    removeGlobalParameter(param: string) {
        delete this.globalParams[param];
        this.saveGlobalParametersInDevice();
    }

    private saveGlobalParametersInDevice() {
        this.fileManager.writeFile(this.appManager.getGlobalParametersFile(), JSON.stringify(this.globalParams));
    }

    private async loadGlobalParametersFromDevice() {
        this.globalParams = await new Promise(async (resolve) => {
            try {
                const data = await this.fileManager.readFile(this.appManager.getGlobalParametersFile());
                if (data.fileData) {
                    resolve(JSON.parse(data.fileData.data))
                } else {
                    resolve({})
                }
            } catch (err) {
                resolve({})
            }
        });
    }
}