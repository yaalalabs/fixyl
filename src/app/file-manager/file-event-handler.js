const { ipcMain } = require("electron");
const FileManager = require("./file-manager");

module.exports = (mainWindow) => {
  ipcMain.on("fileManagerOut", async (event, args) => {
    const requestId = args[1];
    let response;
    switch (args[0]) {
      case "R":
        response = await FileManager.readFile(args[2]);
        break;
      case "W":
        response = await FileManager.writeFile(args[2], args[3]);
        break;
      case "D":
        response = await FileManager.deleteFile(args[2]);
        break;
      case "Select":
        response = await FileManager.selectFile(args[2]);
        break;
      case "mkdir":
        response = await FileManager.mkdir(args[2]);
        break;
      case "list":
        response = await FileManager.listFiles(args[2]);
        break;
      case "hasFile":
        response = await FileManager.hasFile(args[2]);
        break;
      default:
        response = {
          error: new Error(`Unsupported operation received ${args[0]}`),
        };
        break;
    }

    mainWindow.webContents.send(
      "fileManagerIn",
      JSON.stringify({ ...response, requestId })
    );
  });
};
