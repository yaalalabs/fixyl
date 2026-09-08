import { describe, expect, it, vi } from 'vitest';

describe('FileManagementService request bookkeeping', () => {
    it('frees the pending request once its response arrived', async () => {
        let receive: ((data: string) => void) | undefined;
        const send = vi.fn();
        vi.stubGlobal('window', { api: { send, receive: (_channel: string, cb: (data: string) => void) => { receive = cb; } } });
        const { FileManagementService } = await import('./FileManagementService');

        const service = new FileManagementService();
        const pending = service.readFile('/wd/a.json');
        expect(send).toHaveBeenCalledWith('fileManagerOut', ['R', 0, '/wd/a.json']);
        expect((service as any).requestMap.size).toBe(1);

        receive!(JSON.stringify({ requestId: 0, fileData: { data: '{}', lastUpdatedTime: '', size: 2 } }));
        await expect(pending).resolves.toMatchObject({ requestId: 0, fileData: { data: '{}' } });
        expect((service as any).requestMap.size).toBe(0);

        // A response for an unknown request is ignored instead of throwing.
        expect(() => receive!(JSON.stringify({ requestId: 99 }))).not.toThrow();
    });
});
