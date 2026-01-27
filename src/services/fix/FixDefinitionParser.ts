import { removeFalsyKeys } from "src/utils/utils";
import { FixVersion, FixXmlNode, FixFieldDef, FixComplexType, FixField, Parameters } from "./FixDefs";

const parser = require('xml-reader');

function mergeIntoObject(target: any, source: any) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (
                typeof source[key] === "object" &&
                source[key] !== null &&
                !Array.isArray(source[key])
            ) {
                if (!target[key] || typeof target[key] !== "object") {
                    target[key] = {}; // Ensure nested object exists
                }
                mergeIntoObject(target[key], source[key]); // Recursively merge
            } else {
                target[key] = source[key]; // Direct assignment for non-objects
            }
        }
    }
}

export type FixMessageDef = FixComplexType;
export const SOH = String.fromCharCode(1);

const EXCLUDED_HEADERS = ["BeginString", "BodyLength", "MsgType", "SenderCompID", "TargetCompID", "MsgSeqNum", "SendingTime"];
export interface FixMsgHeader {
    msgType: string;
    sequence: number;
    time: any;
    senderCompId: string;
    targetCompId: string;
}

export class FixDefinitionParser {
    private VERSION = 'FIX.4.4';
    private BEGIN_STRING = '8=' + this.VERSION;
    private messageMap = new Map<string, FixComplexType>();
    private messageTypeMap = new Map<string, FixComplexType>();
    private fieldMap = new Map<string, FixFieldDef>();
    private componentMap = new Map<string, FixComplexType>();
    private headerFields = new Map<string, { field: FixComplexType | FixField, type: "field" | "component" | "group" }>();

    constructor(private readonly dictionaryInfo: {
        path: string,
        fixVersion: FixVersion,
        transportDicPath?: string,
    }, private fileManager: { readFile: (path: string) => Promise<any> }, private readyCB: () => void) {

        this.parseDefinition();
    }

    private parseDefinition() {
        this.loadDictionary(this.dictionaryInfo.path, true, () => {
            if (!this.dictionaryInfo.transportDicPath) {
                this.readyCB()
            } else {
                this.loadDictionary(this.dictionaryInfo.transportDicPath, true, () => {
                    this.readyCB()
                })
            }
        })
    }

    private setVersionInfo(xmlObj: FixXmlNode) {
        if (this.dictionaryInfo.fixVersion === FixVersion.FIX_5) {
            this.VERSION = xmlObj.attributes.type
        } else {
            this.VERSION = "FIX";
        }

        this.VERSION += `.${xmlObj.attributes.major}.${xmlObj.attributes.minor}`
        this.BEGIN_STRING = '8=' + this.VERSION;
    }

    private loadDictionary(path: string, setVersionInfo: boolean, done: () => void) {
        this.fileManager.readFile(path).then((data) => {
            const { fileData } = data;
            if (fileData) {
                const xmlObj: FixXmlNode = parser.parseSync(fileData.data);

                if (setVersionInfo) {
                    this.setVersionInfo(xmlObj);
                }

                const messages: FixXmlNode = xmlObj.children.find(inst => inst.name === "messages") as any;
                const fields: FixXmlNode = xmlObj.children.find(inst => inst.name === "fields") as any;
                const components: FixXmlNode = xmlObj.children.find(inst => inst.name === "components") as any;
                const header: FixXmlNode = xmlObj.children.find(inst => inst.name === "header") as any;

                fields.children.forEach((inst) => {
                    const field = new FixFieldDef(inst)
                    this.fieldMap.set(field.name, field);
                })

                components.children.forEach((inst) => {
                    const comp = new FixComplexType(inst, this.fieldMap)
                    this.componentMap.set(comp.name, comp);
                })

                this.componentMap.forEach(comp => {
                    comp.resolveFields(this.componentMap)
                })

                messages.children.forEach((inst) => {
                    if (!inst.name) {
                        return;
                    }
                    const comp = new FixComplexType(inst, this.fieldMap)
                    this.messageMap.set(comp.name, comp);
                    this.messageTypeMap.set(comp.id, comp);
                }, {})

                this.messageMap.forEach(comp => {
                    comp.resolveFields(this.componentMap)
                })

                header.children.forEach((inst) => {
                    if (inst.name === "field") {
                        const fieldDef = this.fieldMap.get(inst.attributes.name)
                        if (fieldDef) {
                            if (EXCLUDED_HEADERS.includes(inst.attributes.name)) {
                                return;
                            }

                            const field = new FixField(fieldDef, inst.attributes.required === "Y")
                            this.headerFields.set(field.def.name, { field, type: "field" });
                        }
                    } else if (inst.name === "group") {
                        const field = new FixComplexType(inst, this.fieldMap)
                        this.headerFields.set(field.name, { field, type: "group" });
                    } else if (inst.name === "component") {
                        const field = new FixComplexType(inst, this.fieldMap)
                        this.headerFields.set(field.name, { field, type: "component" });
                    }
                })

                this.headerFields.forEach((comp) => {
                    if (comp.type === "component" || comp.type === "group") {
                        (comp.field as FixComplexType).resolveFields(this.componentMap)
                    }
                })

                done();
            }
        });
    }

