import { initProject } from '../../services/projectCreation/initProject';
import * as fsUtils from '../../utils/fs';
import * as utils from '../../utils/utils';
import fs from 'fs';

jest.mock('../../utils/fs');
jest.mock('../../utils/utils');
jest.mock('fs', () => ({
    mkdir: jest.fn((p, o, cb) => cb(null)),
    promises: {
        readdir: jest.fn().mockResolvedValue([]),
        rm: jest.fn().mockResolvedValue(undefined),
    }
}));

describe('projectCreation/initProject', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize project path and run cargo init', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({ name: 'testProject' });
        (utils.runCmd as jest.Mock).mockResolvedValue({ stdout: '', stderr: '' });

        const pathResult = await initProject();
        expect(pathResult).toContain('testProject');
        expect(utils.runCmd).toHaveBeenCalledWith('cargo init', expect.any(String));
    });

    it('should throw error on failure', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockRejectedValue(new Error('failed'));
        await expect(initProject()).rejects.toThrow(/Error during project initialization/);
    });
});
