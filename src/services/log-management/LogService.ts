export class LogService {
    private static logApi = (window as any).api;

    static debug(message: string, ...args: any[]) {
        this.logApi.send("logManagerOut", ["debug", message, ...args]);
    }

    static info(message: string, ...args: any[]) {
        this.logApi.send("logManagerOut", ["info", message, ...args]);
    }

    static warn(message: string, ...args: any[]) {
        this.logApi.send("logManagerOut", ["warn", message, ...args]);
    }

    static error(message: string, ...args: any[]) {
        this.logApi.send("logManagerOut", ["error", message, ...args]);
    }
    
    static log(message: string, ...args: any[]) {
        this.logApi.send("logManagerOut", ["log", message, ...args]);
    }
}   