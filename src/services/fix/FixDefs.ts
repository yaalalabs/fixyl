import moment from "moment";
const { v4: uuidv4 } = require('uuid');

export interface Parameter {
    value: any;
    count?: number;
}

export type Parameters = { [key: string]: Parameter };

export enum FixVersion {
    FIX_4 = "4",
    FIX_5 = "5",
}

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

export interface FixFieldOption {
    value?: string,
    displayValue: string
}

export class FixFieldDef {
    type: string;
    name: string;
    number: string;
    options?: FixFieldOption[];
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

    private generateFillerValue() {
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
                return moment(Date.now()).utc().format("YYYYMMDD")
            case 'utctimeonly':
                return moment(Date.now()).utc().format("mm:ss.000")
            default:
                return undefined;
        }
    }

    private checkForFieldFillers(inputValue: any, parameters?: Parameters) {
        if (inputValue === FixFieldValueFiller.AUTO_GEN) {
            return this.generateFillerValue();
        }

        const setRegex = /{set:(.*?)}/g;
        const match = setRegex.exec(inputValue)
        if (match && parameters) {
            const param = match[1].trim();
            if (!parameters[param]) {
                console.warn(`Parameter "${param}" not found for {set:} filler`);
                return inputValue;
            }
            return parameters[param].value;
        }

        const getRegex = /{get:(.*?)}/g;
        const getMatch = getRegex.exec(inputValue)
        if (getMatch && parameters) {
            const param = getMatch[1].trim();
            if (!parameters[param]) {
                console.warn(`Parameter "${param}" not found for {get:} filler`);
                return inputValue;
            }
            return parameters[param].value;
        }

        const setRegexInc = /{incr:(.*?)}/g;
        const incMatch = setRegexInc.exec(inputValue)
        if (incMatch && parameters) {
            const param = incMatch[1].trim();
            if (!parameters[param]) {
                console.warn(`Parameter "${param}" not found for {incr:} filler`);
                return inputValue;
            }
            if (!parameters[param].count) {
                parameters[param].count = 1;
            } else {
                parameters[param].count!++;
            }
            return `${parameters[param].value}${parameters[param].count}`;
        }

        return undefined
    }

    formatValueToPack(inputValue: any, parameters?: Parameters) {
        const alteredValue = this.checkForFieldFillers(inputValue, parameters);
        if (alteredValue !== undefined) {
            return alteredValue;
        }

        switch (this.type.toLowerCase()) {
            case "multiplevaluestring":
            case "multiplecharvalue":
                return Array.isArray(inputValue) ? inputValue.join(" ") : inputValue;
            case "utctimestamp":
                return moment(inputValue, ["YYYYMMDD-HH:mm:ss.SSS", moment.ISO_8601]).utc().format("YYYYMMDD-HH:mm:ss.000");
            case 'monthyear':
                return moment(inputValue, ["YYYYMM", moment.ISO_8601]).utc().format("YYYYMM")
            case 'utcdateonly':
                return moment(inputValue, ["YYYYMMDD", moment.ISO_8601]).utc().format("YYYYMMDD-HH")
            case 'utctimeonly':
                return moment(inputValue, ["HH:mm:ss.SSS", moment.ISO_8601]).utc().format("mm:ss.000")
            case 'boolean':
                let ret = inputValue;
                if (typeof inputValue === "boolean") {
                    ret = inputValue ? "Y" : "N"
                }
                return ret
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
        return new FixField(this.def, this.required);
    }
}

type FieldTypes = "group" | "component" | "field";
type FieldOrderEntry = { name: string, type: FieldTypes };

export class FixComplexType {
    type: "group" | "component" | "message";
    name: string;
    required?: boolean;
    fields = new Map<string, FixField>();
    requiredFields: FixField[] = [];
    components = new Map<string, FixComplexType>();
    groups = new Map<string, FixComplexType>();
    fieldOrder: FieldOrderEntry[] = [];
    itemIdMap = new Map<string, { name: string, type: FieldTypes, field: FixComplexType | FixFieldDef }>()
    groupInstances: any = {};
    id: string;
    msgcat?: "admin" | "app";

    private value: any;
    private valueWithHeaders: any;

