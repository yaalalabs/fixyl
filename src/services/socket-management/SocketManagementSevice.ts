import { Observable, Subject } from "rxjs";

export interface SocketEvent {
  type: "connect" | "disconnect" | "data" | "error" | "result"
  id: number;
  data?: any;
  error?: any;
  result?: any;
}

export interface SocketSSLConfigs {
  sslEnabled?: boolean;
  sslServerName?: string;
  sslCACertificate?: string;
  sslCertificate?: string;
  sslCertificatePassword?: string;
  sslProtocol?: string;
}

export class SocketInst {
  private socketEventSubject = new Subject<SocketEvent>()
  private api = (window as any).api;
  constructor(public ip: string, public port: number, public id: number) {

  }

  publishSocketEvent(event: SocketEvent) {
    this.socketEventSubject.next(event)
  }

  getSocketEventObservable(): Observable<SocketEvent> {
    return this.socketEventSubject.asObservable();
  }

  async write(data: any) {
    this.api.send("socketManagerOut", ["write", this.id, data]);
  }

  async end() {
    this.api.send("socketManagerOut", ["disconnect", this.id]);
  }
}


export class SocketManagementSevice {
  private api = (window as any).api;
  private socketMap = new Map<number, SocketInst>();
  private currentSocketId = 0;

  constructor() {
    this.api.receive("socketManagerIn", (data: string) => {
      const event = JSON.parse(data) as SocketEvent;
      const socket = this.socketMap.get(event.id);
      socket?.publishSocketEvent(event);

      if (socket && event.type === "disconnect") {
        this.socketMap.delete(event.id);
      }
    });
  }

  public createSocket(ip: string, port: number, sslConfigs: SocketSSLConfigs): SocketInst {
    const id = this.currentSocketId++;
    const socket = new SocketInst(ip, port, id);
    this.socketMap.set(id, socket);

    this.api.send("socketManagerOut", ["connect", id, ip, port, sslConfigs]);
    return socket;
  }

  public disconnectSocket(socket: SocketInst) {
    if (this.socketMap.has(socket.id)) {
      this.api.send("socketManagerOut", ["disconnect", socket.id]);
    }
  }

}
