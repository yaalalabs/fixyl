const { net } = require("electron");

module.exports = class NetworkManager {

  static createRequest = (options, body, headers) => {
    return new Promise((resolve) => {
      const request = net.request(options);

      if (body) {
        request.write(body);
      }

      if (headers) {
        for(const headerName in headers) {
          request.setHeader(headerName, headers[headerName]);
        }
      }

      request.on('response', (response) => {
        const bufferArray = [];

        response.on('data', (chunk) => {
          bufferArray.push(chunk);
        });
        response.on('end', () => {
          const responseData = Buffer.concat(bufferArray).toString();
          resolve({ payload: responseData });
        })
        response.on('error', (error) => {
          console.log('Network manager error occurred', error);
          resolve({ error: error.message });
        });
      })

      request.on('error', (error) => {
        console.log('Network manager error occurred', error);
        resolve({ error: error.message });
      });

      request.end();
    });
  }
};
