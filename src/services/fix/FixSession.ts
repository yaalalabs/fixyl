import moment from 'moment';
import { Observable, Subject, Subscription } from 'rxjs';
import { Toast } from 'src/common/Toast/Toast';
import { LM } from 'src/translations/language-manager';
import { deepCopyObject } from 'src/utils/utils';
import { GlobalServiceRegistry } from '../GlobalServiceRegistry';
import { BaseProfile, Profile, ProfileWithCredentials, ServerProfile, ServerSideClientProfile } from '../profile/ProfileDefs';
import { SocketInst, SocketSSLConfigs } from '../socket-management/SocketManagementSevice';
import { FixDefinitionParser, FixMessageDef, FixMsgHeader } from './FixDefinitionParser';
import { DEFAULT_HB_INTERVAL, FixComplexType, FixFieldDef, HBMonitor } from './FixDefs';
import { LogService } from '../log-management/LogService';

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

export interface Parameter {
    value: any;
    count?: number;
}

export type Parameters = { [key: string]: Parameter };

export type FixMessage = FixMessageDef;

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_session.${msg}`, options);
}


export abstract class BaseClientFixSession {
    protected type: "SERVER_SIDE_CLIENT" | "CLIENT" = "CLIENT"
    protected socket?: SocketInst;
    protected connected = false;
    protected parserInitialized = false;
    protected socketDataSubject = new Subject<FixSessionEvent>();
    protected parser: FixDefinitionParser;

    protected txLock: Promise<any>;
    protected tx: number = 1;
    protected rx: number = 1;
    protected inputStream: string = "";
    protected hbMonitor?: HBMonitor;
    protected testRequestid = 1;
    protected connectedTime: any;
    protected isDestroyed = false;
    protected hbEnabled = true;
    protected testRequestEnabled = true;
    protected autoLoginEnabled = false;
    protected sequenceResetRequestEnabled = false;
    protected resendRequestEnabled = false;
    protected sessionParams: Parameters = {};
    protected socketDataEventHistory: FixSessionEvent[] = []

    protected resendCache = new Map<number, { msgDef: FixComplexType, header: FixMsgHeader, parameters?: Parameters }>();

    constructor(public readonly profile: BaseProfile) {
        this.txLock = Promise.resolve();

        this.parser = new FixDefinitionParser({
            path: profile.dictionaryLocation,
            transportDicPath: profile.transportDictionaryLocation,
            fixVersion: profile.fixVersion
        }, () => {
            this.parserInitialized = true;
            this.evaluteAndSendReady();
        });

        this.initAutoSessionControlInfo();
    }

    protected initAutoSessionControlInfo() {
        this.autoLoginEnabled = !!this.profile.autoLoginEnabled && !!this.profile.autoLoginMsg;
        this.sequenceResetRequestEnabled = !!this.profile.sequenceResetRequestEnabled;
        this.resendRequestEnabled = !!this.profile.resendRequestEnabled;
        this.sessionParams = this.profile.sessionParams ? this.profile.sessionParams : {};
    }

    protected publishSocketEvent(event: FixSessionEvent) {
        this.socketDataEventHistory.push(event)
        this.socketDataSubject.next(event)
    }

    getEventHistory() {
        return this.socketDataEventHistory;
    }

    getSocket() {
        return this.socket;
    }

    getType() {
        return this.type
    }

    getSessionParameters(includeGlobal: boolean): Parameters {
        return includeGlobal ? { ...GlobalServiceRegistry.globalParamsManager.getGlobalParameters(), ...this.sessionParams } : this.sessionParams;
    }

    setSessionParameter(param: string, value: any) {
        this.sessionParams[param] = { value };
        this.profile.sessionParams = this.sessionParams;
        this.updateProfile();
    }

    removeSessionParameter(param: string) {
        delete this.sessionParams[param];
        this.profile.sessionParams = this.sessionParams;
        this.updateProfile();
    }

    destroy() {
        LogService.log("Session destroyed");
        this.parser.destroy();
        this.socket?.end();
        this.isDestroyed = true;
    }

    isSessionDestroyed() {
        return this.isDestroyed;
    }

    getProfile(): BaseProfile {
        return this.profile;
    }

    getFixEventObservable(): Observable<FixSessionEvent> {
        return this.socketDataSubject.asObservable();
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

    enableAutoLogin(state: boolean, preferedLoginMsg: any) {
        this.autoLoginEnabled = state;
        this.profile.autoLoginEnabled = state;
        this.profile.autoLoginMsg = preferedLoginMsg;
        this.updateProfile();
    }

    enableSequenceResetRequest(state: boolean) {
        this.sequenceResetRequestEnabled = state;
        this.profile.sequenceResetRequestEnabled = state;
        this.updateProfile();
    }

    enableResendRequest(state: boolean) {
        this.resendRequestEnabled = state;
        this.profile.resendRequestEnabled = state;
        this.updateProfile();
    }

    protected abstract updateProfile(): void;

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

    isAutoLoginEnabled() {
        return this.autoLoginEnabled;
    }

    isSequenceResetRequestEnabled() {
        return this.sequenceResetRequestEnabled;
    }

    isResendRequestEnabled() {
        return this.resendRequestEnabled;
    }

    isReady() {
        return this.connected && this.parserInitialized;
    }

    protected async evaluteAndSendReady() {
        if (this.isReady()) {
            this.publishSocketEvent({ event: FixSessionEventType.READY })
            if (this.autoLoginEnabled && this.profile.autoLoginMsg) {
                try {
                    const loginMsg = await GlobalServiceRegistry.favoriteManager.getFavorite(this.profile.autoLoginMsg, this);
                    if (loginMsg) {
                        this.send(loginMsg)
                    }
                } catch (error) {
                    console.error("Error occurred while sending auto login message", { error })
                }
            }
        }
    }

    protected async acquireLock(): Promise<() => void> {
        let releaseLock: () => void;
        const nextLock = new Promise<void>(resolve => {
            releaseLock = resolve; // capture the resolver to release the lock
        });
        await this.txLock; // wait for the current lock to resolve
        this.txLock = nextLock;
        return releaseLock!; // return the resolver function to release the lock
    }

    public async send(msgDef: FixMessageDef, parameters?: Parameters): Promise<any> {
        this.evaluateOutputMessage(msgDef);
        const releaseLock = await this.acquireLock(); // accuire lock
        try {
            const header = this.generateFixMessageHeaders(msgDef, this.tx);
            const result = await this.sendInternal(header, msgDef, parameters);
            if (result) {
                if (this.resendRequestEnabled) {
                    this.resendCache.set(this.tx, {
                        msgDef, header,
                        parameters: parameters ? deepCopyObject(parameters) : undefined
                    });
                }

                this.tx++;
            }
        } catch (error) {
            throw error;
        } finally {
            releaseLock()
        }
    }

    protected sendInternal(header: FixMsgHeader, msgDef: FixMessageDef, parameters?: Parameters, additionalHeaders?: any): Promise<any> {
        const data = this.encodeToFix(header, msgDef, parameters, additionalHeaders);

        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.writeToSocket(data)
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    protected writeToSocket = (data: string) => {
        this.socket?.write(data);
        return new Promise((resolve, reject) => {
            let sub: Subscription | undefined;
            try {
                sub = this.socket?.getSocketEventObservable().subscribe(event => {
                    if (event.type === "disconnect") {
                        sub?.unsubscribe();
                        reject(new Error("socket closed"));
                    } else if (event.type === "result") {
                        const msgInst = this.parser.decodeFixMessage(data);
                        if (msgInst) {
                            this.publishSocketEvent({
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
                        sub?.unsubscribe();
                        resolve(event.result)
                    }
                })
            } catch (error) {
                sub?.unsubscribe();
                reject(error);
            }
        })
    }

    protected evaluateInputMessage = (msg: FixMessageDef) => {
        switch (msg.name.toLowerCase()) {
            case "testrequest":
                this.sendHB();
                break;
            case "logon":
                this.hbMonitor?.startHBTimer();
                break;
            case "resendrequest":
                this.onResendRequest(msg);
                break;
            case "logout":
                this.disconnect(true);
                const data = msg.getValue();
                if (data.Text) {
                    Toast.error("Logout message: " + data.Text);
                }
                break;

        }
    }

    protected evaluateOutputMessage = (msg: FixMessageDef) => {
        switch (msg.name.toLowerCase()) {
            case "logon":
                const data = msg.getValue();
                if (data.ResetSeqNumFlag === "Y") {
                    this.tx = 1;
                    this.rx = 1;
                    this.testRequestid = 1;
                }

                this.hbMonitor?.stopHBTimer();

                const interval = Number(msg.getValue()["HeartBtInt"] ?? DEFAULT_HB_INTERVAL);
                this.hbMonitor = new HBMonitor(this.sendTestRequest, this.disconnect, this.sendHB, interval);
                break;
        }
    }

    protected onResendRequest = (msg: FixMessageDef) => {
        const beginSeqNo = msg.getFieldValue("BeginSeqNo");
        const endSeqNo = msg.getFieldValue("EndSeqNo");

        if (beginSeqNo && endSeqNo) {
            const trueEnd = Number(endSeqNo) === 0 ? this.tx - 1 : endSeqNo;

            let adminSeqStart = -1;
            for (var i = Number(beginSeqNo); i <= trueEnd; i++) {
                const inst = this.resendCache.get(i);
                if (inst) {
                    if (inst.msgDef.msgcat === "admin" && inst.msgDef.name !== "Reject") {
                        if (adminSeqStart === -1) {
                            adminSeqStart = i;
                        }
                    } else {
                        if (adminSeqStart !== -1) {
                            this.sendSeqReset(adminSeqStart, i);
                        }

                        adminSeqStart = -1;
                        this.resendMsg(inst.msgDef, inst.header, i, inst.parameters);
                    }
                }
            }
            if (adminSeqStart !== -1) {
                this.sendSeqReset(adminSeqStart, i);
            }
        } else {
            console.error("BeginSeqNo or EndSeqNo is missing from the resend request", { beginSeqNo, endSeqNo })
        }
    }

    protected resendMsg(msgDef: FixComplexType, prevHeader: FixMsgHeader, tx: number, parameters?: Parameters) {
        const header = this.generateFixMessageHeaders(msgDef, tx);
        this.sendInternal(header, msgDef, parameters, { PossDupFlag: "Y", OrigSendingTime: moment(prevHeader.time, "YYYYMMDD-HH:mm:ss.000").toISOString() });
    }

    protected sendSeqReset(tx: number, end: number) {
        const msg = this.createNewMessageInst("SequenceReset");
        if (msg) {
            msg.setValue({ GapFillFlag: "Y", NewSeqNo: end });
            this.sendInternal(this.generateFixMessageHeaders(msg, tx), msg);
        }
    }

    protected sendHB = (data?: any) => {
        if (!this.hbEnabled) {
            return;
        }

        const msg = this.createNewMessageInst("Heartbeat");
        if (msg) {
            msg.setValue(data ?? {})
            this.send(msg);
        }
    }

    protected sendTestRequest = () => {
        if (!this.testRequestEnabled) {
            return;
        }

        const msg = this.createNewMessageInst("TestRequest");
        if (msg) {
            msg.setValue({ TestReqID: this.testRequestid++ });
            this.send(msg);
        }
    }

    public getHeaderFields = () => {
        return this.parser.getHeaderFields();
    }

    public disconnect = async (dontSendMsg?: boolean) => {
        const msg = this.createNewMessageInst("Logout");
        if (!dontSendMsg && msg) {
            msg.setValue({ Text: this.testRequestid++ });
            await this.send(msg);
        }
        await this.socket?.end();
        // await new Promise(result => setTimeout(result, 2500));
        // await this.socket.destroy();
        // this.connected = false;
        // await new Promise(result => setTimeout(result, 2500));
        // debug('(' + this.profile.name + ') disconnected');
    }

    protected generateFixMessageHeaders = (msgDef: FixMessageDef, tx: number): FixMsgHeader => {
        return {
            msgType: msgDef.id,
            senderCompId: this.profile.senderCompId,
            targetCompId: this.profile.targetCompId,
            sequence: tx,
            time: moment(new Date()).utc().format("YYYYMMDD-HH:mm:ss.000"),
        }
    }

    public encodeToFix = (header: FixMsgHeader, msgDef: FixMessageDef, parameters?: Parameters, additionalHeaders?: any): string => {
        let newHeaders: any = {};
        if (this.profile.headerFields) {
            newHeaders = { ...this.profile.headerFields }
        }

        if (additionalHeaders) {
            newHeaders = { ...newHeaders, ...additionalHeaders }
        }
        
        return this.parser.encodeToFix(msgDef, msgDef.getValue(), header, parameters, newHeaders)
    }

    public decodeFixMessage = (msg: string) => {
        return this.parser.decodeFixMessage(msg)?.msg
    }
}


export class FixSession extends BaseClientFixSession {

    constructor(public readonly profile: ProfileWithCredentials) {
        super(profile)
    }

    protected updateProfile() {
        GlobalServiceRegistry.profile.addOrEditProfile(this.profile);
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

            if (msgInst) {
                this.rx++;
                this.evaluateInputMessage(msgInst.msg);

                this.publishSocketEvent({
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
        this.publishSocketEvent({ event: FixSessionEventType.DISCONNECT })
        Toast.error(getIntlMessage("msg_disconnect", { name: this.profile.name, ip: this.profile.ip }))
    }

    async connect(): Promise<void> {
        const { ip, port } = this.profile;
        const sslConfigs: SocketSSLConfigs = {
            sslEnabled: this.profile.sslEnabled, sslProtocol: this.profile.sslProtocol
            , sslCACertificate: this.profile.sslCACertificate, sslServerName: this.profile.sslServerName
            , sslCertificate: this.profile.sslCertificate, sslCertificatePassword: this.profile.sslCertificatePassword
        };
        this.socket = GlobalServiceRegistry.socket.createSocket(ip, port, sslConfigs);

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
                                log('(' + this.profile.name + ') connection error', event.error);
                                this.connected = false;
                                this.publishSocketEvent({ event: FixSessionEventType.DISCONNECT })
                                reject(event.error ? new Error(event.error) : new SocketTimeOutError());
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
}

export class ServerSideFixClientSession extends BaseClientFixSession {
    protected type: "SERVER_SIDE_CLIENT" | "CLIENT" = "SERVER_SIDE_CLIENT"

    constructor(public readonly profile: ServerSideClientProfile, socket: SocketInst) {
        super(profile)
        this.socket = socket;
        this.connected = true;
        this.listenToEvents()
    }

    protected updateProfile() {
        // GlobalServiceRegistry.profile.addOrEditProfile(this.profile);
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

            if (msgInst) {
                this.rx++;
                this.evaluateInputMessage(msgInst.msg);

                this.publishSocketEvent({
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
        log('server side client disconnected');
        this.connected = false;
        this.publishSocketEvent({ event: FixSessionEventType.DISCONNECT })
        Toast.error(getIntlMessage("msg_server_disconnect"))
    }

    async listenToEvents(): Promise<void> {
        log('listening to server side client events');
        this.socket?.getSocketEventObservable().subscribe(event => {
            switch (event.type) {
                case "error":
                    this.connected = false;
                    this.publishSocketEvent({ event: FixSessionEventType.DISCONNECT })
                    break;
                case "disconnect":
                    this.onDisconnect();
                    break;
                case "data":
                    this.onData(event.data);
                    break;
            }
        })
    }
}