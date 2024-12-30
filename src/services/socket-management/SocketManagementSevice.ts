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

export interface ServerSocketEvent {
  type: "listening" | "disconnect" | "client_connect" | "client_data" | "client_error" | "client_disconnect" | "error"
  id: number;
  clId: number
  error?: any;
  data?: any;
  client?: SocketInst;
}

export class ServerSocketInst {
  private socketEventSubject = new Subject<ServerSocketEvent>()
  private serverSideClientMap = new Map<number, SocketInst>()
  private api = (window as any).api;

  constructor(public port: number, public id: number) {

  }

  publishSocketEvent(event: ServerSocketEvent) {
    this.socketEventSubject.next(event)
  }

  getSocketEventObservable(): Observable<ServerSocketEvent> {
    return this.socketEventSubject.asObservable();
  }

  async end() {
    this.api.send("socketManagerOut", ["stop_server", this.id]);
  }
}



export class SocketManagementSevice {
  private api = (window as any).api;
  private socketMap = new Map<number, SocketInst | ServerSocketInst>();
  private currentSocketId = 0;

  constructor() {
    this.api.receive("socketManagerIn", (data: string) => {
      const event = JSON.parse(data);
      const socket = this.socketMap.get(event.id);

      if (!(socket instanceof ServerSocketInst)) {
        socket?.publishSocketEvent(event);

        if (socket && event.type === "disconnect") {
          this.socketMap.delete(event.id);
        }
      }

      switch (event.type) {
        case "client_connect": {
          const sock = new SocketInst("", 0, event.clId)
          this.socketMap.set(event.clId, sock)
          event.client = sock;
          socket?.publishSocketEvent(event);
        } break;
        case "client_disconnect": {
          const sock = this.socketMap.get(event.clId)
          this.socketMap.delete(event.clId)
          socket?.publishSocketEvent(event);
          (sock ? sock as SocketInst : undefined)?.publishSocketEvent({ id: event.clId, type: "disconnect" })
        } break;
        case "client_error": {
          const sock = this.socketMap.get(event.clId)
          this.socketMap.delete(event.clId)
          socket?.publishSocketEvent(event);
          (sock ? sock as SocketInst : undefined)?.publishSocketEvent({ id: event.clId, type: "error", error: event.error })
        } break;
        case "client_data": {
          const sock = this.socketMap.get(event.clId);
          (sock ? sock as SocketInst : undefined)?.publishSocketEvent({ id: event.clId, type: "data", data: event.data })
        } break;
        case "disconnect":
          socket?.publishSocketEvent(event);
          this.socketMap.delete(event.id);
          break;
        default:
          socket?.publishSocketEvent(event);
          break;
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

  public createServerSocket(port: number): ServerSocketInst {
    const id = this.currentSocketId++;
    const socket = new ServerSocketInst(port, id);
    this.socketMap.set(id, socket);

    this.api.send("socketManagerOut", ["start_server", id, port]);
    return socket;
  }

  public disconnectServerSocket(socket: SocketInst) {
    if (this.socketMap.has(socket.id)) {
      this.api.send("socketManagerOut", ["stop_server", socket.id]);
    }
  }

  public disconnectSocket(socket: SocketInst) {
    if (this.socketMap.has(socket.id)) {
      this.api.send("socketManagerOut", ["disconnect", socket.id]);
    }
  }

}
