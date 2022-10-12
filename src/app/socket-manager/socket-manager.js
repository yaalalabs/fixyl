const Tls = require('tls');
const Net = require('net');
const crypto = require("crypto");
const fs = require('fs');

const { SSL_OP_NO_SSLv2, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1, SSL_OP_NO_TLSv1_1, SSL_OP_NO_TLSv1_2 } = require('constants');

module.exports = class SocketManager {
  static allSockets = {}

  static createSocket = async (id, ip, port, sslConfigs, mainWindow) => {
    try {
      this.disconnectSocket(id, mainWindow);
      
      const socket = await this.connect(id, ip, port, sslConfigs, mainWindow)
      this.allSockets[id] = socket
      return { id, type: 'connect' }
    } catch (err) {
      console.log(err);
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

  static isWinDestroyed = (mainWindow) => {
    return !mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents
  }

  static configureSSL = (sslConfigs, options) => {
    if (sslConfigs.sslServerName !== undefined && sslConfigs.sslServerName != "") {
      options.servername = sslConfigs.sslServerName
    }

    if (sslConfigs.sslCACertificate !== undefined && sslConfigs.sslCACertificate != "") {
      options.ca = [ fs.readFileSync(sslConfigs.sslCACertificate) ]
    }

    if (sslConfigs.sslCertificate !== undefined && sslConfigs.sslCertificate != "") {
      options.pfx = [ fs.readFileSync(sslConfigs.sslCertificate) ]
    }

    if (sslConfigs.sslCertificatePassword !== undefined && sslConfigs.sslCertificatePassword != "") {
      options.passphrase = sslConfigs.sslCertificatePassword
    }

    if (sslConfigs.sslProtocol !== undefined && sslConfigs.sslProtocol != "") {
      var cipherProtocols = [SSL_OP_NO_SSLv2, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1, SSL_OP_NO_TLSv1_1, SSL_OP_NO_TLSv1_2]
      if (sslConfigs.sslProtocol == "SSLv2") {
        cipherProtocols = cipherProtocols.filter(item => item !== SSL_OP_NO_SSLv2)
      }
      if (sslConfigs.sslProtocol == "SSLv3") {
        cipherProtocols = cipherProtocols.filter(item => item !== SSL_OP_NO_SSLv3)
      }
      if (sslConfigs.sslProtocol == "TLSv1") {
        cipherProtocols = cipherProtocols.filter(item => item !== SSL_OP_NO_TLSv1)
      }
      if (sslConfigs.sslProtocol == "TLSv1_1") {
        cipherProtocols = cipherProtocols.filter(item => item !== SSL_OP_NO_TLSv1_1)
      }
      if (sslConfigs.sslProtocol == "TLSv1_2") {
        cipherProtocols = cipherProtocols.filter(item => item !== SSL_OP_NO_TLSv1_2)
      }
      options.secureOptions = cipherProtocols.reduce((a, b) => a | b)
    }
    
    return options
  }

  static async  connect(id, host, port, sslConfigs, mainWindow) {
    return new Promise(async (resolve, reject) => { 
      var socket = undefined;     
      try {
        await new Promise((resolve, reject) => {
          try {
            var protocol = Net;
            var options = {
              host: host,
              port: port
            };

            if (sslConfigs.sslEnabled !== undefined && sslConfigs.sslEnabled) {
              console.log("==> attempting ssl connect", port, host)
              protocol = Tls;
              options = this.configureSSL(sslConfigs, options)
            } else {
              console.log("==> attempting to connect", port, host)
            }

            socket = protocol.connect(options, () => {
              console.log("==> connected", port, host)
              resolve()
            }).setEncoding('utf8')
              .on('data', (data) => {                
                if (this.isWinDestroyed(mainWindow)) {
                  return;
                }

                console.log("==> data", data)
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'data', data, id }),
                )
              })
              .on('end', () => {
                if (this.isWinDestroyed(mainWindow)) {
                  return;
                }

                console.log("==> end")
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'disconnect', id }),
                )
              })
              .on('error', (error) => {
                if (this.isWinDestroyed(mainWindow)) {
                  return;
                }
                
                console.log("==> error")
                console.log(error)
                mainWindow.webContents.send(
                  'socketManagerIn',
                  JSON.stringify({ type: 'error', error, id }),
                )
              })

              //resolve(socket)
          } catch (err) {
            console.log("==> error")
            console.log(err)
            reject({ err, type: 'error' })
          }
        })
      } catch (error) {
        reject({ error, type: 'error' })
      }
      resolve(socket)
    })
  }
}
