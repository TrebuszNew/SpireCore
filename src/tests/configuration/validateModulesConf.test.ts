import { validateModulesConf } from '../../services/configuration/validateModulesConf';
import * as fsUtils from '../../utils/fs';
import fs from 'fs';
import os from 'os';

jest.mock('../../utils/fs');
jest.mock('os');
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readdir: jest.fn(),
    }
}));

describe('configuration/validateModulesConf', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (os.platform as jest.Mock).mockReturnValue('win32');
    });

    it('should validate modules correctly', async () => {
        (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.readdir as jest.Mock).mockResolvedValue([
            { name: 'module1', isDirectory: () => true }
        ]);

        const validModuleConfig = {
            version: "1.0.0",
            engineVersion: "0.0.0",
            supportedPlatforms: ["windows"],
            supportedLanguages: ["rust"],
            moduleType: "default"
        };

        (fsUtils.getFileContent as jest.Mock).mockImplementation((path) => {
            if (path.includes('config.json')) return Promise.resolve(JSON.stringify(validModuleConfig));
            return Promise.resolve(null);
        });

        await expect(validateModulesConf()).resolves.not.toThrow();
    });

    it('should throw if multiple window modules found', async () => {
        (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.readdir as jest.Mock).mockResolvedValue([
            { name: 'win1', isDirectory: () => true },
            { name: 'win2', isDirectory: () => true }
        ]);

        const windowModuleConfig = {
            version: "1.0.0",
            engineVersion: "0.0.0",
            supportedPlatforms: ["windows"],
            supportedLanguages: ["rust"],
            moduleType: "windowing"
        };

        (fsUtils.getFileContent as jest.Mock).mockResolvedValue(JSON.stringify(windowModuleConfig));

        await expect(validateModulesConf()).rejects.toThrow(/already exists/);
    });
});
