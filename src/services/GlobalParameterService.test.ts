import { describe, expect, it, vi } from 'vitest';
import { GlobalParameterService } from './GlobalParameterService';
import { Parameters } from './fix/FixSession';

const FILE = '/wd/global_params.json';

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

const createService = (options: { fileContent?: string | Error, workingDir?: string, deferRead?: boolean } = {}) => {
    const { fileContent = JSON.stringify({}), deferRead = false } = options;
    const workingDir = 'workingDir' in options ? options.workingDir : '/wd';

    let resolveRead: (() => void) | undefined;
    const readFile = vi.fn(async () => {
        if (deferRead) {
            await new Promise<void>(resolve => { resolveRead = resolve; });
        }
        if (fileContent instanceof Error) {
            throw fileContent;
        }
        return { requestId: 0, fileData: { data: fileContent, lastUpdatedTime: '', size: 0 } };
    });
    const writeFile = vi.fn(async () => ({ requestId: 0, status: true }));

    const appManager = { getWorkingDir: () => workingDir, getGlobalParametersFile: () => FILE };
    const service = new GlobalParameterService(appManager as any, { readFile, writeFile } as any);
    const updates = vi.fn();
    service.getUpdateObservable().subscribe(updates);

    return { service, readFile, writeFile, updates, finishRead: () => resolveRead?.() };
};

const lastWritten = (writeFile: ReturnType<typeof vi.fn>): Parameters => {
    const call = writeFile.mock.calls[writeFile.mock.calls.length - 1] as unknown as [string, string];
    expect(call[0]).toBe(FILE);
    return JSON.parse(call[1]);
};

describe('GlobalParameterService', () => {
    it('loads parameters including persisted counters from global_params.json', async () => {
        const { service, updates } = createService({ fileContent: JSON.stringify({ ORD: { value: 'ORD_', count: 12 } }) });
        await nextTick();

        expect(service.getGlobalParameters()).toEqual({ ORD: { value: 'ORD_', count: 12 } });
        expect(updates).toHaveBeenCalledTimes(1);
    });

    it('does not touch the file system without a working directory', async () => {
        const { service, readFile, writeFile } = createService({ workingDir: undefined });
        await nextTick();

        expect(readFile).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
        expect(service.getGlobalParameters()).toEqual({});
    });

    it('falls back to an empty map when the file is missing or corrupted', async () => {
        const missing = createService({ fileContent: new Error('ENOENT') });
        const corrupted = createService({ fileContent: '{not json' });
        await nextTick();

        expect(missing.service.getGlobalParameters()).toEqual({});
        expect(corrupted.service.getGlobalParameters()).toEqual({});
        expect(missing.writeFile).not.toHaveBeenCalled();
        expect(corrupted.writeFile).not.toHaveBeenCalled();
    });

    it('persistIfChanged writes the counter mutated on the shared Parameter object and skips unchanged states', async () => {
        const { service, writeFile, updates } = createService({ fileContent: JSON.stringify({ ORD: { value: 'ORD_' } }) });
        await nextTick();
        updates.mockClear();

        expect(service.persistIfChanged()).toBe(false);
        expect(writeFile).not.toHaveBeenCalled();

        // This is what the {incr:} filler does during encoding: it mutates the live object.
        const shared = { ...service.getGlobalParameters() };
        shared.ORD.count = 1;

        expect(service.persistIfChanged()).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(lastWritten(writeFile)).toEqual({ ORD: { value: 'ORD_', count: 1 } });
        expect(updates).toHaveBeenCalledTimes(1);

        expect(service.persistIfChanged()).toBe(false);
        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('re-adding a parameter resets its counter and removing it writes the file', async () => {
        const { service, writeFile } = createService({ fileContent: JSON.stringify({ ORD: { value: 'ORD_', count: 9 }, ACC: { value: 'A' } }) });
        await nextTick();

        service.setGlobalParameter('ORD', 'NEW_');
        expect(lastWritten(writeFile)).toEqual({ ORD: { value: 'NEW_' }, ACC: { value: 'A' } });
        await nextTick();

        service.removeGlobalParameter('ACC');
        expect(lastWritten(writeFile)).toEqual({ ORD: { value: 'NEW_' } });
        await nextTick();
        expect(service.persistIfChanged()).toBe(false);
    });

    it('keeps a parameter added before the initial read resolved and writes the merged state', async () => {
        const { service, writeFile, finishRead } = createService({
            fileContent: JSON.stringify({ ORD: { value: 'ORD_', count: 3 } }),
            deferRead: true,
        });
        await nextTick();

        service.setGlobalParameter('ACC', 'A');
        expect(lastWritten(writeFile)).toEqual({ ACC: { value: 'A' } });
        await nextTick();

        finishRead();
        await nextTick();
        await nextTick();

        expect(service.getGlobalParameters()).toEqual({ ACC: { value: 'A' }, ORD: { value: 'ORD_', count: 3 } });
        expect(lastWritten(writeFile)).toEqual({ ACC: { value: 'A' }, ORD: { value: 'ORD_', count: 3 } });
        expect(service.persistIfChanged()).toBe(false);
    });

    it('keeps the same map object across the load so earlier references stay live', async () => {
        const { service } = createService({ fileContent: JSON.stringify({ ORD: { value: 'ORD_' } }), deferRead: true });
        const before = service.getGlobalParameters();
        await nextTick();
        expect(service.getGlobalParameters()).toBe(before);
    });
});

describe('GlobalParameterService write serialization', () => {
    const createDeferredService = async (fileContent = JSON.stringify({ ORD: { value: 'ORD_' } })) => {
        const pendingWrites: { content: string, resolve: (result: any) => void }[] = [];
        const readFile = vi.fn(async () => ({ requestId: 0, fileData: { data: fileContent, lastUpdatedTime: '', size: 0 } }));
        const writeFile = vi.fn((_path: string, content: string) => new Promise<any>(resolve => pendingWrites.push({ content, resolve })));
        const appManager = { getWorkingDir: () => '/wd', getGlobalParametersFile: () => FILE };
        const service = new GlobalParameterService(appManager as any, { readFile, writeFile } as any);
        await nextTick();
        return { service, writeFile, pendingWrites };
    };

    it('never overlaps writes and only writes the latest state after a burst of changes', async () => {
        const { service, writeFile, pendingWrites } = await createDeferredService();
        const ord = service.getGlobalParameters().ORD;

        ord.count = 1; expect(service.persistIfChanged()).toBe(true);
        ord.count = 2; expect(service.persistIfChanged()).toBe(true);
        ord.count = 3; expect(service.persistIfChanged()).toBe(true);
        expect(service.persistIfChanged()).toBe(false);
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(JSON.parse(pendingWrites[0].content).ORD.count).toBe(1);

        pendingWrites[0].resolve({ status: true });
        await nextTick();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(JSON.parse(pendingWrites[1].content).ORD.count).toBe(3);

        pendingWrites[1].resolve({ status: true });
        await nextTick();
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(service.persistIfChanged()).toBe(false);
    });

    it('retries on the next change check when a write reports an error', async () => {
        const { service, writeFile, pendingWrites } = await createDeferredService();
        service.getGlobalParameters().ORD.count = 1;
        expect(service.persistIfChanged()).toBe(true);

        pendingWrites[0].resolve({ error: new Error('EACCES') });
        await nextTick();
        expect(service.persistIfChanged()).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(2);
        expect(JSON.parse(pendingWrites[1].content).ORD.count).toBe(1);
    });
});
