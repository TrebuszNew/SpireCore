import path from 'path';
import fs from 'fs';
import { getFileContent, dirOrFileExists, createDir, createFile, isFolderEmpty, deleteFile } from '../../utils/fs';

jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        readFile: jest.fn(),
        stat: jest.fn(),
        access: jest.fn(),
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        rm: jest.fn(),
    },
    constants: {
        F_OK: 0,
    }
}));

describe('utils/fs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset cached values in fs.ts if any
    });

    describe('getFileContent', () => {
        it('should return file content when it exists', async () => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({});
            (fs.promises.readdir as jest.Mock).mockResolvedValue([
                { name: 'test.txt', isFile: () => true, isDirectory: () => false }
            ]);
            (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('test content'));

            const content = await getFileContent('test.txt');
            expect(content).toBe('test content');
        });

        it('should return null when file dont exist', async () => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({});
            (fs.promises.readdir as jest.Mock).mockResolvedValue([]);

            const content = await getFileContent('nonexistent.txt');
            expect(content).toBeNull();
        });
    });

    describe('dirOrFileExists', () => {
        it('should return true if file exists', async () => {
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            const exists = await dirOrFileExists('path');
            expect(exists).toBe(true);
        });

        it('should return false if file does not exist', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(new Error());
            const exists = await dirOrFileExists('path');
            expect(exists).toBe(false);
        });
    });

    describe('createDir', () => {
        it('should call mkdir', async () => {
            await createDir('new_dir');
            expect(fs.promises.mkdir).toHaveBeenCalledWith('new_dir', expect.any(Object));
        });
    });

    describe('createFile', () => {
        it('should call writeFile', async () => {
            await createFile('file.txt', 'content');
            expect(fs.promises.writeFile).toHaveBeenCalledWith('file.txt', 'content', expect.any(Object));
        });
    });

    describe('isFolderEmpty', () => {
        it('should return true if folder is empty', async () => {
            (fs.promises.readdir as jest.Mock).mockResolvedValue([]);
            const empty = await isFolderEmpty('dir');
            expect(empty).toBe(true);
        });

        it('should return false if folder is not empty', async () => {
            (fs.promises.readdir as jest.Mock).mockResolvedValue(['file.txt']);
            const empty = await isFolderEmpty('dir');
            expect(empty).toBe(false);
        });
    });

    describe('deleteFile', () => {
        it('should call rm', async () => {
            await deleteFile('file.txt');
            expect(fs.promises.rm).toHaveBeenCalledWith('file.txt', { force: true });
        });
    });
});