    destroy() {

    }

    getHeaderFields() {
        return Array.from(this.headerFields.values());
    }

    getFieldDef(name: string): FixFieldDef | undefined {
        return this.fieldMap.get(name)
    }

    getAllMessageDefs(): FixMessageDef[] {
        return Array.from(this.messageMap.values());
    }

    getMessageDef(name: string): FixMessageDef | undefined {
        return this.messageMap.get(name);
    }

    extractMessages(data: string, msgs: string[]): number {
        let startIndex = 0;
        let dataLen = data.length;
        let usedLen = 0;
        while (startIndex < dataLen) {
            const msgStart = data.indexOf(this.BEGIN_STRING, startIndex);
            const indexBodyLen = data.indexOf(SOH + '9=', startIndex);
            const indexChecksum = data.indexOf(SOH + '10=', startIndex);
            if (msgStart === -1 || indexBodyLen === -1 || indexChecksum === -1) {
                break;
            }
            const msgEndIndex = indexChecksum + 7;
            const msgLen = (msgEndIndex - msgStart) + 1;
            if (dataLen < msgEndIndex + 1) {
                break;
            }

            if (data[msgEndIndex] !== SOH) {
                console.error('End SOH not found');
                break;
            }

            msgs.push(data.substr(msgStart, msgLen));
            startIndex = msgEndIndex + 1;
            usedLen = startIndex;
        }
        return usedLen;
    }

    private checksum(data: string): string {
        let total: number = 0;
        for (let index = 0; index < data.length; index++) {
            total += data.charCodeAt(index);
        }

        let checksum = (total % 256).toString();

        while (checksum.length < 3) {
            checksum = '0' + checksum;
        }

        return checksum;
    }

    private encodeToFixBody(msgDef: FixComplexType, data: any, parameters?: Parameters) {
        let fixMsgBody = "";

        msgDef.getFieldOrder().forEach(inst => {
            if (data[inst.name] === undefined) {
                return "";
            }

            const msgFieldDef: any = this.fieldMap.get(inst.name);

            switch (inst.type) {
                case "field":
                    const fieldDef = msgFieldDef.formatValueToPack(data[inst.name], parameters);
                    fixMsgBody += `${msgFieldDef.number}=${fieldDef}${SOH}`
                    break;
                case "component":
                    const compDef = msgDef.components.get(inst.name);
                    if (compDef) {
                        fixMsgBody += this.encodeToFixBody(compDef, data[inst.name], parameters);
                    }
                    break;
                case "group":
                    const groupDef = msgDef.groups.get(inst.name);
                    if (groupDef) {
                        const arrayData = data[inst.name] as any[];
                        if (arrayData.length > 0) {
                            fixMsgBody += `${msgFieldDef.number}=${arrayData.length}${SOH}`;
                            arrayData.forEach(inst => {
                                fixMsgBody += this.encodeToFixBody(groupDef, inst, parameters)
                            })
                        }
                    }
                    break;
                default:
                    "";
            }

        })

        return fixMsgBody;
    }

    private encodeCustomHeaders(customHeaderData: any) {
        removeFalsyKeys(customHeaderData);
        const properties = Object.keys(customHeaderData);
        let fixMsgHeader = "";

        properties.forEach(property => {
            let def: any = this.fieldMap.get(property);
            if (def) {
                if (def.isGroupField) {
                    const arrayData = customHeaderData[property] as any[];
                    fixMsgHeader += `${def.number}=${arrayData.length}${SOH}`;
                    arrayData.forEach(inst => {
                        fixMsgHeader += this.encodeToFixBody(def, inst)
                    })
                } else {
                    const fielData = def.formatValueToPack(customHeaderData[property]);
                    fixMsgHeader += `${def.number}=${fielData}${SOH}`
                }
            } else {
                def = this.componentMap.get(property);
                if (def) {
                    fixMsgHeader += this.encodeToFixBody(def, customHeaderData[property]);
                }
            }
        })

        return fixMsgHeader;
    }

    private encodeHeader(header: FixMsgHeader, customHeaders?: any) {
        let ret = '35=' + header.msgType +
            `${SOH}34=` + header.sequence +
            `${SOH}52=` + header.time +
            `${SOH}49=` + header.senderCompId +
            `${SOH}56=` + header.targetCompId + SOH;

        if (customHeaders) {
            ret += this.encodeCustomHeaders(customHeaders)
        }

        return ret;
    }


    encodeToFix(msgDef: FixComplexType, data: any, header: FixMsgHeader, parameters?: Parameters, customHeaders?: any): string {
        const messageBody = this.encodeToFixBody(msgDef, data, parameters);
        const messageHeader = this.encodeHeader(header, customHeaders);
        const msg = messageHeader + messageBody;
        let message = this.BEGIN_STRING + SOH + '9=' + msg.length + SOH + msg;
        message += '10=' + this.checksum(message) + SOH;
        return message;
    }


    private getTagValue(fields: string[], tag: string): { data: string, pos: number } | undefined {

        for (let i = 0; i < fields.length; i++) {
            let temp = fields[i].split('=');
            if (tag === temp[0]) {
                return { data: temp[1], pos: i };
            }
        }

        return undefined
    }

