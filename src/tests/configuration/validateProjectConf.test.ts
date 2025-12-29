import { validateProjectConf } from '../../services/configuration/validateProjectConf';
import * as fsUtils from '../../utils/fs';

jest.mock('../../utils/fs');

describe('configuration/validateProjectConf', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw if config.json is missing', async () => {
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue(null);
        await expect(validateProjectConf()).rejects.toThrow(/not found/);
    });

    it('should throw if config.json is invalid', async () => {
        (fsUtils.getFileContent as jest.Mock).mockResolvedValue('invalid json');
        await expect(validateProjectConf()).rejects.toThrow(/parsing/);
    });

    it('should validate correctly for valid config', async () => {
        const validConfig = {
            name: "test",
            version: "1.0.0",
            engineVersion: "0.0.0",
            entryPoints: ["main.xml"],
            targetPlatforms: ["windows"],
            targetLanguages: ["rust"]
        };
        (fsUtils.getFileContent as jest.Mock).mockImplementation((path) => {
            if (path === 'config.json') return Promise.resolve(JSON.stringify(validConfig));
            if (path === 'main.xml') return Promise.resolve('<on_start></on_start>');
            return Promise.resolve(null);
        });

        await expect(validateProjectConf()).resolves.not.toThrow();
    });

    it('should throw if entry point is missing', async () => {
        const validConfig = {
            name: "test",
            version: "1.0.0",
            engineVersion: "0.0.0",
            entryPoints: ["missing.xml"],
            targetPlatforms: ["windows"],
            targetLanguages: ["rust"]
        };
        (fsUtils.getFileContent as jest.Mock).mockImplementation((path) => {
            if (path === 'config.json') return Promise.resolve(JSON.stringify(validConfig));
            return Promise.resolve(null);
        });

        await expect(validateProjectConf()).rejects.toThrow(/does not exist/);
    });
});
