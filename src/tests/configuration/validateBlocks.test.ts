import { validateBlocksDef, checkInputsSection, checkCodeSection } from '../../services/configuration/validateBlocks';
import * as fsUtils from '../../utils/fs';
import * as blockParser from '../../utils/parsers/blockDef';

jest.mock('../../utils/fs');
jest.mock('../../utils/parsers/blockDef');

describe('configuration/validateBlocks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkInputsSection', () => {
        it('should correctly validate valid inputs', () => {
            const blockDef = {
                inputs: {
                    param1: { type: ['uint'], canYouPutBlockIn: false }
                }
            };
            expect(() => checkInputsSection(blockDef as any, 'test')).not.toThrow();
        });

        it('should throw for block type with canYouPutBlockIn false', () => {
            const blockDef = {
                inputs: {
                    param1: { type: ['block'], canYouPutBlockIn: false }
                }
            };
            expect(() => checkInputsSection(blockDef as any, 'test')).toThrow();
        });
    });

    describe('checkCodeSection', () => {
        it('should validate code with addAtBlockLocation', () => {
            const blockDef = { code: 'addAtBlockLocation("test");' };
            expect(() => checkCodeSection(blockDef as any, 'test')).not.toThrow();
        });

        it('should throw if addAtBlockLocation is missing', () => {
            const blockDef = { code: 'console.log("test");' };
            expect(() => checkCodeSection(blockDef as any, 'test')).toThrow();
        });

        it('should throw for invalid JS', () => {
            const blockDef = { code: 'const a =' };
            expect(() => checkCodeSection(blockDef as any, 'test')).toThrow();
        });
    });

    describe('validateBlocksDef', () => {
        it('should iterate over modules and blocks', async () => {
            (fsUtils.blocksList as jest.Mock).mockResolvedValue({
                module1: ['block1']
            });
            (fsUtils.getFileContent as jest.Mock).mockResolvedValue('<block></block>');
            (blockParser.parseBlockDef as jest.Mock).mockResolvedValue({
                inputs: {},
                code: 'addAtBlockLocation("test");'
            });

            await expect(validateBlocksDef()).resolves.not.toThrow();
        });
    });
});
