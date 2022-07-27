
export class SecureKeyManager {
  private api = (window as any).api;

  public addKey(service: string, key: string, value: string): Promise<any> {
    // this.api.send("secureKeyStoreOut", ["Add", service, key, value]);

    return new Promise<any>((resolve) => {
      localStorage.setItem(service, JSON.stringify({ account: key, password: value }));
      resolve({})
      // this.api.receive("secureKeyStoreIn", (data: string) => {
      //   resolve(JSON.parse(data));
      // });
    });
  }

  public findKeyForService(service: string): Promise<any> {
    // this.api.send("secureKeyStoreOut", ["Find", service]);

    return new Promise<any>((resolve) => {

      const item = localStorage.getItem(service);
      resolve(item ? JSON.parse(item) : undefined)
      // this.api.receive("secureKeyStoreIn", (data: string) => {
      //   resolve(JSON.parse(data));
      // });
    });
  }
}
