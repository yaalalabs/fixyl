const Net = require('net');

module.exports = class SocketManager {
  static allSockets = {}

  static createSocket = async (id, ip, port, mainWindow) => {
    try {
      this.disconnectSocket(id, mainWindow);
      
      const socket = await this.connect(id, ip, port, mainWindow)
      this.allSockets[id] = socket
      return { id, type: 'connect' }
    } catch (err) {
      return err
    }
  }

  static disconnectSocket = async (id, mainWindow) => {
    if (this.allSockets[id]) {
      this.allSockets[id].end()
    }
  }

  static write = async (id, data, mainWindow) => {
    if (this.allSockets[id]) {
      console.log("==> send", data)
      const result = this.allSockets[id].write(data)
      mainWindow.webContents.send(
        'socketManagerIn',
        JSON.stringify({ type: 'result', result, id }),
      )
    }
  }

  static async  connect(id, host, port, mainWindow) {
    return new Promise(async (resolve, reject) => {
      const socket = new Net.Socket()
      try {
        await new Promise((resolve, reject) => {
          try {
            socket
              .connect(port, host, () => {
                console.log("==> connected", port, host)
                resolve()
              })
              .setEncoding('utf8')
              .on('data', (data) => {
                console.log("==> data", data)
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'data', data, id }),
                )
              })
              .on('end', () => {
                console.log("==> end")
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'disconnect', id }),
                )
              })
              .on('error', (error) => {
                console.log("==> error")
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'error', error, id }),
                )
              })
          } catch (err) {
            reject({ error, type: 'error' })
          }
        })
      } catch (error) {
        reject({ error, type: 'error' })
      }

      resolve(socket)
    })
  }
}
