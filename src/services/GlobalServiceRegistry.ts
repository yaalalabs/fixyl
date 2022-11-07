
import { CommonServiceFactory } from "./CommonServiceFactory";
import { AppManagementService } from "./app-management/AppManagementService";
import { FixSessionManagementService } from "./fix/FixSessionManagementService";
import { NavigationService } from "./navigation/NevigationService";
import { ProfileManagementService } from "./profile/ProfileManagementService";
import { FileManagementService } from "./file-management/FileManagementService";
import { SocketManagementSevice } from "./socket-management/SocketManagementSevice";
import { FavoriteManagementService } from "./favorite-management/FavoriteManagementService";
import { ScenarioManagementService } from "./scenario-management/ScenarioManagementService";
import { NetworkService } from "./network/NetworkService";


export class GlobalServiceRegistry {

    // Note There shouldn't be constructor level dependancies in these services
    // If there is some dependent logic move it to GlobalInitializer
    public static fileManger: FileManagementService = CommonServiceFactory.instance.createNewFileManagementService();
    public static appManager: AppManagementService = CommonServiceFactory.instance.createNewAppManagementService(this.fileManger);
    public static network: NetworkService = CommonServiceFactory.instance.createNetworkService();
    public static profile: ProfileManagementService = CommonServiceFactory.instance.createNewProfileManagerService(this.appManager, this.fileManger);
    public static fix: FixSessionManagementService = CommonServiceFactory.instance.createNewFixSessionManagementService();
    public static navigation: NavigationService = CommonServiceFactory.instance.createNewNavigationService();
    public static socket: SocketManagementSevice = CommonServiceFactory.instance.createSocketManagementService();
    public static favoriteManager: FavoriteManagementService = CommonServiceFactory.instance.createFavoriteManagementService(this.appManager, this.fileManger);
    public static scenarioManager: ScenarioManagementService = CommonServiceFactory.instance.createScenarioManagementService(this.appManager, this.fileManger);
}



