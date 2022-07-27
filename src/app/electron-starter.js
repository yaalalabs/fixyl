const { app, BrowserWindow, ipcMain } = require('electron')
const isDev = require('electron-is-dev')

const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow


function initModules(mainWindow) {
  require("./file-manager/file-event-handler")(mainWindow)
  require("./secure-key-store/secure-key-event-handler")(mainWindow)
  require("./socket-manager/socket-event-handler")(mainWindow)
}
// ipcMain.on('ipc-example', async (event, arg) => {
//     const msgTemplate =  `IPC test: ${pingPong}`;
//     console.log(msgTemplate(arg));
//     event.reply('ipc-example', msgTemplate('pong'));
//   });
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // and load the index.html of the app.
  const startUrl = isDev
    ? process.env.ELECTRON_START_URL || 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../build/index.html')}`
  mainWindow.loadURL(startUrl)
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  initModules(mainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})
