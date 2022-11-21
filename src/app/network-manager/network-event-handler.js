const { ipcMain } = require("electron");
const NetworkManager = require("./network-manager");

module.exports = (mainWindow) => {
  ipcMain.on("networkManagerOut", async (event, args) => {
    const requestId = args[1];
    let response;
    switch (args[0]) {
      case "get":
      case "post":
      case "put":
      case "delete":
        response = await NetworkManager.createRequest(args[2], args[3], args[4]);
        break;
      default:
        response = { error: `Unsupported operation received ${args[0]}` };
        break;
    }

    mainWindow.webContents.send("networkManagerIn", JSON.stringify({ ...response, requestId }));
  });
};
