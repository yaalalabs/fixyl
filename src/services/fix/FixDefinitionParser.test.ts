import { describe, expect, it, beforeAll } from 'vitest';
import { FixDefinitionParser, FixMsgHeader, SOH } from './FixDefinitionParser';
import { createTestParser } from 'src/test-support/testDictionary';

const HEADER: FixMsgHeader = { msgType: 'D', sequence: 7, time: '20260908-10:00:00.000', senderCompId: 'SENDER', targetCompId: 'TARGET' };

const tags = (wire: string) => wire.split(SOH).filter(Boolean).map(kv => kv.split('='));
const tagValue = (wire: string, tag: string) => tags(wire).filter(([k]) => k === tag).map(([, v]) => v);

describe('FixDefinitionParser with the minimal FIX 4.4 dictionary', () => {
    let parser: FixDefinitionParser;

    beforeAll(async () => {
        parser = await createTestParser();
    });

    it('parses messages, header fields and components', () => {
        expect(parser.getMessageDef('NewOrderSingle')?.id).toBe('D');
        expect(parser.getHeaderFields().map(h => (h.field as any).name ?? (h.field as any).def?.name))
            .toEqual(expect.arrayContaining(['OnBehalfOfCompID', 'DeliverToCompID', 'NoHops']));
        expect(parser.getFieldDef('OnBehalfOfCompID')?.number).toBe('115');
        expect(parser.getFieldDef('DeliverToCompID')?.number).toBe('128');
    });

    it('encodes standard header, custom headers and body in FIX order', () => {
        const msg = parser.getMessageDef('NewOrderSingle')!.clone();
        const wire = parser.encodeToFix(msg, { ClOrdID: 'C1', Instrument: { Symbol: 'ABC' }, Side: '1', OrdType: '2' }, HEADER, undefined,
            { OnBehalfOfCompID: 'OBO', DeliverToCompID: 'DLV' });

        expect(wire.startsWith('8=FIX.4.4' + SOH + '9=')).toBe(true);
        expect(tagValue(wire, '35')).toEqual(['D']);
        expect(tagValue(wire, '49')).toEqual(['SENDER']);
        expect(tagValue(wire, '56')).toEqual(['TARGET']);
        expect(tagValue(wire, '115')).toEqual(['OBO']);
        expect(tagValue(wire, '128')).toEqual(['DLV']);
        expect(tagValue(wire, '11')).toEqual(['C1']);
        expect(tagValue(wire, '55')).toEqual(['ABC']);
        expect(tagValue(wire, '10')).toHaveLength(1);
    });

    it('drops empty custom header values instead of sending empty tags', () => {
        const msg = parser.getMessageDef('Heartbeat')!.clone();
        const wire = parser.encodeToFix(msg, {}, { ...HEADER, msgType: '0' }, undefined, { OnBehalfOfCompID: '', DeliverToCompID: undefined });
        expect(tagValue(wire, '115')).toEqual([]);
        expect(tagValue(wire, '128')).toEqual([]);
    });

    it('decodes a message body and leaves standard header tags out of the value', () => {
        const msg = parser.getMessageDef('NewOrderSingle')!.clone();
        const wire = parser.encodeToFix(msg, { ClOrdID: 'C1', Instrument: { Symbol: 'ABC' }, Side: '1', OrdType: '2' }, HEADER, undefined,
            { OnBehalfOfCompID: 'OBO' });

        const decoded = parser.decodeFixMessage(wire)!;
        expect(decoded.header).toMatchObject({ msgType: 'D', sequence: 7, senderCompId: 'SENDER', targetCompId: 'TARGET' });
        expect(decoded.msg.getValue()).toEqual({ ClOrdID: 'C1', Instrument: { Symbol: 'ABC' }, Side: '1', OrdType: '2' });
    });
});

describe('message-level header fields on decode', () => {
    let parser: FixDefinitionParser;

    beforeAll(async () => {
        parser = await createTestParser();
    });

    it('captures OnBehalfOfCompID and DeliverToCompID from the wire as header overrides', () => {
        const msg = parser.getMessageDef('NewOrderSingle')!.clone();
        const wire = parser.encodeToFix(msg, { ClOrdID: 'C1', Side: '1', OrdType: '2' }, HEADER, undefined,
            { OnBehalfOfCompID: 'OBO', DeliverToCompID: 'DLV', PossDupFlag: 'Y' });

        const decoded = parser.decodeFixMessage(wire)!;
        expect(decoded.headerOverrides).toEqual({ OnBehalfOfCompID: 'OBO', DeliverToCompID: 'DLV' });
        // The decoded instance itself stays a plain body: inbound traffic must not carry overrides.
        expect(decoded.msg.getHeaderOverrides()).toBeUndefined();
        expect(decoded.msg.getValue()).toEqual({ ClOrdID: 'C1', Side: '1', OrdType: '2' });
    });

    it('reports no overrides when the wire message has none', () => {
        const msg = parser.getMessageDef('Heartbeat')!.clone();
        const wire = parser.encodeToFix(msg, {}, { ...HEADER, msgType: '0' });
        expect(parser.decodeFixMessage(wire)!.headerOverrides).toBeUndefined();
    });
});
