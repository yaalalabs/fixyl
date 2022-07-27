import moment from 'moment';
import { Observable, Subject, Subscription } from 'rxjs';
import { Toast } from 'src/common/Toast/Toast';
import { LM } from 'src/translations/language-manager';
import { GlobalServiceRegistry } from '../GlobalServiceRegistry';
import { ProfileWithCredentials } from '../profile/ProfileDefs';
import { SocketInst } from '../socket-management/SocketManagementSevice';
import { FixDefinitionParser, FixMessageDef } from './FixDefinitionParser';
import { DEFAULT_HB_INTERVAL, FixFieldDef, HBMonitor } from './FixDefs';

const { log } = console;

export enum GatewayType {
    TRADING = "TRADING",
    POST_TRADE = "POST_TRADE"
}

export class SocketTimeOutError extends Error {

    constructor() {
        super("ConnectionError")
        this.name = "SocketTimeOutError";
    }
}

export enum FixSessionEventType {
    READY,
    DISCONNECT,
    DATA
}

export interface FixSessionEvent {
    event: FixSessionEventType,
    data?: {
        direction: "IN" | "OUT",
        msg: FixMessage,
        timestamp: any,
        length: number,
        fixMsg: string,
        sequence: number
    }
}

export type FixMessage = FixMessageDef;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_session.${msg}`, options);
}

export class FixSession {
    private socket?: SocketInst;
    private connected = false;
    private parsetInitialized = false;
    private socketDataSubject = new Subject<FixSessionEvent>();
    private parser: FixDefinitionParser;
    private tx: number = 1;
    private rx: number = 0;
    private inputStream: string = "";
    private hbEnabled = true;
    private testRequestEnabled = true;
    private hbMonitor?: HBMonitor;
    private testRequestid = 1;
    private connectedTime: any;
    private isDestroyed = false;

    constructor(public readonly profile: ProfileWithCredentials) {
        this.parser = new FixDefinitionParser({
            path: profile.dictionaryLocation,
            transportDicPath: profile.transportDictionaryLocation,
            fixVersion: profile.fixVersion
        }, () => {
            this.parsetInitialized = true;
            this.evaluteAndSendReady();
        });
    }

    destroy() {
        this.parser.destroy();
        this.socket?.end();
        this.isDestroyed = true;
    }

    isSessionDestroyed() {
        return this.isDestroyed;
    }

    getProfile(): ProfileWithCredentials {
        return this.profile;
    }

    getAllMessageDefs(): FixMessageDef[] {
        return this.parser.getAllMessageDefs();
    }

    getMessageDef(name: string): FixMessageDef | undefined {
        return this.parser.getMessageDef(name);
    }

    getFieldDef(name: string): FixFieldDef | undefined {
        return this.parser.getFieldDef(name)
    }

    createNewMessageInst(defName: string): FixMessage | undefined {
        const def = this.getMessageDef(defName);
        if (def) {
            return def.clone();
        }

        return undefined;
    }

    enableHB(state: boolean) {
        this.hbEnabled = state;
    }

    enableTestRequest(state: boolean) {
        this.testRequestEnabled = state;
    }

    getConnectedTime() {
        if (this.connectedTime) {
            return moment(this.connectedTime).format("YYYY-MM-DD HH:mm:ss.000");
        }

        return "-"
    }

    isHBEnabled() {
        return this.hbEnabled
    }

    isTestRequestEnabled() {
        return this.testRequestEnabled;
    }

    private onData(data: string) {
        this.hbMonitor?.resetHB();

        this.inputStream += data;
        let messages: string[] = [];
        let length = this.parser.extractMessages(this.inputStream, messages);
        if (length > 0) {
            this.inputStream = this.inputStream.substring(length);
        }

        messages.forEach(msg => {
            const msgInst = this.parser.decodeFixMessage(msg);
            this.rx++;

            if (msgInst) {
                this.evaliateInputMesssage(msgInst.msg);

                this.socketDataSubject.next({
                    event: FixSessionEventType.DATA, data: {
                        direction: "IN",
                        msg: msgInst.msg,
                        length: msg.length,
                        timestamp: Date.now(),
                        fixMsg: msg,
                        sequence: msgInst.header.sequence
                    }
                })
            }
        });
    }

    private onDisconnect() {
        log('(' + this.profile.name + ') disconnected');
        this.connected = false;
        this.socketDataSubject.next({ event: FixSessionEventType.DISCONNECT })
        Toast.error(getIntlMessage("msg_disconnect", { name: this.profile.name, ip: this.profile.ip }))
    }

    getFixEventObservable(): Observable<FixSessionEvent> {
        return this.socketDataSubject.asObservable();
    }

    isReady() {
        return this.connected && this.parsetInitialized;
    }

    async connect(): Promise<void> {
        const { ip, port } = this.profile;
        this.socket = GlobalServiceRegistry.socket.createSocket(ip, port);

        return new Promise(async (resolve, reject) => {
            try {

                await new Promise((resolve, reject) => {
                    log('(' + this.profile.name + ') connecting to ' + ip + ':' + port);
                    this.socket?.getSocketEventObservable().subscribe(event => {
                        switch (event.type) {
                            case "connect":
                                log('(' + this.profile.name + ') connected');
                                this.connected = true;
                                this.evaluteAndSendReady();
                                this.connectedTime = Date.now();
                                resolve(this.socket);
                                break;
                            case "error":
                                log('(' + this.profile.name + ') connection error');
                                this.connected = false;
                                this.socketDataSubject.next({ event: FixSessionEventType.DISCONNECT })
                                reject(new SocketTimeOutError());
                                break;
                            case "disconnect":
                                this.onDisconnect();
                                break;
                            case "data":
                                this.onData(event.data);
                                break;
                        }
                    })
                })
            } catch (error) {
                reject(error);
            }

            resolve();
        });
    }

    private evaluteAndSendReady() {
        if (this.isReady()) {
            this.socketDataSubject.next({ event: FixSessionEventType.READY })
        }
    }

    public send(msgDef: FixMessageDef, parameters?: any): Promise<any> {
        this.evaliateOutputMesssage(msgDef);
        const data = this.encodeToFix(msgDef, parameters);

        this.socket?.write(data);
        return new Promise(async (resolve, reject) => {
            let sub: Subscription | undefined;

            try {
                const result = await new Promise((resolve, reject) => {
                    sub = this.socket?.getSocketEventObservable().subscribe(event => {
                        if (event.type === "result") {
                            const msgInst = this.parser.decodeFixMessage(data);

                            if (msgInst) {
                                this.socketDataSubject.next({
                                    event: FixSessionEventType.DATA, data: {
                                        direction: "OUT",
                                        msg: msgInst.msg as any,
                                        length: data.length,
                                        timestamp: Date.now(),
                                        fixMsg: data,
                                        sequence: msgInst.header.sequence
                                    }
                                })
                            }

                            resolve(event.result)
                        }
                    })
                })

                if (result) {
                    this.tx++;
                }

                sub?.unsubscribe();
                resolve(result);
            } catch (error) {
                sub?.unsubscribe();
                reject(error);
            }
        });
    }

    private evaliateInputMesssage = (msg: FixMessageDef) => {
        switch (msg.name.toLowerCase()) {
            case "test_request":
                this.sendHB();
                break;
            case "logon":
                this.hbMonitor?.startHBTimer();
                break;
            case "logout":
                this.disconnect(true);
                const data = msg.getValue();
                Toast.error(data.Text);
                break;

        }
    }

    private evaliateOutputMesssage = (msg: FixMessageDef) => {
        switch (msg.name.toLowerCase()) {
            case "logon":
                const data = msg.getValue();
                if (data.ResetSeqNumFlag) {
                    this.tx = 1;
                    this.testRequestid = 1;
                }

                this.hbMonitor?.stopHBTimer();

                const interval = Number(msg.getValue()["HeartBtInt"] ?? DEFAULT_HB_INTERVAL);
                this.hbMonitor = new HBMonitor(this.sendTestRequest, this.disconnect, this.sendHB, interval);
                break;
        }
    }

    private sendHB = (data?: any) => {
        if (!this.hbEnabled) {
            return;
        }

        const msg = this.createNewMessageInst("Heartbeat");
        if (msg) {
            msg.setValue(data ?? {})
            this.send(msg);
        }
    }

    private sendTestRequest = () => {
        if (!this.testRequestEnabled) {
            return;
        }

        const msg = this.createNewMessageInst("TestRequest");
        if (msg) {
            msg.setValue({ TestReqID: this.testRequestid++ });
            this.send(msg);
        }
    }

    public disconnect = async (dontSendMsg?: boolean) => {
        const msg = this.createNewMessageInst("Logout");
        if (!dontSendMsg && msg) {
            msg.setValue({ Text: this.testRequestid++ });
            this.send(msg);
        }
        await this.socket?.end();
        // await new Promise(result => setTimeout(result, 2500));
        // await this.socket.destroy();
        // this.connected = false;
        // await new Promise(result => setTimeout(result, 2500));
        // debug('(' + this.profile.name + ') disconnected');
    }

    public encodeToFix = (msgDef: FixMessageDef, parameters?: any): string => {
        return this.parser.encodeToFix(msgDef.getValue(), {
            msgType: msgDef.id,
            senderCompId: this.profile.senderCompId,
            targetCompId: this.profile.targetCompId,
            sequence: this.tx,
            time: moment(new Date()).utc().format("YYYYMMDD-HH:mm:ss.000")
        }, parameters)
    }

    public decodeFixMessage = (msg: string) => {
        return this.parser.decodeFixMessage(msg)?.msg
    }
}
