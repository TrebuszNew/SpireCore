import { setupModulesConfigs } from '../../../services/projectCreation/rust/setupModules';
import * as fsUtils from '../../../utils/fs';

jest.mock('../../../utils/fs');
jest.mock('../../../services/projectCreation/sections', () => ({
    addToSectionInTargetScope: jest.fn()
}));

describe('projectCreation/rust/setupModules', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should setup module folders and Cargo.toml', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({ name: 'testProject' });
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['mod1']);
        (fsUtils.loadModuleConfig as jest.Mock).mockResolvedValue({
            version: '1.0.0',
            moduleType: 'default'
        });
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({
            addFileToLocalScope: { 'lib.rs': { text: 'code' } }
        });

        await setupModulesConfigs();

        expect(fsUtils.createDir).toHaveBeenCalled();
        expect(fsUtils.createFile).toHaveBeenCalledWith(
            expect.stringContaining('Cargo.toml'),
            expect.any(String)
        );
    });

    it('should handle rendering modules and target sections', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({ name: 'testProject' });
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['renderMod']);
        (fsUtils.loadModuleConfig as jest.Mock).mockResolvedValue({
            version: '1.0.0',
            moduleType: 'rendering'
        });
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({
            addToSectionInWindowTargetScope: {
                createWindow: { text: 'window code' }
            },
            addToSectionInTargetScope: {
                eventRender: { text: 'render code' }
            }
        });

        await setupModulesConfigs();

        const { addToSectionInTargetScope } = require('../../../services/projectCreation/sections');
        expect(addToSectionInTargetScope).toHaveBeenCalledWith('eventRender', 'render code');
    });

    it('should handle windowing modules and eventLoop section', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({ name: 'testProject' });
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['windowMod']);
        (fsUtils.loadModuleConfig as jest.Mock).mockResolvedValue({
            version: '1.0.0',
            moduleType: 'windowing'
        });
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({
            addToSectionInTargetScope: {
                eventLoop: { text: 'loop code' }
            }
        });

        await setupModulesConfigs();

        const { addToSectionInTargetScope } = require('../../../services/projectCreation/sections');
        expect(addToSectionInTargetScope).toHaveBeenCalledWith('eventLoop', 'loop code');
    });
});
