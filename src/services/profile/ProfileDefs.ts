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
}

export interface ProfileWithCredentials extends Profile {    
    username: string;
    password: string;
}