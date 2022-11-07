import { AppManagementService } from "./app-management/AppManagementService";
import { FixSessionManagementService } from "./fix/FixSessionManagementService";
import { NavigationService } from "./navigation/NevigationService";
import { ProfileManagementService } from "./profile/ProfileManagementService";
import { FileManagementService } from "./file-management/FileManagementService";
import { SocketManagementSevice } from "./socket-management/SocketManagementSevice";
import { FavoriteManagementService } from "./favorite-management/FavoriteManagementService";
import { ScenarioManagementService } from "./scenario-management/ScenarioManagementService";
import { NetworkService } from "./network/NetworkService";

export class CommonServiceFactory {
  public static instance = new CommonServiceFactory();

  createNewProfileManagerService(appManager: AppManagementService, fileManager: FileManagementService): ProfileManagementService {
    return new ProfileManagementService(appManager, fileManager);
  }

  createNewFixSessionManagementService(): FixSessionManagementService {
    return new FixSessionManagementService();
  }

  createNewAppManagementService(fileManager: FileManagementService): AppManagementService {
    return new AppManagementService(fileManager);
  }

  createNewNavigationService(): NavigationService {
    return new NavigationService();
  }

  createNewFileManagementService(): FileManagementService {
    return new FileManagementService();
  }

  createSocketManagementService(): SocketManagementSevice {
    return new SocketManagementSevice();
  }

  createFavoriteManagementService(appManager: AppManagementService, fileManager: FileManagementService): FavoriteManagementService {
    return new FavoriteManagementService(appManager, fileManager);
  }

  createScenarioManagementService(appManager: AppManagementService, fileManager: FileManagementService): ScenarioManagementService {
    return new ScenarioManagementService(appManager, fileManager);
  }

  createNetworkService(): NetworkService {
    return new NetworkService();
  }
}