    private decodeHeader(fields: string[]): FixMsgHeader {
        return {
            msgType: this.getTagValue(fields, "35")?.data ?? "",
            senderCompId: this.getTagValue(fields, "49")?.data ?? "",
            targetCompId: this.getTagValue(fields, "56")?.data ?? "",
            time: this.getTagValue(fields, "52")?.data ?? "",
            sequence: Number(this.getTagValue(fields, "34")?.data) ?? 1,
        }
    }

    private fillComponents(msgDef: FixComplexType, data: any) {
        const ret: any = {}
        Object.keys(data).forEach(key => {
            const field = msgDef.fields.get(key)
            if (field) {
                ret[key] = data[key]
                return;
            }

            const group = msgDef.groups.get(key)
            if (group && Array.isArray(data[key])) {

                ret[key] = data[key].map((inst: any) => this.fillComponents(group, inst));
                return;
            }

            const components: string[] = []
            msgDef.getComponentRefs(key, components)
            if (components.length > 0) {
                let finalRef: any = {};
                const root = finalRef;
                components.forEach(inst => {
                    finalRef[inst] = {}
                    finalRef = finalRef[inst]
                })

                finalRef[key] = data[key]
                mergeIntoObject(ret, root)
            }


        })
        return ret;
    }

    private decodeInternals(msgDef: FixComplexType, fields: string[]) {
        const data: any = {}
        const dataWithHeaders: any = {}
        const defStack = [msgDef]

        let currentDef = defStack[0]
        let currentData: any = data;
        let currentDataWithHeaders: any = dataWithHeaders;
        let currentGroupStack: {
            len: number, def: FixComplexType, value: { data: any, dataWithHeaders: any }[], currentRepetitionField: string,
            parentDef: FixComplexType, parentDataObj: any, parentDataWithHeaderObj: any
        }[] = [];

        fields.forEach(inst => {
            let keyValuePair = inst.split('=');
            const fieldId = keyValuePair[0];
            const fieldValue = keyValuePair[1];
            let fieldDef: any;
            do {
                fieldDef = currentDef.getFieldForId(fieldId)

                if (!fieldDef) {
                    if (currentGroupStack.length > 0) {
                        const lastGroup = currentGroupStack.pop()
                        if (!lastGroup) {
                            console.error("failed to load def for field", keyValuePair);
                            break;
                        }

                        currentDef = lastGroup.parentDef;
                        currentData = lastGroup.parentDataObj;
                        currentDataWithHeaders = lastGroup.parentDataWithHeaderObj;
                        currentData[lastGroup.def.name] = lastGroup.value.map(inst => inst.data);
                        currentDataWithHeaders[`${lastGroup.def.name}[${lastGroup.def.id}]`] = lastGroup.value.map(inst => inst.dataWithHeaders);
                    }
                }

            } while (!fieldDef && currentGroupStack.length !== 0)

            switch (fieldDef?.type) {
                case "group": {
                    const groupDef = fieldDef.field;
                    if (groupDef) {
                        currentGroupStack.push({
                            def: groupDef, len: Number(fieldValue), value: [] as any,
                            currentRepetitionField: groupDef.getFieldOrder()[0].name,
                            parentDef: currentDef,
                            parentDataObj: currentData, parentDataWithHeaderObj: currentDataWithHeaders
                        })

                        defStack.push(groupDef)
                        currentDef = defStack[defStack.length - 1]
                        currentData = null;
                        currentDataWithHeaders = null;
                    }
                    break;
                }
                case "field": {
                    if (currentGroupStack.length > 0) {
                        const currentGroup = currentGroupStack[currentGroupStack.length - 1]
                        if (currentGroup.currentRepetitionField === fieldDef.name) {
                            currentData = {};
                            currentDataWithHeaders = {};
                            currentGroup.value.push({ data: currentData, dataWithHeaders: currentDataWithHeaders })
                        }
                    }

                    currentData[fieldDef.name] = fieldValue
                    currentDataWithHeaders[`${fieldDef.name}[${fieldId}]`] = fieldValue;
                } break;
            }

        })

        return { data: this.fillComponents(msgDef, data), dataWithHeaders }
    }

    decodeFixMessage(msg: string): { msg: FixComplexType, header: FixMsgHeader } | undefined {
        const fields = msg.split(SOH);

        const msgType = this.getTagValue(fields, "35")?.data;
        if (!msgType) {
            console.error("Unsupported message type: ", msgType)
            return undefined;
        }

        const msgDef = this.messageTypeMap.get(msgType);
        if (msgDef) {
            const { data, dataWithHeaders } = this.decodeInternals(msgDef, fields);
            // const headerRet = this.decodeInternals(msgDef, msg, true);

            const def = msgDef.clone();
            (def as FixComplexType).setValue(data);
            (def as FixComplexType).setValueWithHeaders(dataWithHeaders);

            return { msg: def, header: this.decodeHeader(fields) }
        }

        return undefined;
        // const msgParts = msg.split(SOH);
    }

}