const { ipcMain } = require('electron')
const SocketManager = require('./socket-manager')

module.exports = (mainWindow) => {
  ipcMain.on('socketManagerOut', async (event, args) => {
    const id = args[1];
    let response;
    switch (args[0]) {
      case 'start_server':
        response = await SocketManager.createServerSocket(id, args[2], mainWindow)
        break
      case 'stop_server':
        response = await SocketManager.stopServerSocket(id, mainWindow)
        break
      case 'connect':
        response = await SocketManager.createSocket(id, args[2], args[3], args[4], mainWindow)
        break
      case 'disconnect':
        response = await SocketManager.disconnectSocket(id, mainWindow)
        break
      case 'write': 
        response = await SocketManager.write(id, args[2], mainWindow)
        break
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
