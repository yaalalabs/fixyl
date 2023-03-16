export enum FixVersion {
    FIX_4 = "4",
    FIX_5 = "5",
}

export interface Profile {
    name: string;
    ip: string;
    port: number;
    hbInterval?: number;
    targetCompId: string;
    senderCompId: string;
    dictionaryLocation: string;
    fixVersion: FixVersion;
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

export interface ProfileWithCredentials extends Profile {
    username: string;
    password: string;
    sslCertificatePassword?: string;
}