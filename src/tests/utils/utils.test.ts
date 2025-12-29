import { isValidType, isResultValueType, getValidatedOutput, stripQuotes, logger } from '../../utils/utils';
import { ExpectedInputType, ResultValueType } from '../../schemas/blocks';

describe('utils/utils', () => {
    describe('logger', () => {
        beforeEach(() => {
            logger.clear();
        });

        it('should store warnings', () => {
            logger.warn('test warning');
            expect(logger.warnings).toContain('test warning');
        });

        it('should clear warnings', () => {
            logger.warn('test warning');
            logger.clear();
            expect(logger.warnings).toHaveLength(0);
        });
    });

    describe('isValidType', () => {
        it('should validate single type', () => {
            const expected: ExpectedInputType = 'uint';
            const actual: ResultValueType = { type: 'uint', size: 32 };
            expect(isValidType(expected, actual)).toBe(true);
        });

        it('should invalidate single type', () => {
            const expected: ExpectedInputType = 'uint';
            const actual: ResultValueType = { type: 'int', size: 32 };
            expect(isValidType(expected, actual)).toBe(false);
        });

        it('should validate from array of types', () => {
            const expected: ExpectedInputType[] = ['uint', 'int'];
            const actual: ResultValueType = { type: 'int', size: 32 };
            expect(isValidType(expected, actual)).toBe(true);
        });
    });

    describe('isResultValueType', () => {
        it('should return true for valid string/bool', () => {
            expect(isResultValueType({ type: 'string' })).toBe(true);
            expect(isResultValueType({ type: 'bool' })).toBe(true);
        });

        it('should return true for valid float sizes', () => {
            expect(isResultValueType({ type: 'float', size: 32 })).toBe(true);
            expect(isResultValueType({ type: 'float', size: 64 })).toBe(true);
        });

        it('should return false for invalid float size', () => {
            expect(isResultValueType({ type: 'float', size: 128 })).toBe(false);
        });

        it('should return true for valid int/uint sizes', () => {
            expect(isResultValueType({ type: 'int', size: 8 })).toBe(true);
            expect(isResultValueType({ type: 'uint', size: 128 })).toBe(true);
        });

        it('should return false for non-objects or missing type', () => {
            expect(isResultValueType(null)).toBe(false);
            expect(isResultValueType({})).toBe(false);
        });
    });

    describe('getValidatedOutput', () => {
        it('should return valid string/bool output', () => {
            expect(getValidatedOutput({ type: 'string' })).toEqual({ type: 'string' });
        });

        it('should return valid float output', () => {
            expect(getValidatedOutput({ type: 'float', size: 32 })).toEqual({ type: 'float', size: 32 });
        });

        it('should return undefined for invalid size', () => {
            expect(getValidatedOutput({ type: 'float', size: 128 } as any)).toBeUndefined();
        });
    });

    describe('stripQuotes', () => {
        it('should remove double quotes', () => {
            expect(stripQuotes('"hello"')).toBe('hello');
        });

        it('should remove single quotes', () => {
            expect(stripQuotes("'hello'")).toBe('hello');
        });

        it('should remove backticks', () => {
            expect(stripQuotes('`hello`')).toBe('hello');
        });

        it('should not remove mismatched quotes', () => {
            expect(stripQuotes('"hello\'')).toBe('"hello\'');
        });

        it('should throw error for non-string', () => {
            expect(() => stripQuotes(123)).toThrow();
        });
    });
});