    constructor(private xmlNode: FixXmlNode, private fieldDefMap: Map<string, FixFieldDef>) {
        this.name = xmlNode.attributes.name;
        this.required = xmlNode.attributes.required === "Y";
        this.type = xmlNode.name as any;
        this.msgcat = xmlNode.attributes.msgcat as any;
        this.id = xmlNode.attributes.msgtype ?? fieldDefMap.get(this.name)?.number;

        xmlNode.children.forEach(child => {
            this.fieldOrder.push({ name: child.attributes.name, type: child.name as any })
            switch (child.name) {
                case "field":
                    const def = this.fieldDefMap.get(child.attributes.name);
                    if (def) {
                        const field = new FixField(def, child.attributes.required === "Y");
                        this.fields.set(field.def.name, field);

                        if (field.required) {
                            this.requiredFields.push(field);
                        }
                    }
                    break;
                case "group":
                    const groupInst = new FixComplexType(child, this.fieldDefMap);
                    this.groups.set(groupInst.name, groupInst)
                    break;
                case "component":
                    const compInst = new FixComplexType(child, this.fieldDefMap);
                    this.components.set(compInst.name, compInst)
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

    getFieldOrder(): FieldOrderEntry[] {
        return this.fieldOrder;
    }

    getComponentRefs(id: string, ref: string[]): boolean {
        let ret = false;
        if (this.fields.get(id)) {
            ref.push(this.name)
            ret = true;
        }

        if (!ret && this.groups.get(id)) {
            ref.push(this.name)
            ret = true;
        }

        this.components.forEach((inst) => {
            if (!ret) {
                ret = inst.getComponentRefs(id, ref)
            }
        })

        return ret;

    }

    getFieldForId(id: string): any {
        let field = this.itemIdMap.get(id)

        if (!field) {
            const comps = Array.from(this.components.values())
            for (let i = 0; i < comps.length; i++) {
                field = comps[i].getFieldForId(id)
                if (field) {
                    break;
                }
            }
        }

        if (!field) {
            const groups = Array.from(this.groups.values())
            for (let i = 0; i < groups.length; i++) {
                field = groups[i].getFieldForId(id)
                if (field) {
                    break;
                }
            }
        }

        return field;
    }

    getFieldValue(name: string): any {
        return this.value?.[name];
    }

    getValue() {
        return this.value;
    }

    getValueWithHeaders() {
        return this.valueWithHeaders;
    }

    clone(): FixComplexType {
        const ret = new FixComplexType(this.xmlNode, this.fieldDefMap);
        ret.fields = new Map(Array.from(this.fields.values()).map(field => field.clone()).map(i => [i.def.name, i]))
        ret.components = new Map(Array.from(this.components.values()).map(comp => comp.clone()).map(i => [i.name, i]));
        ret.groups = new Map(Array.from(this.groups.values()).map(comp => comp.clone()).map(i => [i.name, i]));
        ret.requiredFields = this.requiredFields.map(comp => comp.clone());
        ret.fieldOrder = this.fieldOrder;
        return ret;
    }

    resolveFields(componentMap: Map<string, FixComplexType>, visited = new Set<FixComplexType>()) {
        if (visited.has(this)) {
            return;
        }
        visited.add(this);

        this.components.forEach(inst => {
            const ref = componentMap.get(inst.name);
            if (ref) {
                inst.fields = new Map(Array.from(ref.fields.values()).map(field => field.clone()).map(i => [i.def.name, i]));
                inst.components = new Map(Array.from(ref.components.values()).map(comp => comp.clone()).map(i => [i.name, i]));
                inst.groups = new Map(Array.from(ref.groups.values()).map(comp => comp.clone()).map(i => [i.name, i]));
                inst.requiredFields = ref.requiredFields.map(comp => comp.clone());
                inst.fieldOrder = ref.fieldOrder;
            }
        });

        this.groups.forEach(inst => {
            inst?.resolveFields(componentMap, visited);
        });

        this.components.forEach(inst => {
            inst.resolveFields(componentMap, visited);
        });

        this.setupInternalRefsRecursive();
    }

    setupInternalRefs() {
        this.fields.forEach(field => this.itemIdMap.set(field.def.number, { name: field.def.name, type: "field", field: field.def }))
        this.groups.forEach(group => this.itemIdMap.set(group.id, { name: group.name, type: "group", field: group }))
    }

    private setupInternalRefsRecursive(visited = new Set<FixComplexType>()) {
        if (visited.has(this)) {
            return;
        }
        visited.add(this);

        this.setupInternalRefs();
        this.components.forEach(comp => comp.setupInternalRefsRecursive(visited));
        this.groups.forEach(group => group.setupInternalRefsRecursive(visited));
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
