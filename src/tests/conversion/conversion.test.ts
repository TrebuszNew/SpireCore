import { conversion } from '../../services/conversion/conversion';
import * as fsUtils from '../../utils/fs';
import * as userCodeParser from '../../utils/parsers/userCode';
import * as preprocessor from '../../services/conversion/preprocessor';

jest.mock('../../utils/fs');
jest.mock('../../utils/parsers/userCode');
jest.mock('../../services/conversion/preprocessor');
jest.mock('../../services/conversion/eventOutputs', () => ({
    eventOutputs: jest.fn(() => ({}))
}));
jest.mock('../../services/conversion/blockInputs', () => ({
    blockInputs: jest.fn(() => ({}))
}));

describe('conversion/conversion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should convert user code to internal representation', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({
            entryPoints: ['main.xml']
        });
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue('<xml></xml>');
        (userCodeParser.parseCodeUser as jest.Mock).mockResolvedValue([
            {
                on_start: [],
                '#flags': { module: 'test' }
            }
        ]);
        (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('test');
        (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
            handle: { suffix: 'start' }
        });

        const result = await conversion();
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('test__on_start__start');
    });

    it('should throw if entry file is missing', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({
            entryPoints: ['main.xml']
        });
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue(null);

        await expect(conversion()).rejects.toThrow(/User code not found/);
    });
});
