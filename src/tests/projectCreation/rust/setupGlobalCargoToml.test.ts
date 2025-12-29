import { setUpGlobalCargoToml } from '../../../services/projectCreation/rust/setupGlobalCargoToml';
import * as fsUtils from '../../../utils/fs';

jest.mock('../../../utils/fs');

describe('projectCreation/rust/setupGlobalCargoToml', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create Cargo.toml with workspace members', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({ name: 'testProject' });
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue(['mod1']);
        (fsUtils.loadModuleLangConfig as jest.Mock).mockResolvedValue({ addFileToLocalScope: true });

        await setUpGlobalCargoToml();

        expect(fsUtils.writeToFile).toHaveBeenCalledWith(
            expect.stringContaining('Cargo.toml'),
            expect.stringContaining('"src/spirelite_mod1"')
        );
    });
});
