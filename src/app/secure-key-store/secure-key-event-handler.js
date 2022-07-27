const { ipcMain } = require('electron')
const { addToStore, findInStore } = require('./secure-key-store')
module.exports = (mainWindow) =>
  ipcMain.on('secureKeyStoreOut', async (event, args) => {
    let response
    switch (args[0]) {
      case 'Add':
        response = await addToStore(args[1], args[2], args[3])
        break
      case 'Find':
        response = await findInStore(args[1])
        break
      default:
        response = {
          error: new Error(`Unsupported operation received ${args[0]}`),
        }
        break
    }

    mainWindow.webContents.send('secureKeyStoreIn', JSON.stringify(response))
  })
