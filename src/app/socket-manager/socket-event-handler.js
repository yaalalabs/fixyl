const { ipcMain } = require('electron')
const SocketManager = require('./socket-manager')

module.exports = (mainWindow) => {
  ipcMain.on('socketManagerOut', async (event, args) => {
    const id = args[1];
    let response;
    switch (args[0]) {
      case 'connect':
        response = await SocketManager.createSocket(id, args[2], args[3], mainWindow)
        break
      case 'disconnect':
        response = await SocketManager.disconnectSocket(id, mainWindow)
        break
      case 'write': 
        response = await SocketManager.write(id, args[2], mainWindow)
      default:
        response = {
          error: new Error(`Unsupported operation received ${args[0]}`),
        }
        break
    }

    mainWindow.webContents.send(
      'socketManagerIn',
      JSON.stringify({ ...response, id }),
    )
  })
}
