export interface FileResponse {
  requestId: number;
  fileData?: {
    data: string;
    lastUpdatedTime: string;
    size: number;
  };
  error?: Error;
  status?: boolean;
  files?: string[]
}
export class FileManagementService {
  private fileApi = (window as any).api;
  private requestId = 0;
  private requestMap = new Map<number, any>();

  constructor() {
    this.fileApi.receive("fileManagerIn", (data: string) => {
      const inputData = JSON.parse(data) as FileResponse;
      this.requestMap.get(inputData.requestId)?.(inputData);
    });
  }

  private createFilePromise(requestId: number) {
    return new Promise<FileResponse>((resolve) => {
      this.requestMap.set(requestId, resolve);
    });
  }

  public hasFile(filePath: string): Promise<FileResponse> {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["hasFile", requestId, filePath]);
    return this.createFilePromise(requestId);
  }

  public readFile(filePath: string): Promise<FileResponse> {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["R", requestId, filePath]);
    return this.createFilePromise(requestId);
  }

  public writeFile(filePath: string, fileContent: string): Promise<FileResponse> {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["W", requestId, filePath, fileContent]);
    return this.createFilePromise(requestId);
  }

  public deleteFile(filePath: string): Promise<FileResponse> {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["D", requestId, filePath]);
    return this.createFilePromise(requestId);
  }

  public selectFile(options?: any): Promise<any> {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["Select", requestId, options]);
    return this.createFilePromise(requestId);
  }

  public createDir(path: string) {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["mkdir", requestId, path]);
    return this.createFilePromise(requestId);
  }

  public listDirContent(path: string) {
    const requestId = this.requestId++;
    this.fileApi.send("fileManagerOut", ["list", requestId, path]);
    return this.createFilePromise(requestId);
  }
}
