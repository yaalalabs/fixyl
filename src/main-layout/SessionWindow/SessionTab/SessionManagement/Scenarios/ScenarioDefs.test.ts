import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';

// ScenarioDefs imports FixSession for the event enum, which drags in renderer-only modules.
vi.mock('src/translations/language-manager', () => ({ LM: { getMessage: (key: string) => key } }));
vi.mock('src/common/Toast/Toast', () => ({ Toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/services/log-management/LogService', () => ({ LogService: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('src/services/GlobalServiceRegistry', () => ({ GlobalServiceRegistry: {} }));
vi.mock('react-sortable-hoc', () => ({ arrayMove: (arr: any[], from: number, to: number) => { const copy = [...arr]; copy.splice(to, 0, copy.splice(from, 1)[0]); return copy; } }));

import { Scenario } from './ScenarioDefs';
import { createTestParser } from 'src/test-support/testDictionary';

const createSessionStub = async () => {
    const parser = await createTestParser();
    return {
        getFixEventObservable: () => new Subject<any>().asObservable(),
        createNewMessageInst: (name: string) => parser.getMessageDef(name)?.clone(),
        getSessionParameters: () => ({}),
        send: vi.fn(async () => undefined),
    } as any;
};

describe('Scenario save/load with message-level header overrides', () => {
    it('persists the input message overrides and restores them', async () => {
        const session = await createSessionStub();
        const scenario = new Scenario('s1', session);
        const stage = scenario.addStage('stage-1', 5, true);

        const input = session.createNewMessageInst('NewOrderSingle')!;
        input.setValue({ ClOrdID: 'C1' });
        input.setHeaderOverrides({ OnBehalfOfCompID: 'OBO', DeliverToCompID: '' });
        stage.setInput(input);

        const expected = session.createNewMessageInst('ExecutionReport')!;
        expected.setValue({ OrderID: '{get:ORDER}' });
        stage.addOutputMsg(expected);

        const saved = JSON.parse(JSON.stringify(scenario.getDataToSave()));
        expect(saved.stages[0].inputMsg).toEqual({ name: 'NewOrderSingle', data: JSON.stringify({ ClOrdID: 'C1' }), headerOverrides: { OnBehalfOfCompID: 'OBO' } });
        expect(saved.stages[0].outputMsgs[0]).toEqual({ name: 'ExecutionReport', data: JSON.stringify({ OrderID: '{get:ORDER}' }) });

        const restored = new Scenario('s1', session);
        restored.loadFromFile(JSON.stringify(saved));
        const restoredInput = restored.getAllStages()[0].getInput()!;
        expect(restoredInput.getValue()).toEqual({ ClOrdID: 'C1' });
        expect(restoredInput.getHeaderOverrides()).toEqual({ OnBehalfOfCompID: 'OBO' });
    });

    it('loads scenario files written before header overrides existed', async () => {
        const session = await createSessionStub();
        const legacy = { stages: [{ name: 'old', skipped: false, inputMsg: { name: 'Heartbeat', data: '{}' }, outputMsgs: [] }] };
        const scenario = new Scenario('legacy', session);
        scenario.loadFromFile(JSON.stringify(legacy));
        expect(scenario.getAllStages()[0].getInput()!.getHeaderOverrides()).toBeUndefined();
    });
});
