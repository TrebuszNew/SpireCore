import { eventOutputs } from '../../services/conversion/eventOutputs';
import * as conversionModule from '../../services/conversion/conversion';
import fs from 'fs';

jest.mock('fs');

describe('conversion/eventOutputs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Known Types', () => {
        it('should resolve simple static outputs', () => {
            const eventDef = {
                outputs: {
                    out1: { type: 'int', size: 32 }
                }
            };
            const result = eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event');
            expect(result.out1).toEqual({ type: 'int', size: 32 });
        });

        it('should resolve multiple outputs with known type from script', () => {
            const eventDef = {
                outputs: {
                    out1: { type: 'string', multiple: true }
                },
                resultType: {
                    out1: { type: 'return ["name1", "name2"]' }
                }
            };
            const result = eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event');
            expect(result.out1).toEqual({
                name1: { type: 'string' },
                name2: { type: 'string' }
            });
        });

        it('should throw if known type is invalid', () => {
            const eventDef = {
                outputs: {
                    out1: { type: 'invalid_type', size: 32 }
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/is not a valid output type/);
        });
    });

    describe('Unknown Types (Dynamic)', () => {
        it('should resolve dynamic outputs (not multiple)', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: false }
                },
                resultType: {
                    out1: {
                        type: 'return "float"',
                        size: 'return 64'
                    }
                }
            };
            const result = eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event');
            expect(result.out1).toEqual({ type: 'float', size: 64 });
        });

        it('should resolve dynamic multiple outputs with dynamic types and sizes', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: true }
                },
                resultType: {
                    out1: {
                        type: 'return { a: "int", b: "uint" }',
                        size: 'return { a: 16, b: 128 }'
                    }
                }
            };
            const result = eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event');
            expect(result.out1).toEqual({
                a: { type: 'int', size: 16 },
                b: { type: 'uint', size: 128 }
            });
        });

        it('should throw if dynamic type script returns invalid type', () => {
            const eventDef = {
                outputs: {
                    out1: {}
                },
                resultType: {
                    out1: { type: 'return "fancy_type"' }
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/returns: "fancy_type"/);
        });

        it('should throw if dynamic size script returns invalid size', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: false }
                },
                resultType: {
                    out1: {
                        type: 'return "int"',
                        size: 'return 7'
                    }
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/returns: "7"/);
        });
    });

    describe('Context & API', () => {
        it('should have access to customData and flags in script', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: false }
                },
                resultType: {
                    out1: { type: 'return flags.customType || "string"' }
                }
            };
            const flags = { module: 'test', customType: 'bool' };
            const result = eventOutputs(eventDef as any, 'module', flags, {}, 'event');
            expect(result.out1).toEqual({ type: 'bool' });
        });

        it('should provide fs API to script', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: false }
                },
                resultType: {
                    out1: { type: 'const data = fs.readFile("config.txt"); return data === "magic" ? "string" : "bool";' }
                }
            };

            (fs.readFileSync as jest.Mock).mockReturnValue('magic');

            const result = eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event');
            expect(result.out1).toEqual({ type: 'string' });
        });

        it('should throw if resultType is missing when type is unknown', () => {
            const eventDef = {
                outputs: {
                    out1: {} // no type, no resultType
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/ResultType not provided/);
        });
    });

    describe('Validation', () => {
        it('should throw error if multiple output script does not return array in known type scenario', () => {
            const eventDef = {
                outputs: {
                    out1: { type: 'string', multiple: true }
                },
                resultType: {
                    out1: { type: 'return "just a string"' }
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/must return an array of strings/);
        });

        it('should throw error if dynamic size calculation fails in multiple unknown type scenario', () => {
            const eventDef = {
                outputs: {
                    out1: { multiple: true }
                },
                resultType: {
                    out1: {
                        type: 'return { a: "int" }',
                        size: 'return { a: 7 }' // Invalid size
                    }
                }
            };
            expect(() => eventOutputs(eventDef as any, 'module', { module: 'test' }, {}, 'event')).toThrow(/returns: "7"/);
        });
    });
});
