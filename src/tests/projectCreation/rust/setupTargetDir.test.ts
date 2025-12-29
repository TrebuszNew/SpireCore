import { setUpTargetDir } from '../../../services/projectCreation/rust/setupTargetDir';
import * as fsUtils from '../../../utils/fs';

jest.mock('../../../utils/fs');

describe('projectCreation/rust/setupTargetDir', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create target directory files', async () => {
        (fsUtils.loadProjectConfig as jest.Mock).mockResolvedValue({
            name: 'testProject',
            version: '1.0.0'
        });
        (fsUtils.listAllModules as jest.Mock).mockResolvedValue([]);

        const sections = {
            global: "", preUser: "", eventLoop: "",
            eventOS: "", stateApp: "", eventRender: "", stateRender: ""
        };

        await setUpTargetDir([], sections);

        expect(fsUtils.createDir).toHaveBeenCalled();
        expect(fsUtils.createFile).toHaveBeenCalledWith(
            expect.stringContaining('Cargo.toml'),
            expect.stringContaining('testProject')
        );
        expect(fsUtils.createFile).toHaveBeenCalledWith(
            expect.stringContaining('main.rs'),
            expect.any(String)
        );
        expect(fsUtils.createFile).toHaveBeenCalledWith(
            expect.stringContaining('lib.rs'),
            expect.any(String)
        );
    });
});
