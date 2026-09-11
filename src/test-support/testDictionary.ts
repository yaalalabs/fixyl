import fs from 'node:fs';
import path from 'node:path';
import { FixDefinitionParser } from 'src/services/fix/FixDefinitionParser';
import { FixVersion } from 'src/services/fix/FixDefs';

export const MINIMAL_FIX44_PATH = path.resolve(__dirname, 'fix44-minimal.xml');

export const readMinimalFix44 = () => fs.readFileSync(MINIMAL_FIX44_PATH, 'utf-8');

/** File manager stub that serves the minimal dictionary for any path. */
export const dictionaryFileManager = {
    readFile: async (_path: string) => ({ fileData: { data: readMinimalFix44(), lastUpdatedTime: '', size: 0 } }),
};

/** Builds a parser from the minimal dictionary and resolves once it is ready. */
export const createTestParser = (): Promise<FixDefinitionParser> => {
    return new Promise((resolve) => {
        const parser: FixDefinitionParser = new FixDefinitionParser(
            { path: MINIMAL_FIX44_PATH, fixVersion: FixVersion.FIX_4 },
            dictionaryFileManager,
            () => resolve(parser),
        );
    });
};
