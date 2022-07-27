import { Subject, Subscription } from "rxjs";
import { FixComplexType } from "src/services/fix/FixDefs";
import { FixSession, FixSessionEventType } from "src/services/fix/FixSession";
import { LM } from "src/translations/language-manager";
import { makeCancelable, removeFalsyKeys } from "src/utils/utils";

const DEFAULT_WAIT_TIME = 30000;
const getIntlMessage = (msg: string, opts?: any) => {
    return LM.getMessage(`scenario_state.${msg}`, opts)
}

type ValidationState = "SUCCESS" | "FAILED" | "EXECUTING" | "PENDING";

export class Stage {
    private state: ValidationState = "PENDING";
    private inputMsg?: FixComplexType;
    private outputMsgs = new Map<string, { msg: FixComplexType, state: ValidationState }>();
    private startListening = false;
    private waitTimer: any;
    private waitTime = DEFAULT_WAIT_TIME;
    private failedReason?: string;
    private sessionSub?: Subscription;
    private eventSubject = new Subject<"UPDATE" | "DONE">();
    private doneCB?: () => void;
    private skipped = false;

    constructor(public name: string, private session: FixSession, private onCaptureParam: (param: string, value: any) => void, waitTime?: number) {
        this.subscribeToSession();
        this.setWaitTime(waitTime)
    }

    getEventObservable() {
        return this.eventSubject.asObservable();
    }

    destroy() {
        this.sessionSub?.unsubscribe()
    }

    setSkipped(state: boolean) {
        this.skipped = state;
    }

    isSkipped() {
        return this.skipped;
    }

    setWaitTime(time?: number) {
        if (time === undefined) {
            this.waitTime = DEFAULT_WAIT_TIME;
        } else {
            this.waitTime = time * 1000;
        }
    }

    getState() {
        return this.state;
    }

    setInput(msg: FixComplexType) {
        this.inputMsg = msg
    }

    getInput() {
        return this.inputMsg;
    }

    addOutputMsg(msg: FixComplexType) {
        this.outputMsgs.set(msg.name, { msg, state: "PENDING" });
    }

    removeInputNsg() {
        this.inputMsg = undefined;
    }

    removeOutputMsg(name: string) {
        this.outputMsgs.delete(name);
    }

    getOutputMsg(name: string) {
        return this.outputMsgs.get(name);
    }

    getAllOutputMsgs() {
        return Array.from(this.outputMsgs.values()).map(inst => inst.msg);
    }

    getFailedReason() {
        return this.failedReason;
    }

    private validateInputValues(expectedValues: any, receviedValues: any): boolean {
        if (expectedValues === receviedValues) return true;

        if (!(expectedValues instanceof Object) || !(receviedValues instanceof Object)) return false;

        if (expectedValues.constructor !== receviedValues.constructor) return false;


        for (var p in expectedValues) {
            if (!expectedValues.hasOwnProperty(p)) continue;

            if (!receviedValues.hasOwnProperty(p)) return false;

            // eslint-disable-next-line
            if (expectedValues[p] == receviedValues[p]) continue;

            if (typeof expectedValues[p] === "boolean") {
                if (receviedValues[p] === "Y" || receviedValues[p] === "N") {
                    continue
                }
            }

            if (!expectedValues[p]) {
                continue;
            }

            if (typeof expectedValues[p] === "string" && expectedValues[p].trim() === "{ignore}") {
                continue;
            }
            
            const getRegex = /{get:(.*?)}/g;
            const match = getRegex.exec(expectedValues[p]);
            if (match) {
                this.onCaptureParam(match[1].trim(), receviedValues[p]);
                continue;
            }

            if (typeof (expectedValues[p]) !== "object") return false;

            if (!this.validateInputValues(expectedValues[p], receviedValues[p])) return false;
        }


        return true;
    }

    private subscribeToSession() {
        this.sessionSub = this.session.getFixEventObservable().subscribe(event => {
            if (!this.startListening) {
                return;
            }

            switch (event.event) {
                case FixSessionEventType.DATA:
                    const { data } = event;
                    if (data && data.direction === "IN") {
                        const expectedMsg = this.outputMsgs.get(data.msg.name);
                        if (expectedMsg) {
                            const expectedValues = JSON.parse(JSON.stringify(expectedMsg.msg.getValue()));
                            const receviedValues = data.msg.getValue();

                            removeFalsyKeys(expectedValues)

                            if (this.validateInputValues(expectedValues, receviedValues)) {
                                expectedMsg.state = "SUCCESS";
                                let isDone = true;
                                this.outputMsgs.forEach(inst => {
                                    if (isDone) {
                                        isDone = inst.state !== "PENDING"
                                    }
                                })

                                if (isDone) {
                                    this.state = "SUCCESS";
                                    this.stop();
                                } else {
                                    this.eventSubject.next("UPDATE");
                                }
                            } else {
                                expectedMsg.state = "FAILED";
                                this.state = "FAILED";
                                this.stop();
                            }
                        }
                    }
                    break;
                case FixSessionEventType.DISCONNECT:
                    this.state = "FAILED";
                    this.failedReason = getIntlMessage("msg_connection_error");
                    this.stop();
                    break;

            }
        })
    }

