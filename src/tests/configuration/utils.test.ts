import { resolveBlockKind, checkIfReturns, validateNumericTypeSize, formatZodError } from '../../services/configuration/utils';
import { z } from 'zod';

describe('configuration/utils', () => {
    describe('resolveBlockKind', () => {
        it('should resolve return block', () => {
            expect(resolveBlockKind({ return: {} } as any)).toBe('return');
        });
        it('should resolve action block', () => {
            expect(resolveBlockKind({ code: '...' } as any)).toBe('action');
        });
        it('should resolve event block', () => {
            expect(resolveBlockKind({ outputs: {} } as any)).toBe('event');
        });
        it('should throw for unknown block', () => {
            expect(() => resolveBlockKind({} as any)).toThrow();
        });
    });

    describe('checkIfReturns', () => {
        it('should not throw for valid return', () => {
            expect(() => checkIfReturns('return 1', 'type', 'test')).not.toThrow();
        });
        it('should throw for missing return', () => {
            expect(() => checkIfReturns('const a = 1;', 'type', 'test')).toThrow();
        });
        it('should throw for invalid JS', () => {
            expect(() => checkIfReturns('const a =', 'type', 'test')).toThrow();
        });
    });

    describe('validateNumericTypeSize', () => {
        it('should not throw for valid int size', () => {
            expect(() => validateNumericTypeSize('int', 32, 'test')).not.toThrow();
        });
        it('should throw for invalid int size', () => {
            expect(() => validateNumericTypeSize('int', 10, 'test')).toThrow();
        });
        it('should throw for missing size', () => {
            expect(() => validateNumericTypeSize('int', undefined, 'test')).toThrow();
        });
    });

    describe('formatZodError', () => {
        it('should format invalid_type error', () => {
            const schema = z.string();
            const result = schema.safeParse(123);
            if (!result.success) {
                const error = formatZodError(result.error.issues);
                expect(error).toContain('expected string');
            }
        });
    });
});
