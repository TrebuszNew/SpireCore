import { addToSectionInTargetScope, sections } from '../../services/projectCreation/sections';

describe('projectCreation/sections', () => {
    beforeEach(() => {
        // Reset sections
        for (const key in sections) {
            (sections as any)[key] = "";
        }
    });

    it('should add data to a valid section', () => {
        addToSectionInTargetScope('global', 'let x = 1;');
        expect(sections.global).toContain('let x = 1;');
    });

    it('should warn on invalid section', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        addToSectionInTargetScope('invalid' as any, 'data');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Incorrect usage'));
        consoleWarnSpy.mockRestore();
    });
});
