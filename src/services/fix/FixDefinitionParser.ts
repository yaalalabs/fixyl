import { removeFalsyKeys } from "src/utils/utils";
import { GlobalServiceRegistry } from "../GlobalServiceRegistry";
import { FixVersion } from "../profile/ProfileDefs";
import { FixXmlNode, FixFieldDef, FixComplexType } from "./FixDefs";
const parser = require('xml-reader');

export type FixMessageDef = FixComplexType;
export const SOH = String.fromCharCode(1);

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
    private fileManager = GlobalServiceRegistry.fileManger;
    private messageMap = new Map<string, FixComplexType>();
    private messageTypeMap = new Map<string, FixComplexType>();
    private fieldMap = new Map<string, FixFieldDef>();
    private componentMap = new Map<string, FixComplexType>();
    private headerFields = new Set<string>();

    constructor(private readonly dictionaryInfo: {
        path: string,
        fixVersion: FixVersion, transportDicPath?: string
    }, private readyCB: () => void) {

        this.parseDefinition();
    }

    private parseDefinition() {
        this.loadDictionary(this.dictionaryInfo.path, true, () => {
            if (!this.dictionaryInfo.transportDicPath) {
                this.readyCB()
            } else {
                this.loadDictionary(this.dictionaryInfo.transportDicPath, false, () => {
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
        
        Object.freeze(this.VERSION)
        Object.freeze(this.BEGIN_STRING)
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

                header.children.forEach((inst) => [
                    this.headerFields.add(inst.attributes.name)
                ])

                fields.children.forEach((inst) => {
                    const field = new FixFieldDef(inst)
                    this.fieldMap.set(field.name, field);
                })

                components.children.forEach((inst) => {
                    const comp = new FixComplexType(inst, this.fieldMap)
                    this.componentMap.set(comp.name, comp);
                }, {})

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

                done();
            }
        });
    }

    destroy() {

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

    private getTagValue(message: string, tag: string, iterationIndex: number = 0): string | undefined {
        let fields = message.split(SOH);
        let index = -1;

        for (let i = 0; i < fields.length; i++) {
            let temp = fields[i].split('=');
            if (tag === temp[0]) {
                index++;
                if (index === iterationIndex) {
                    return temp[1];
                }
            }
        }

        return undefined
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

    private encodeToFixBody(data: any, parameters?: any) {
        removeFalsyKeys(data);
        const properties = Object.keys(data);
        let fixMsgBody = "";

        properties.forEach(property => {
            let def: any = this.fieldMap.get(property);
            if (def) {
                if (def.isGroupField) {
                    const arrayData = data[property] as any[];
                    fixMsgBody += `${def.number}=${arrayData.length}${SOH}`;
                    arrayData.forEach(inst => {
                        fixMsgBody += this.encodeToFixBody(inst, parameters)
                    })
                } else {
                    const fielData = def.formatValueToPack(data[property], parameters);
                    fixMsgBody += `${def.number}=${fielData}${SOH}`
                }
            } else {
                def = this.componentMap.get(property);
                if (def) {
                    fixMsgBody += this.encodeToFixBody(data[property], parameters);
                }
            }
        })

        return fixMsgBody;
    }

    private encodeHeader(header: FixMsgHeader) {
        return '35=' + header.msgType +
            `${SOH}34=` + header.sequence +
            `${SOH}52=` + header.time +
            `${SOH}49=` + header.senderCompId +
            `${SOH}56=` + header.targetCompId
    }

    encodeToFix(data: any, header: FixMsgHeader, parameters?: any): string {
        const messageBody = this.encodeToFixBody(data, parameters);
        const messageHeader = this.encodeHeader(header);
        const msg = messageHeader + SOH + messageBody;
        let message = this.BEGIN_STRING + SOH + '9=' + msg.length + SOH + msg;
        message += '10=' + this.checksum(message) + SOH;
        return message;
    }

    private getFieldValues = (def: FixComplexType, inputData: string, fieldIterationIndex: number) => {
        const ret: any = {};
        def.fields.forEach(field => {
            const fieldValue = this.getTagValue(inputData, field.def.number, fieldIterationIndex);
            ret[field.def.name] = fieldValue;
        })

        return ret;
    }

    private getGroupValues = (def: FixComplexType, inputData: string,) => {
        const ret: any = [];
        const interationLen = this.getTagValue(inputData, def.id);

        if (!interationLen) {
            return undefined;
        }

        for (let i = 0; i < Number(interationLen); i++) {
            const fieldData = this.getFieldValues(def, inputData, i)
            let groupData: any = {};
            if (def.group) {
                groupData[def.group.name] = this.getGroupValues(def.group, inputData,);
            }
            let componentData: any = {};
            def.components.forEach(comp => {
                componentData[comp.name] = this.getComponentValues(comp, inputData,);
            })

            ret.push({ ...fieldData, ...groupData, ...componentData })
        }

        return ret;
    }

    private getComponentValues = (def: FixComplexType, inputData: string,) => {
        const fieldData = this.getFieldValues(def, inputData, 0)
        let groupData: any = {};
        if (def.group) {
            groupData[def.group.name] = this.getGroupValues(def.group, inputData,);
        }
        let componentData: any = {};
        def.components.forEach(comp => {
            componentData[comp.name] = this.getComponentValues(comp, inputData,);
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private decodeHeader(msg: string): FixMsgHeader {
        return {
            msgType: this.getTagValue(msg, "35") ?? "",
            senderCompId: this.getTagValue(msg, "49") ?? "",
            targetCompId: this.getTagValue(msg, "56") ?? "",
            time: this.getTagValue(msg, "52") ?? "",
            sequence: Number(this.getTagValue(msg, "34")) ?? 1,
        }
    }

    decodeFixMessage(msg: string): { msg: FixComplexType, header: FixMsgHeader } | undefined {
        const msgType = this.getTagValue(msg, "35");
        if (!msgType) {
            console.log("Unsupported message type: ", msgType)
            return undefined;
        }

        const msgDef = this.messageTypeMap.get(msgType);
        if (msgDef) {

            const fieldData = this.getFieldValues(msgDef, msg, 0)
            let groupData: any = {};
            if (msgDef.group) {
                groupData[msgDef.group.name] = this.getGroupValues(msgDef.group, msg,)
            }
            let componentData: any = {};
            msgDef.components.forEach(comp => {
                componentData[comp.name] = this.getComponentValues(comp, msg,)
            })

            const ret = { ...fieldData, ...groupData, ...componentData };
            const def = msgDef.clone();
            (def as FixComplexType).setValue(ret);

            return { msg: def, header: this.decodeHeader(msg) }
        }

        return undefined;
        // const msgParts = msg.split(SOH);
    }

}