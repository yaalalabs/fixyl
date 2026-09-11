import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixVersion } from './FixDefs';

const mocks = vi.hoisted(() => {
    const globalParamsWrites: string[] = [];
    const globalParamsFile = JSON.stringify({ ORD: { value: 'ORD_' }, ACC: { value: 'ACC-1' } });
    return {
        globalParamsWrites,
        globalFileManager: {
            readFile: vi.fn(async () => ({ requestId: 0, fileData: { data: globalParamsFile, lastUpdatedTime: '', size: 0 } })),
            writeFile: vi.fn(async (_path: string, content: string) => { globalParamsWrites.push(content); return { requestId: 0, status: true }; }),
        },
        profileService: { saveSessionParameters: vi.fn(() => true), addOrEditProfile: vi.fn(() => true) },
    };
});

vi.mock('../GlobalServiceRegistry', async () => {
    const { GlobalParameterService } = await import('../GlobalParameterService');
    const { dictionaryFileManager } = await import('src/test-support/testDictionary');
    const appManager = { getWorkingDir: () => '/wd', getGlobalParametersFile: () => '/wd/global_params.json' };
    return {
        GlobalServiceRegistry: {
            fileManger: dictionaryFileManager,
            globalParamsManager: new GlobalParameterService(appManager as any, mocks.globalFileManager as any),
            profile: mocks.profileService,
            favoriteManager: { getFavorite: vi.fn() },
            socket: { createSocket: vi.fn() },
        },
    };
});
vi.mock('src/common/Toast/Toast', () => ({ Toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/translations/language-manager', () => ({ LM: { getMessage: (key: string) => key } }));
vi.mock('../log-management/LogService', () => ({ LogService: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { FixSession } from './FixSession';
import { GlobalServiceRegistry } from '../GlobalServiceRegistry';
import { SOH } from './FixDefinitionParser';

const tagValue = (wire: string, tag: string) => wire.split(SOH).filter(Boolean).map(kv => kv.split('=')).filter(([k]) => k === tag).map(([, v]) => v);

const until = async (condition: () => any) => {
    for (let i = 0; i < 100 && !condition(); i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    if (!condition()) throw new Error('condition never became true');
};

const createProfile = () => ({
    name: 'test-profile', type: 'CLIENT' as const, ip: '127.0.0.1', port: 9876,
    senderCompId: 'SENDER', targetCompId: 'TARGET', dictionaryLocation: '/dictionary.xml', fixVersion: FixVersion.FIX_4,
    username: '', password: '',
    headerFields: { OnBehalfOfCompID: 'PROFILE_OBO' },
    sessionParams: { SESS: { value: 'S_' } },
});

/** Creates a session whose socket writes are captured instead of going to the network. */
const createSession = async (profile = createProfile()) => {
    const session = new FixSession(profile as any);
    await until(() => session.getMessageDef('NewOrderSingle'));
    const sent: string[] = [];
    (session as any).writeToSocket = async (data: string) => { sent.push(data); return true; };
    return { session, sent, profile };
};

const newOrder = (session: FixSession, clOrdId: string) => {
    const msg = session.createNewMessageInst('NewOrderSingle')!;
    msg.setValue({ ClOrdID: clOrdId, Instrument: { Symbol: 'ABC' }, Side: '1', OrdType: '1', TransactTime: '20260908-10:00:00.000' });
    return msg;
};

describe('FixSession parameter counter persistence', () => {
    beforeEach(async () => {
        await until(() => Object.keys(GlobalServiceRegistry.globalParamsManager.getGlobalParameters()).length > 0);
        mocks.globalParamsWrites.length = 0;
        mocks.globalFileManager.writeFile.mockClear();
        mocks.profileService.saveSessionParameters.mockClear();
        delete GlobalServiceRegistry.globalParamsManager.getGlobalParameters().ORD.count;
        GlobalServiceRegistry.globalParamsManager.persistIfChanged();
        mocks.globalParamsWrites.length = 0;
    });

    it('writes the incremented global counter to global_params.json after every send that changed it', async () => {
        const { session, sent } = await createSession();

        await session.send(newOrder(session, '{incr:ORD}'));
        expect(tagValue(sent[0], '11')).toEqual(['ORD_1']);
        expect(mocks.globalParamsWrites).toHaveLength(1);
        expect(JSON.parse(mocks.globalParamsWrites[0]).ORD).toEqual({ value: 'ORD_', count: 1 });

        await session.send(newOrder(session, '{incr:ORD}'));
        expect(tagValue(sent[1], '11')).toEqual(['ORD_2']);
        expect(JSON.parse(mocks.globalParamsWrites[1]).ORD).toEqual({ value: 'ORD_', count: 2 });

        await session.send(newOrder(session, '{get:ACC}'));
        expect(tagValue(sent[2], '11')).toEqual(['ACC-1']);
        expect(mocks.globalParamsWrites).toHaveLength(2);
        expect(mocks.profileService.saveSessionParameters).not.toHaveBeenCalled();
    });

    it('persists session parameters when a session counter changes, without the full profile save', async () => {
        const { session, sent, profile } = await createSession();

        await session.send(newOrder(session, '{incr:SESS}'));
        expect(tagValue(sent[0], '11')).toEqual(['S_1']);
        expect(mocks.profileService.saveSessionParameters).toHaveBeenCalledTimes(1);
        expect(mocks.profileService.saveSessionParameters).toHaveBeenCalledWith(profile);
        expect(profile.sessionParams.SESS).toEqual({ value: 'S_', count: 1 });
        expect(mocks.profileService.addOrEditProfile).not.toHaveBeenCalled();
        expect(mocks.globalParamsWrites).toHaveLength(0);

        await session.send(newOrder(session, 'PLAIN'));
        expect(mocks.profileService.saveSessionParameters).toHaveBeenCalledTimes(1);
    });

    it('does not re-save the profile after an explicit parameter edit that already saved it', async () => {
        const { session } = await createSession();

        session.setSessionParameter('NEW', 'n_');
        expect(mocks.profileService.addOrEditProfile).toHaveBeenCalledTimes(1);
        mocks.profileService.saveSessionParameters.mockClear();

        await session.send(newOrder(session, 'PLAIN'));
        expect(mocks.profileService.saveSessionParameters).not.toHaveBeenCalled();

        session.removeSessionParameter('NEW');
        await session.send(newOrder(session, 'PLAIN'));
        expect(mocks.profileService.saveSessionParameters).not.toHaveBeenCalled();
        mocks.profileService.addOrEditProfile.mockClear();
    });

    it('also persists counters used by scenario runs, which pass an explicit merged parameter map', async () => {
        const { session, sent } = await createSession();
        const merged = { ...session.getSessionParameters(true), CAPTURED: { value: 'X' } };

        await session.send(newOrder(session, '{incr:ORD}'), merged);
        expect(tagValue(sent[0], '11')).toEqual(['ORD_1']);
        expect(JSON.parse(mocks.globalParamsWrites[0]).ORD).toEqual({ value: 'ORD_', count: 1 });
    });

    it('still persists and releases the send lock when the socket write fails', async () => {
        const { session } = await createSession();
        (session as any).writeToSocket = async () => { throw new Error('socket closed'); };

        await expect(session.send(newOrder(session, '{incr:ORD}'))).rejects.toThrow('socket closed');
        expect(JSON.parse(mocks.globalParamsWrites[0]).ORD).toEqual({ value: 'ORD_', count: 1 });

        (session as any).writeToSocket = async () => true;
        await expect(session.send(newOrder(session, 'PLAIN'))).resolves.toBeUndefined();
    });
});

describe('FixSession message-level header overrides', () => {
    it('message-level values win over the profile header fields, empty values fall back', async () => {
        const { session, sent } = await createSession();

        const plain = newOrder(session, 'C1');
        await session.send(plain);
        expect(tagValue(sent[0], '115')).toEqual(['PROFILE_OBO']);
        expect(tagValue(sent[0], '128')).toEqual([]);

        const overridden = newOrder(session, 'C2');
        overridden.setHeaderOverrides({ OnBehalfOfCompID: 'MSG_OBO', DeliverToCompID: 'MSG_DLV' });
        await session.send(overridden);
        expect(tagValue(sent[1], '115')).toEqual(['MSG_OBO']);
        expect(tagValue(sent[1], '128')).toEqual(['MSG_DLV']);

        const partial = newOrder(session, 'C3');
        partial.setHeaderOverrides({ OnBehalfOfCompID: '', DeliverToCompID: 'ONLY_DLV' });
        await session.send(partial);
        expect(tagValue(sent[2], '115')).toEqual(['PROFILE_OBO']);
        expect(tagValue(sent[2], '128')).toEqual(['ONLY_DLV']);
    });

    it('overrides work without any profile header fields and support parameter fillers', async () => {
        const profile = { ...createProfile(), headerFields: undefined };
        const { session, sent } = await createSession(profile as any);

        const msg = newOrder(session, 'C1');
        msg.setHeaderOverrides({ OnBehalfOfCompID: '{get:ACC}' });
        await session.send(msg);
        expect(tagValue(sent[0], '115')).toEqual(['ACC-1']);
        expect(tagValue(sent[0], '128')).toEqual([]);
    });

    it('a resend replays the message with its overrides and the PossDupFlag', async () => {
        const { session, sent } = await createSession();
        session.enableResendRequest(true);

        const msg = newOrder(session, 'C1');
        msg.setHeaderOverrides({ DeliverToCompID: 'MSG_DLV' });
        await session.send(msg);

        const resendRequest = session.createNewMessageInst('ResendRequest')!;
        resendRequest.setValue({ BeginSeqNo: '1', EndSeqNo: '0' });
        (session as any).onResendRequest(resendRequest);
        await until(() => sent.length === 2);

        expect(tagValue(sent[1], '34')).toEqual(['1']);
        expect(tagValue(sent[1], '43')).toEqual(['Y']);
        expect(tagValue(sent[1], '115')).toEqual(['PROFILE_OBO']);
        expect(tagValue(sent[1], '128')).toEqual(['MSG_DLV']);
        expect(tagValue(sent[1], '11')).toEqual(['C1']);
    });
});

describe('FixSession decode paths and resend snapshots', () => {
    it('keeps wire header tags as overrides on the raw-message path but not on inbound traffic', async () => {
        const { session } = await createSession();
        const msg = newOrder(session, 'C1');
        msg.setHeaderOverrides({ OnBehalfOfCompID: 'RAW_OBO' });
        const wire = session.encodeToFix({ msgType: 'D', sequence: 1, time: '20260908-10:00:00.000', senderCompId: 'S', targetCompId: 'T' }, msg);

        const raw = session.decodeFixMessage(wire)!;
        expect(raw.getHeaderOverrides()).toEqual({ OnBehalfOfCompID: 'RAW_OBO' });
        expect(raw.getValue().ClOrdID).toBe('C1');

        const inbound: any[] = [];
        session.getFixEventObservable().subscribe(event => { if (event.data?.direction === 'IN') inbound.push(event.data.msg); });
        (session as any).onData(wire);
        expect(inbound).toHaveLength(1);
        expect(inbound[0].getHeaderOverrides()).toBeUndefined();
        expect(inbound[0].getValue().ClOrdID).toBe('C1');
    });

    it('resends what was sent under a sequence number even if the form instance changed since', async () => {
        const { session, sent } = await createSession();
        session.enableResendRequest(true);

        const instance = newOrder(session, 'FIRST');
        instance.setHeaderOverrides({ OnBehalfOfCompID: 'FIRST_OBO' });
        await session.send(instance);

        instance.setValue({ ...instance.getValue(), ClOrdID: 'SECOND' });
        instance.setHeaderOverrides({ OnBehalfOfCompID: 'SECOND_OBO' });
        await session.send(instance);

        const resendRequest = session.createNewMessageInst('ResendRequest')!;
        resendRequest.setValue({ BeginSeqNo: '1', EndSeqNo: '2' });
        (session as any).onResendRequest(resendRequest);
        await until(() => sent.length === 4);

        expect(tagValue(sent[2], '34')).toEqual(['1']);
        expect(tagValue(sent[2], '11')).toEqual(['FIRST']);
        expect(tagValue(sent[2], '115')).toEqual(['FIRST_OBO']);
        expect(tagValue(sent[3], '34')).toEqual(['2']);
        expect(tagValue(sent[3], '11')).toEqual(['SECOND']);
        expect(tagValue(sent[3], '115')).toEqual(['SECOND_OBO']);
    });

    it('notifies parameter listeners when a session counter changes', async () => {
        const { session } = await createSession();
        const updates = vi.fn();
        session.getParameterUpdateObservable().subscribe(updates);

        await session.send(newOrder(session, 'PLAIN'));
        expect(updates).not.toHaveBeenCalled();
        await session.send(newOrder(session, '{incr:SESS}'));
        expect(updates).toHaveBeenCalledTimes(1);
    });
});
