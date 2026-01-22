const { ipcMain } = require("electron");

module.exports = (mainWindow) => {
  ipcMain.on("logManagerOut", async (event, args) => {
    switch (args[0]) {
      case "log":
        console.log(args[1], ...args.slice(2));
        break;
      case "info":
        console.info(args[1], ...args.slice(2));
        break;
      case "warn":
        console.warn(args[1], ...args.slice(2));
        break;
      case "error":
        console.error(args[1], ...args.slice(2));
        break;
      default:
        console.log(args[1], ...args.slice(2));
        break;
    }
  });
};
