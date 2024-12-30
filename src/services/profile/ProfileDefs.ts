export enum FixVersion {
    FIX_4 = "4",
    FIX_5 = "5",
}

export interface BaseProfile {
    type?: "CLIENT" | "SERVER",
    name: string;
    targetCompId: string;
    senderCompId: string;
    dictionaryLocation: string;
    fixVersion: FixVersion;
    hbInterval?: number;
    transportDictionaryLocation?: string;
    sslEnabled?: boolean;
    sslServerName?: string;
    sslCACertificate?: string;
    sslCertificate?: string;
    sslProtocol?: string;
    headerFields?: any;
    autoLoginEnabled?: boolean;
    autoLoginMsg?: any;
    sequenceResetRequestEnabled?: boolean;
    resendRequestEnabled?: boolean;
    sessionParams?: any;
}

export interface Profile extends BaseProfile {
    ip: string;
    port: number;
}

export interface ProfileWithCredentials extends Profile {
    username: string;
    password: string;
    sslCertificatePassword?: string;
}


export interface ServerSideClientProfile extends BaseProfile {    
}
export interface ServerProfile extends BaseProfile {
    port: number;
}
