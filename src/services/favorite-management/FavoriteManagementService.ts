import { Observable, Subject } from "rxjs";
import { AppManagementService } from "../app-management/AppManagementService";
import { FileManagementService } from "../file-management/FileManagementService";
import { FixComplexType } from "../fix/FixDefs";
import { FixSession } from "../fix/FixSession";
import { ProfileWithCredentials } from "../profile/ProfileDefs";

export interface FavoriteInstance {
    msg: string,
    data: any
}

export class FavoriteManagementService {
    private favoriteUpdateSubject = new Subject<void>();
    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {

    }

    private getDictionaryName(profile: ProfileWithCredentials) {
        return profile.dictionaryLocation.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, "");
    }

    getFavoriteUpdateObservable(): Observable<any> {
        return this.favoriteUpdateSubject.asObservable()
    }

    async addToFavorites(profile: ProfileWithCredentials, messageDef: FixComplexType, name: string, data: any) {
        const dictionaryName = this.getDictionaryName(profile);
        const saveDirPath = this.appManager.getWorkingDir() + "/" + dictionaryName;
        try {
            await this.fileManager.createDir(saveDirPath);
            await this.fileManager.writeFile(`${saveDirPath}/${name}___${messageDef.name}.json`, JSON.stringify({ msg: messageDef.name, data }));
            this.favoriteUpdateSubject.next();
        } catch (error) {
            return error
        }
    }

    async deleteFavorite(profile: ProfileWithCredentials, messageDef: FixComplexType, name: string) {
        const dictionaryName = this.getDictionaryName(profile);
        const saveDirPath = this.appManager.getWorkingDir() + "/" + dictionaryName;
        try {
            await this.fileManager.createDir(saveDirPath);
            await this.fileManager.deleteFile(`${saveDirPath}/${name}___${messageDef.name}.json`);
            this.favoriteUpdateSubject.next();
        } catch (error) {
            return error
        }
    }

    async getAllFavorites(session: FixSession): Promise<{ name: string, msg: FixComplexType }[]> {
        const dictionaryName = this.getDictionaryName(session.profile);
        const dirPath = this.appManager.getWorkingDir() + "/" + dictionaryName;
        try {
            const data = await this.fileManager.listDirContent(dirPath);
            if (data.error) {
                throw data.error
            }

            const ret: { name: string, msg: FixComplexType }[] = [];
            if (data.files) {
                await Promise.all(data.files.map(async (file) => {
                    const fileName = file.replace(/\.[^/.]+$/, "");
                    const defName = fileName.split("___")[1]
                    const name = fileName.split("___")[0]
                    const msgInst = session.createNewMessageInst(defName);
                    if (msgInst) {
                        const inputFileData = await this.fileManager.readFile(`${dirPath}/${file}`);
                        if (inputFileData.fileData) {
                            const inst: FavoriteInstance = JSON.parse(inputFileData.fileData.data);
                            msgInst.setValue(inst.data)
                            ret.push({ name: name, msg: msgInst });
                        }
                    }
                }));
            }

            return ret.sort((msg1, msg2) => msg1.name.localeCompare(msg2.name));
        } catch (error) {
            throw error
        }
    }

    async getFavorite(name: string, session: FixSession): Promise<FixComplexType> {
        const dictionaryName = this.getDictionaryName(session.profile);
        const dirPath = this.appManager.getWorkingDir() + "/" + dictionaryName;
        try {
            const data = await this.fileManager.listDirContent(dirPath);
            if (data.error) {
                throw data.error
            }

            const ret: { name: string, msg: FixComplexType }[] = [];
            if (data.files) {
                await Promise.all(data.files.map(async (file) => {
                    const fileName = file.replace(/\.[^/.]+$/, "");
                    const defName = fileName.split("___")[1]
                    const name = fileName.split("___")[0]
                    const msgInst = session.createNewMessageInst(defName);
                    if (msgInst) {
                        const inputFileData = await this.fileManager.readFile(`${dirPath}/${file}`);
                        if (inputFileData.fileData) {
                            const inst: FavoriteInstance = JSON.parse(inputFileData.fileData.data);
                            msgInst.setValue(inst.data)
                            ret.push({ name: name, msg: msgInst });
                        }
                    }
                }));
            }

            return ret.filter((msg) => msg.name === name)[0]?.msg;
        } catch (error) {
            throw error
        }
    }

}