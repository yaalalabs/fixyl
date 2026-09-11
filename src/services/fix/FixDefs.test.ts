import { describe, expect, it, vi } from 'vitest';
import { FixFieldDef, Parameters } from './FixDefs';

const stringField = (name = 'ClOrdID', number = '11') => new FixFieldDef({
    name: 'field', type: 'element', value: '', parent: null as any,
    attributes: { name, number, type: 'STRING' }, children: [],
});

describe('FixFieldDef.formatValueToPack parameter fillers', () => {
    it('{incr:} increments the shared Parameter object in place and appends the count', () => {
        const params: Parameters = { ORD: { value: 'ORD_' } };
        const field = stringField();

        expect(field.formatValueToPack('{incr:ORD}', params)).toBe('ORD_1');
        expect(field.formatValueToPack('{incr:ORD}', params)).toBe('ORD_2');
        expect(params.ORD.count).toBe(2);
    });

    it('{incr:} continues from a previously persisted count', () => {
        const params: Parameters = { ORD: { value: 'ORD_', count: 41 } };
        expect(stringField().formatValueToPack('{incr:ORD}', params)).toBe('ORD_42');
    });

    it('{get:} and {set:} resolve to the parameter value without touching the count', () => {
        const params: Parameters = { ACC: { value: 'ACC-1' } };
        const field = stringField();
        expect(field.formatValueToPack('{get:ACC}', params)).toBe('ACC-1');
        expect(field.formatValueToPack('{set:ACC}', params)).toBe('ACC-1');
        expect(params.ACC.count).toBeUndefined();
    });

    it('returns the raw filler text when the parameter is unknown', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(stringField().formatValueToPack('{incr:MISSING}', {})).toBe('{incr:MISSING}');
        expect(warn).toHaveBeenCalled();
    });
});

describe('message-level header overrides', () => {
    it('getEffectiveHeaderOverrides keeps only entries with a value', async () => {
        const { getEffectiveHeaderOverrides } = await import('./FixDefs');
        expect(getEffectiveHeaderOverrides(undefined)).toEqual({});
        expect(getEffectiveHeaderOverrides({ OnBehalfOfCompID: '', DeliverToCompID: null, Other: undefined })).toEqual({});
        expect(getEffectiveHeaderOverrides({ OnBehalfOfCompID: '   ', DeliverToCompID: 'DLV' })).toEqual({ DeliverToCompID: 'DLV' });
        expect(getEffectiveHeaderOverrides({ OnBehalfOfCompID: 'OBO', DeliverToCompID: '' })).toEqual({ OnBehalfOfCompID: 'OBO' });
        // Only the whitelisted header fields survive, so a hand-edited file cannot inject other header tags.
        expect(getEffectiveHeaderOverrides({ PossDupFlag: 'Y', OnBehalfOfCompID: 'OBO' })).toEqual({ OnBehalfOfCompID: 'OBO' });
        expect(getEffectiveHeaderOverrides({ OnBehalfOfCompID: '{get:OBO}' })).toEqual({ OnBehalfOfCompID: '{get:OBO}' });
    });

    it('FixComplexType stores effective overrides only and clears them when nothing is left', async () => {
        const { createTestParser } = await import('src/test-support/testDictionary');
        const parser = await createTestParser();
        const msg = parser.getMessageDef('NewOrderSingle')!.clone();

        expect(msg.getHeaderOverrides()).toBeUndefined();
        msg.setHeaderOverrides({ OnBehalfOfCompID: 'OBO', DeliverToCompID: '' });
        expect(msg.getHeaderOverrides()).toEqual({ OnBehalfOfCompID: 'OBO' });
        msg.setHeaderOverrides({ OnBehalfOfCompID: '' });
        expect(msg.getHeaderOverrides()).toBeUndefined();
        msg.setHeaderOverrides({ DeliverToCompID: 'DLV' });
        msg.setHeaderOverrides(undefined);
        expect(msg.getHeaderOverrides()).toBeUndefined();
    });

    it('clone() starts without overrides, like it starts without a value', async () => {
        const { createTestParser } = await import('src/test-support/testDictionary');
        const parser = await createTestParser();
        const msg = parser.getMessageDef('NewOrderSingle')!.clone();
        msg.setHeaderOverrides({ OnBehalfOfCompID: 'OBO' });
        expect(msg.clone().getHeaderOverrides()).toBeUndefined();
    });
});
