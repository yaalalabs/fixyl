import moment from 'moment';
import { Observable, Subject, Subscription } from 'rxjs';
import { Toast } from 'src/common/Toast/Toast';
import { LM } from 'src/translations/language-manager';
import { deepCopyObject } from 'src/utils/utils';
import { GlobalServiceRegistry } from '../GlobalServiceRegistry';
import { ProfileWithCredentials } from '../profile/ProfileDefs';
import { SocketInst, SocketSSLConfigs } from '../socket-management/SocketManagementSevice';
import { FixDefinitionParser, FixMessageDef, FixMsgHeader } from './FixDefinitionParser';
import { DEFAULT_HB_INTERVAL, FixComplexType, FixFieldDef, HBMonitor } from './FixDefs';

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

export class FixSession {
    private socket?: SocketInst;
    private connected = false;
    private parserInitialized = false;
    private socketDataSubject = new Subject<FixSessionEvent>();
    private parser: FixDefinitionParser;
    private tx: number = 1;
    private rx: number = 1;
    private inputStream: string = "";
    private hbMonitor?: HBMonitor;
    private testRequestid = 1;
    private connectedTime: any;
    private isDestroyed = false;
    private hbEnabled = true;
    private testRequestEnabled = true;
    private autoLoginEnabled = false;
    private sequenceResetRequestEnabled = false;
    private resendRequestEnabled = false;
    private sessionParams: Parameters = {};

    private resendCache = new Map<number, { msgDef: FixComplexType, header: FixMsgHeader, parameters?: Parameters }>();

    constructor(public readonly profile: ProfileWithCredentials) {
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

    private initAutoSessionControlInfo() {
        this.autoLoginEnabled = !!this.profile.autoLoginEnabled && !!this.profile.autoLoginMsg;
        this.sequenceResetRequestEnabled = !!this.profile.sequenceResetRequestEnabled;
        this.resendRequestEnabled = !!this.profile.resendRequestEnabled;
        this.sessionParams = this.profile.sessionParams ? this.profile.sessionParams : {};
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
        console.log("Session destroyed");
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

    private updateProfile() {
        GlobalServiceRegistry.profile.addOrEditProfile(this.profile);
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

    isAutoLoginEnabled() {
        return this.autoLoginEnabled;
    }

    isSequenceResetRequestEnabled() {
        return this.sequenceResetRequestEnabled;
    }

    isResendRequestEnabled() {
        return this.resendRequestEnabled;
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
        return this.connected && this.parserInitialized;
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

    private async evaluteAndSendReady() {
        if (this.isReady()) {
            this.socketDataSubject.next({ event: FixSessionEventType.READY })
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

    public async send(msgDef: FixMessageDef, parameters?: Parameters): Promise<any> {
        this.evaluateOutputMessage(msgDef);
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
        }
    }

    private sendInternal(header: FixMsgHeader, msgDef: FixMessageDef, parameters?: Parameters, additionalHeaders?: any): Promise<any> {
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

    private writeToSocket = (data: string) => {
        this.socket?.write(data);
        return new Promise((resolve, reject) => {
            let sub: Subscription | undefined;
            try {
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

    private evaluateInputMessage = (msg: FixMessageDef) => {
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
                    Toast.error(data.Text);
                }
                break;

        }
    }

    private evaluateOutputMessage = (msg: FixMessageDef) => {
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

    private onResendRequest = (msg: FixMessageDef) => {
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
        } else {
            console.error("BeginSeqNo or EndSeqNo is missing from the resend request", { beginSeqNo, endSeqNo })
        }
    }

    private resendMsg(msgDef: FixComplexType, prevHeader: FixMsgHeader, tx: number, parameters?: Parameters) {
        const header = this.generateFixMessageHeaders(msgDef, tx);
        this.sendInternal(header, msgDef, parameters, { PossDupFlag: "Y", OrigSendingTime: moment(prevHeader.time, "YYYYMMDD-HH:mm:ss.000").toISOString() });
    }

    private sendSeqReset(tx: number, end: number) {
        const msg = this.createNewMessageInst("SequenceReset");
        if (msg) {
            msg.setValue({ GapFillFlag: "Y", NewSeqNo: end });
            this.sendInternal(this.generateFixMessageHeaders(msg, tx), msg);
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

    public getHeaderFields = () => {
        return this.parser.getHeaderFields();
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

    private generateFixMessageHeaders = (msgDef: FixMessageDef, tx: number): FixMsgHeader => {
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

        return this.parser.encodeToFix(msgDef.getValue(), header, parameters, newHeaders)
    }

    public decodeFixMessage = (msg: string) => {
        return this.parser.decodeFixMessage(msg)?.msg
    }
}
