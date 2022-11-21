export interface NetworkResponse {
  requestId: number;
  payload?: any;
  error?: Error;
}

interface ResponseHandler {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export class NetworkService {
  private networkApi = (window as any).api;
  private requestId = 0;
  private requestMap = new Map<number, ResponseHandler>();

  constructor() {
    this.initNetworkEventHandler();
  }

  private initNetworkEventHandler() {
    this.networkApi.receive("networkManagerIn", (data: string) => {
      try {
        const parsedResponse = JSON.parse(data) as NetworkResponse;

        if (parsedResponse.payload) {
          parsedResponse.payload = JSON.parse(parsedResponse.payload);
          this.requestMap.get(parsedResponse.requestId)?.resolve(parsedResponse);
        }
        else if (parsedResponse.error) {
          this.requestMap.get(parsedResponse.requestId)?.reject(parsedResponse);
        }
        else {
          console.log('Unsupported response in network service.', parsedResponse);
        }
      } catch (error) {
        console.log('Failed to parse response in network service.', error);
      }
    });
  }

  private createNetworkPromise(requestId: number) {
    return new Promise<NetworkResponse>((resolve, reject) => {
      this.requestMap.set(requestId, { resolve, reject });
    });
  }

  private createHTTPPromise(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: any, headers?: any) {
    const requestId = this.requestId++;
    this.networkApi.send("networkManagerOut", [method.toLowerCase(), requestId, { method, url }, body, headers]);
    return this.createNetworkPromise(requestId);
  }

  get(url: string, body?: any, headers?: any) {
    return this.createHTTPPromise('GET', url, body, headers);
  }

  post(url: string, body?: any, headers?: any) {
    return this.createHTTPPromise('POST', url, body, headers);
  }

  put(url: string, body?: any, headers?: any) {
    return this.createHTTPPromise('PUT', url, body, headers);
  }

  delete(url: string, body?: any, headers?: any) {
    return this.createHTTPPromise('DELETE', url, body, headers);
  }
}