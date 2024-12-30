import { LM } from 'src/translations/language-manager';
import { GlobalServiceRegistry } from '../GlobalServiceRegistry';
import { ServerSocketInst } from '../socket-management/SocketManagementSevice';
import { ServerProfile } from '../profile/ProfileDefs';
import { ServerSideFixClientSession, SocketTimeOutError } from './FixSession';
import { Subject } from 'rxjs';
import moment from 'moment';

const { log } = console;


const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_server_session.${msg}`, options);
}

export class FixServerSession {
    private socket?: ServerSocketInst;
    private clients = new Map<number, ServerSideFixClientSession>()
    private updateSubject = new Subject<void>();
    private connected = false;
    private connectedTime: any;

    constructor(public readonly profile: ServerProfile) { }


    isLive() {
        return this.connected;
    }

    getClients() {
        return Array.from(this.clients.values())
    }

    getUpdateObservable() {
        return this.updateSubject.asObservable();
    }


    getConnectedTime() {
        if (this.connectedTime) {
            return moment(this.connectedTime).format("YYYY-MM-DD HH:mm:ss.000");
        }

        return "-"
    }

    destroy() {
        console.log("Server session destroyed");
        this.socket?.end();
    }

    async connect(): Promise<void> {
        const { port } = this.profile;

        this.socket = GlobalServiceRegistry.socket.createServerSocket(port);

        return new Promise(async (resolve, reject) => {
            try {

                await new Promise((resolve, reject) => {
                    log('server is started port: ' + port);
                    this.socket?.getSocketEventObservable().subscribe(event => {
                        switch (event.type) {
                            case "listening":
                                log(`server listening on (${this.profile.port})`);
                                this.connected = true;
                                this.connectedTime = Date.now();
                                resolve(this.socket);
                                break;
                            case "error":
                                log(`server failed to start on port (${this.profile.port})`, event.error);
                                this.connected = false;
                                reject(event.error ? new Error(event.error) : new SocketTimeOutError());
                                break;
                            case "client_connect":
                                if (event.client) {
                                    const client = new ServerSideFixClientSession(this.profile, event.client)
                                    this.clients.set(event.clId, client)
                                }
                                break;
                            case "client_disconnect":
                                const client = this.clients.get(event.clId)
                                if (client) {
                                    this.clients.delete(event.clId)
                                    client?.destroy();
                                }
                                break;
                            case "disconnect":
                                this.clients.forEach(client => client.destroy())
                                this.clients.clear();
                                this.connected = false;
                                break;
                        }

                        this.updateSubject.next();
                    })
                })
            } catch (error) {
                reject(error);
            }

            resolve();
        });
    }
}
