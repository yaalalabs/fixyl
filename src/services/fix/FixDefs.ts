import moment from "moment";
const { v4: uuidv4 } = require('uuid');

export interface FixXmlNode {
    name: string; // element name (empty for text nodes)
    type: string; // node type (element or text), see NodeType constants
    value: string; // value of a text node
    parent: FixXmlNode; // reference to parent node (null with parentNodes option disabled or root node)
    attributes: { [name: string]: string }; // map of attributes name => value
    children: FixXmlNode[];  // array of children nodes
}

export const FixDataTypes = ['STRING', 'CHAR', 'PRICE', 'SEQNUM', 'LENGTH', 'AMT', 'QTY', 'CURRENCY', 'MULTIPLEVALUESTRING', 'EXCHANGE', 'NUMINGROUP', 'UTCTIMESTAMP', 'BOOLEAN', 'LOCALMKTDATE', 'INT', 'DATA', 'FLOAT', 'PERCENTAGE', 'PRICEOFFSET', 'MONTHYEAR', 'UTCDATEONLY', 'UTCTIMEONLY', 'COUNTRY', 'MULTIPLECHARVALUE'];

export const DEFAULT_HB_INTERVAL = 30;

export enum FixFieldValueFiller {
    AUTO_GEN = "{auto-gen}",
}

export class FixFieldDef {
    type: string;
    name: string;
    number: string;
    options?: { value: string, displayValue: string }[];
    isGroupField: boolean;

    constructor(private xmNode: FixXmlNode) {
        this.type = xmNode.attributes.type;
        this.name = xmNode.attributes.name;
        this.number = xmNode.attributes.number;
        this.isGroupField = this.type.toLowerCase() === "numingroup";

        const options = xmNode.children.map(inst => ({ value: inst.attributes.enum, displayValue: `${inst.attributes.description} [${inst.attributes.enum}]` }))
        if (options.length > 0) {
            this.options = [{ value: "", displayValue: "" }, ...options];
        }
    }

    private checkForFieldFillers(inputValue: any, parameters?: any) {
        if (inputValue === FixFieldValueFiller.AUTO_GEN) {
            switch (this.type.toLowerCase()) {
                case "string":
                case "char":
                    return uuidv4();
                case "int":
                    return Math.floor(Math.random() * 100);
                case "float":
                    return Math.random().toFixed(3);
                case "utctimestamp":
                    return moment(Date.now()).utc().format("YYYYMMDD-HH:mm:ss.000")
                case 'monthyear':
                    return moment(Date.now()).utc().format("YYYYMM")
                case 'utcdateonly':
                    return moment(Date.now()).utc().format("YYYYMMDD-HH")
                case 'utctimeonly':
                    return moment(Date.now()).utc().format("mm:ss.000")
                default:
                    return undefined;
            }
        }

        const setRegex = /{set:(.*?)}/g;
        const match = setRegex.exec(inputValue)
        if (match && parameters) {
            const param = match[1].trim();
            return parameters[param]
        }


        return undefined
    }

    formatValueToPack(inputValue: any, parameters?: any) {
        const alteredValue = this.checkForFieldFillers(inputValue, parameters);
        if (alteredValue !== undefined) {
            return alteredValue;
        }

        switch (this.type.toLowerCase()) {
            case "multiplevaluestring":
            case "multiplecharvalue":
                return Array.isArray(inputValue) ? inputValue.join(" ") : inputValue;
            case "boolean":
                return inputValue ? "Y" : "N";
            case "utctimestamp":
                return moment(inputValue).utc().format("YYYYMMDD-HH:mm:ss.000");
            case 'monthyear':
                return moment(inputValue).utc().format("YYYYMM")
            case 'utcdateonly':
                return moment(inputValue).utc().format("YYYYMMDD-HH")
            case 'utctimeonly':
                return moment(inputValue).utc().format("mm:ss.000")
            default:
                return inputValue;
        }
    }
}

export class FixField {
    private value: any;

    constructor(public def: FixFieldDef,
        public required: boolean) {

    }

    clone() {
        const ret = new FixField(this.def, this.required);
        return ret;
    }
}

export class FixComplexType {
    type: "group" | "component" | "message";
    name: string;
    required?: boolean;
    fields: FixField[] = [];
    components: FixComplexType[] = [];
    group?: FixComplexType;
    groupInstances: any = {};
    id: string;
    private value: any;
    private valueWithHeaders: any;

    constructor(private xmlNode: FixXmlNode, private fieldDefMap: Map<string, FixFieldDef>) {
        this.name = xmlNode.attributes.name;
        this.required = xmlNode.attributes.required === "Y";
        this.type = xmlNode.name as any;
        this.id = xmlNode.attributes.msgtype ?? fieldDefMap.get(this.name)?.number;

        xmlNode.children.forEach(child => {
            switch (child.name) {
                case "field":
                    const def = this.fieldDefMap.get(child.attributes.name);
                    if (def) {
                        this.fields.push(new FixField(def, child.attributes.required === "Y"))
                    }
                    break;
                case "group":
                    this.group = new FixComplexType(child, this.fieldDefMap);
                    break;
                case "component":
                    this.components.push(new FixComplexType(child, this.fieldDefMap))
                    break;
            }
        })
    }

    setValue(value: any) {
        this.value = value;
    }

    setValueWithHeaders(value: any) {
        this.valueWithHeaders = value;
    }

    getValue() {
        return this.value;
    }
    
    getValueWithHeaders() {
        return this.valueWithHeaders;
    }

    clone(): FixComplexType {
        const ret = new FixComplexType(this.xmlNode, this.fieldDefMap);
        ret.fields = this.fields.map(field => field.clone())
        ret.components = this.components.map(comp => comp.clone())
        ret.group = this.group?.clone();
        return ret;
    }

    resolveFields(componentMap: Map<string, FixComplexType>) {
        this.components = this.components.map(inst => {
            const ref = componentMap.get(inst.name);
            if (ref) {
                return ref;
            }

            return undefined;
        }).filter(inst => !!inst) as FixComplexType[];

        this.group?.resolveFields(componentMap);
    }
}

export class HBMonitor {
    private sentHBCount = -1;
    private hbTimer: any;

    constructor(private onRequestTest: () => void,
        private onDisconnect: () => void,
        private onSendHB: () => void,
        private hbInterval: number,
        private maxHBMissCount = 1) {
    }

    resetHB() {
        this.sentHBCount = -1;
    }

    startHBTimer() {
        this.hbTimer = setInterval(() => {
            this.sendHB();
        }, this.hbInterval * 1000);
    }

    stopHBTimer() {
        clearInterval(this.hbTimer);
        this.sentHBCount = -1;
    }

    private sendHB() {
        this.sentHBCount += 1;

        if (this.sentHBCount === this.maxHBMissCount) {
            console.warn('Max HB miss count reached. Requesting a test message ');
            this.onRequestTest();
        } else if (this.sentHBCount > this.maxHBMissCount) {
            console.warn('Max HB miss count reached. Connection will be closed :', this.sentHBCount);
            this.stopHBTimer();
            this.onDisconnect();
        } else {
            this.onSendHB();
        }
    }
}
