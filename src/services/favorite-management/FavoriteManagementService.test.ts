import { describe, expect, it, vi } from 'vitest';
import { FavoriteManagementService } from './FavoriteManagementService';
import { createTestParser } from 'src/test-support/testDictionary';

/** In-memory stand-in for the electron file manager IPC. */
const createFileManager = () => {
    const files = new Map<string, string>();
    return {
        files,
        createDir: vi.fn(async () => ({ requestId: 0 })),
        writeFile: vi.fn(async (path: string, content: string) => { files.set(path, content); return { requestId: 0, status: true }; }),
        readFile: vi.fn(async (path: string) => ({ requestId: 0, fileData: { data: files.get(path)!, lastUpdatedTime: '', size: 0 } })),
        deleteFile: vi.fn(async (path: string) => { files.delete(path); return { requestId: 0, status: true }; }),
        listDirContent: vi.fn(async (dir: string) => ({
            requestId: 0,
            files: Array.from(files.keys()).filter(p => p.startsWith(dir + '/')).map(p => p.substring(dir.length + 1)),
        })),
    };
};

const profile = { name: 'p', dictionaryLocation: '/dicts/FIX44.xml' } as any;

describe('FavoriteManagementService header overrides', () => {
    it('round-trips message-level header overrides through the favorite file', async () => {
        const parser = await createTestParser();
        const session = { profile, createNewMessageInst: (name: string) => parser.getMessageDef(name)?.clone() } as any;
        const fileManager = createFileManager();
        const service = new FavoriteManagementService({ getWorkingDir: () => '/wd' } as any, fileManager as any);

        const def = parser.getMessageDef('NewOrderSingle')!;
        await service.addToFavorites(profile, def, 'with-obo', { ClOrdID: 'C1' }, { OnBehalfOfCompID: 'OBO' });
        await service.addToFavorites(profile, def, 'plain', { ClOrdID: 'C2' });
        await service.addToFavorites(profile, def, 'empty-overrides', { ClOrdID: 'C3' }, {});

        expect(JSON.parse(fileManager.files.get('/wd/FIX44/with-obo___NewOrderSingle.json')!))
            .toEqual({ msg: 'NewOrderSingle', data: { ClOrdID: 'C1' }, headerOverrides: { OnBehalfOfCompID: 'OBO' } });
        expect(JSON.parse(fileManager.files.get('/wd/FIX44/plain___NewOrderSingle.json')!))
            .toEqual({ msg: 'NewOrderSingle', data: { ClOrdID: 'C2' } });
        expect(JSON.parse(fileManager.files.get('/wd/FIX44/empty-overrides___NewOrderSingle.json')!))
            .toEqual({ msg: 'NewOrderSingle', data: { ClOrdID: 'C3' } });

        const all = await service.getAllFavorites(session);
        expect(all.map(f => f.name)).toEqual(['empty-overrides', 'plain', 'with-obo']);
        expect(all.find(f => f.name === 'with-obo')!.msg.getHeaderOverrides()).toEqual({ OnBehalfOfCompID: 'OBO' });
        expect(all.find(f => f.name === 'with-obo')!.msg.getValue()).toEqual({ ClOrdID: 'C1' });
        expect(all.find(f => f.name === 'plain')!.msg.getHeaderOverrides()).toBeUndefined();

        const single = await service.getFavorite('with-obo', session);
        expect(single.getHeaderOverrides()).toEqual({ OnBehalfOfCompID: 'OBO' });
    });

    it('still loads favorites written before header overrides existed', async () => {
        const parser = await createTestParser();
        const session = { profile, createNewMessageInst: (name: string) => parser.getMessageDef(name)?.clone() } as any;
        const fileManager = createFileManager();
        fileManager.files.set('/wd/FIX44/legacy___Heartbeat.json', JSON.stringify({ msg: 'Heartbeat', data: { TestReqID: '1' } }));
        const service = new FavoriteManagementService({ getWorkingDir: () => '/wd' } as any, fileManager as any);

        const legacy = await service.getFavorite('legacy', session);
        expect(legacy.getValue()).toEqual({ TestReqID: '1' });
        expect(legacy.getHeaderOverrides()).toBeUndefined();
    });
});