    private reset() {
        this.outputMsgs.forEach(inst => inst.state = "PENDING")
    }

    run(parameters: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.inputMsg || this.skipped) {
                return resolve();
            }

            this.reset();
            this.state = "EXECUTING";
            this.session.send(this.inputMsg, parameters).then(() => {
                if (this.outputMsgs.size === 0) {
                    this.state = "SUCCESS";
                    resolve();
                    return;
                }

                this.doneCB = resolve;
                this.startListening = true;
                this.state = "PENDING";
                this.startTimer();
            }).catch((error: Error) => {
                this.state = "FAILED";
                this.failedReason = error.message;
                resolve();
            })

        });
    }

    loadFromFile(structure: SaveFileStageStructure) {
        const inputMsg = this.session.createNewMessageInst(structure.inputMsg.name);
        if (inputMsg) {
            inputMsg.setValue(JSON.parse(structure.inputMsg.data));
            this.setInput(inputMsg)
        }

        structure.outputMsgs.forEach(inst => {
            const outputMsg = this.session.createNewMessageInst(inst.name);
            if (outputMsg) {
                outputMsg.setValue(JSON.parse(inst.data));
                this.addOutputMsg(outputMsg);
            }
        })

        this.skipped = structure.skipped ?? false;
    }

    getDataToSave(): SaveFileStageStructure | undefined {
        if (!this.inputMsg) {
            return undefined;
        }

        return {
            name: this.name,
            waitTime: (this.waitTime / 1000),
            skipped: this.skipped,
            inputMsg: { name: this.inputMsg.name, data: JSON.stringify(this.inputMsg.getValue()) },
            outputMsgs: Array.from(this.outputMsgs.values()).map(inst => ({ name: inst.msg.name, data: JSON.stringify(inst.msg.getValue()) }))
        }
    }

    getWaitTime() {
        return this.waitTime / 1000
    }

    stop(reset?: boolean) {
        if (reset) {
            this.state = "PENDING";
        }

        clearTimeout(this.waitTimer);
        this.startListening = false;
        this.eventSubject.next("DONE");
        this.doneCB?.();
    }

    private startTimer() {
        this.waitTimer = setTimeout(() => {
            this.state = "FAILED";
            this.failedReason = getIntlMessage("msg_timeout", this.waitTime / 1000)
        }, this.waitTime)
    }
}

interface SaveFileStageStructure {
    name: string, waitTime: number, skipped: boolean,
    inputMsg: { name: string, data: string }, outputMsgs: { name: string, data: string }[]
}
interface SaveFileStructure {
    stages: SaveFileStageStructure[]
}

export class Scenario {
    private stages: { stage: Stage, sub: Subscription }[] = [];
    private parameters: any = {};
    private stageUpdatedSubject = new Subject<void>();
    private state: ValidationState = "PENDING";
    private runPromise?: any;

    constructor(public name: string, private session: FixSession) {

    }

    getState() {
        return this.state;
    }

    getAllStages() {
        return this.stages.map(({ stage }) => stage);
    }

    loadFromFile(data: string) {
        const obj: SaveFileStructure = JSON.parse(data);
        obj.stages.forEach(inst => {
            const stage = this.addStage(inst.name, inst.waitTime, true);
            stage.loadFromFile(inst);
        })
    }

    addStage(name: string, waitTime: number, mute = false) {
        const stage = new Stage(name, this.session, (param: string, value: any) => {
            this.parameters[param] = value;
        }, waitTime);
        this.stages.push({ stage, sub: stage.getEventObservable().subscribe(() => this.stageUpdatedSubject.next()) });
        if (!mute) {
            this.stageUpdatedSubject.next();
        }
        return stage;
    }

    removeStage(name: string) {
        this.stages.filter(inst => inst.stage.name === name)[0]?.sub?.unsubscribe();
        this.stages = this.stages.filter(inst => inst.stage.name !== name)
    }

    getStageUpdateObservable() {
        return this.stageUpdatedSubject.asObservable();
    }

    getDataToSave(): SaveFileStructure {
        return { stages: this.stages.map(({ stage }) => stage.getDataToSave()).filter(x => x !== undefined) as any }
    }

    run(): Promise<void> {
        this.stop();
        this.runPromise = makeCancelable(new Promise(async (resolve, reject) => {
            this.state = "EXECUTING";
            this.stageUpdatedSubject.next();

            let skip = false;
            for (let i = 0; i < this.stages.length; i++) {
                if (skip) { continue; }
                const stage = this.stages[i].stage
                await stage.run(this.parameters);
                if (stage.getState() === "FAILED") {
                    skip = true;
                }
            }

            this.state = "SUCCESS";
            this.stages.forEach(({ stage }) => {
                if (this.state === "SUCCESS") {
                    this.state = stage.getState()
                }
            })

            this.stageUpdatedSubject.next();
            resolve(undefined);
        }))


        return this.runPromise.promise;
    }

    stop() {
        this.runPromise?.cancel();
        this.state = "PENDING";
        this.stages.forEach(({ stage }) => stage.stop(true));
        this.stageUpdatedSubject.next();
    }
}