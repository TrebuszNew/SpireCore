import { preprocess } from '../../services/conversion/preprocessor';
import * as fsUtils from '../../utils/fs';

jest.mock('../../utils/fs');

describe('conversion/preprocessor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should run preprocessors for modules', async () => {
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['module1']);
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({
            Preprocessors: ['task1.js']
        });
        (fsUtils.dirOrFileExists as jest.Mock).mockResolvedValue(true);
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue('customData.test = 123;');

        await preprocess();
        // Since customData is shared, we'd need to check its side effects if exported/accessible
    });

    it('should throw if preprocessor task fails', async () => {
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['module1']);
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({
            Preprocessors: ['task1.js']
        });
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue('throw new Error("fail")');

        await expect(preprocess()).rejects.toThrow(/Preprocess Error/);
    });
});
