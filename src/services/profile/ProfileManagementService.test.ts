import { describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';

vi.mock('./SecureKeyManager', () => ({
    SecureKeyManager: class {
        addKey = vi.fn(async () => ({}));
        findKeyForService = vi.fn(async () => undefined);
    },
}));

import { ProfileManagementService } from './ProfileManagementService';

const FILE = '/wd/profiles.json';
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

const createService = (profiles: any[], options: { deferWrites?: boolean } = {}) => {
    const pendingWrites: { content: string, resolve: (result: any) => void }[] = [];
    const writes: string[] = [];
    const fileManager = {
        readFile: vi.fn(async () => ({ requestId: 0, fileData: { data: JSON.stringify(profiles), lastUpdatedTime: '', size: 0 } })),
        writeFile: vi.fn((_path: string, content: string) => {
            writes.push(content);
            if (options.deferWrites) {
                return new Promise<any>(resolve => pendingWrites.push({ content, resolve }));
            }
            return Promise.resolve({ requestId: 0, status: true });
        }),
    };
    const initSubject = new BehaviorSubject<boolean>(true);
    const readySnapshots: string[][] = [];
    const appManager = {
        getWorkingDir: () => '/wd',
        getProfilesFile: () => FILE,
        getServiceInitObservable: () => initSubject.asObservable(),
        // Record which profiles were registered at the moment the app was declared ready.
        onApplicationReady: vi.fn(() => readySnapshots.push([...service.getAllClientProfiles(), ...service.getAllServerProfiles()].map(p => p.name).sort())),
    };
    const service: ProfileManagementService = new ProfileManagementService(appManager as any, fileManager as any);
    const updates = vi.fn();
    service.getProfileUpdateObservable().subscribe(updates);
    return { service, fileManager, appManager, writes, pendingWrites, updates, readySnapshots };
};

const clientProfile = (name: string, extra: any = {}) => ({
    name, ip: '127.0.0.1', port: 1, senderCompId: 'S', targetCompId: 'T', dictionaryLocation: '/d.xml', fixVersion: '4', ...extra,
});

describe('ProfileManagementService session parameter persistence', () => {
    it('marks the application ready only after every profile is registered', async () => {
        const { service, appManager, readySnapshots } = createService([clientProfile('a'), clientProfile('b'), { ...clientProfile('srv'), type: 'SERVER' }]);
        await nextTick();

        expect(appManager.onApplicationReady).toHaveBeenCalledTimes(1);
        expect(readySnapshots).toEqual([['a', 'b', 'srv']]);
        expect(service.getAllClientProfiles().map(p => p.name).sort()).toEqual(['a', 'b']);
        expect(service.getAllServerProfiles().map(p => p.name)).toEqual(['srv']);
    });

    it('writes counters of the registered profile without credentials, keychain access or update events', async () => {
        const { service, writes, updates } = createService([clientProfile('a', { sessionParams: { SESS: { value: 'S_' } } })]);
        await nextTick();

        const profile = service.getProfile('a')! as any;
        profile.username = 'user';
        profile.password = 'secret';
        profile.sessionParams.SESS.count = 7;

        expect(service.saveSessionParameters(profile)).toBe(true);
        const written = JSON.parse(writes[writes.length - 1]);
        expect(written).toEqual([expect.objectContaining({ name: 'a', sessionParams: { SESS: { value: 'S_', count: 7 } } })]);
        expect(written[0].username).toBeUndefined();
        expect(written[0].password).toBeUndefined();
        expect((service as any).secureKeyManager.addKey).not.toHaveBeenCalled();
        expect(updates).not.toHaveBeenCalled();
    });

    it('carries session parameters over to the registered object when the session holds a detached copy', async () => {
        const { service, writes } = createService([clientProfile('a', { port: 1 })]);
        await nextTick();

        // The user edited the profile while the session was open: the map now holds a new object.
        const edited = clientProfile('a', { port: 2, username: '', password: '' });
        service.addOrEditProfile(edited as any);
        const detached = { ...clientProfile('a', { port: 1 }), sessionParams: { SESS: { value: 'S_', count: 3 } } };

        expect(service.saveSessionParameters(detached as any)).toBe(true);
        expect(service.getProfile('a')).toBe(edited);
        expect((service.getProfile('a') as any).sessionParams).toBe(detached.sessionParams);
        // The write triggered by the edit is still in flight, so this save is coalesced into a follow-up write.
        await nextTick();
        const written = JSON.parse(writes[writes.length - 1]);
        expect(written[0].port).toBe(2);
        expect(written[0].sessionParams).toEqual({ SESS: { value: 'S_', count: 3 } });
    });

    it('ignores profiles that were never registered and type mismatches', async () => {
        const { service, writes } = createService([{ ...clientProfile('srv'), type: 'SERVER' }]);
        await nextTick();
        const before = writes.length;

        expect(service.saveSessionParameters(clientProfile('temporary') as any)).toBe(false);
        expect(service.saveSessionParameters(clientProfile('srv') as any)).toBe(false);
        expect(writes.length).toBe(before);
    });

    it('coalesces overlapping profile writes into one follow-up write of the latest state', async () => {
        const { service, fileManager, pendingWrites } = createService([clientProfile('a', { sessionParams: { SESS: { value: 'S_' } } })], { deferWrites: true });
        await nextTick();
        const profile = service.getProfile('a')! as any;

        profile.sessionParams.SESS.count = 1; service.saveSessionParameters(profile);
        profile.sessionParams.SESS.count = 2; service.saveSessionParameters(profile);
        profile.sessionParams.SESS.count = 3; service.saveSessionParameters(profile);
        expect(fileManager.writeFile).toHaveBeenCalledTimes(1);

        pendingWrites[0].resolve({ status: true });
        await nextTick();
        expect(fileManager.writeFile).toHaveBeenCalledTimes(2);
        expect(JSON.parse(pendingWrites[1].content)[0].sessionParams.SESS.count).toBe(3);

        pendingWrites[1].resolve({ status: true });
        await nextTick();
        expect(fileManager.writeFile).toHaveBeenCalledTimes(2);
    });
});
