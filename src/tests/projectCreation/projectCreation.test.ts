import { projectCreation } from '../../services/projectCreation/projectCreation';
import * as initProjectModule from '../../services/projectCreation/initProject';
import * as setupModules from '../../services/projectCreation/rust/setupModules';
import * as setupGlobalCargoToml from '../../services/projectCreation/rust/setupGlobalCargoToml';
import * as setupTargetDir from '../../services/projectCreation/rust/setupTargetDir';
import { spawn } from 'child_process';

jest.mock('../../services/projectCreation/initProject');
jest.mock('../../services/projectCreation/rust/setupModules');
jest.mock('../../services/projectCreation/rust/setupGlobalCargoToml');
jest.mock('../../services/projectCreation/rust/setupTargetDir');
jest.mock('../../services/projectCreation/sections', () => ({
    sections: {},
    addToSectionInTargetScope: jest.fn()
}));
jest.mock('child_process', () => ({
    spawn: jest.fn(),
    exec: jest.fn()
}));

describe('projectCreation/projectCreation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call initProject and setup functions', async () => {
        (initProjectModule.initProject as jest.Mock).mockResolvedValue('projectPath');
        (spawn as jest.Mock).mockReturnValue({
            on: jest.fn((event, cb) => {
                if (event === 'close') cb(0);
            })
        });

        await projectCreation([]);

        expect(initProjectModule.initProject).toHaveBeenCalled();
        expect(setupModules.setupModulesConfigs).toHaveBeenCalled();
        expect(setupGlobalCargoToml.setUpGlobalCargoToml).toHaveBeenCalled();
        expect(setupTargetDir.setUpTargetDir).toHaveBeenCalled();
    });
});
