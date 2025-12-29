import { blockInputs } from '../../services/conversion/blockInputs';
import * as fsUtils from '../../utils/fs';

jest.mock('../../utils/fs');

describe('conversion/blockInputs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Direct Values', () => {
        it('should resolve string input with quotes', async () => {
            const blockDef = {
                inputs: { param1: { type: ['string'], required: true } }
            };
            const blockContent = {
                param1: { "#text": { value: "hello", type: "string" } }
            };

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.param1).toEqual({ value: '"hello"', type: "string" });
        });

        it('should resolve bool input', async () => {
            const blockDef = {
                inputs: { param1: { type: ['bool'], required: true } }
            };
            const blockContent = {
                param1: { "#text": { value: "true", type: "bool" } }
            };

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.param1).toEqual({ value: 'true', type: "bool" });
        });

        it('should resolve numeric inputs (int, uint, float)', async () => {
            const blockDef = {
                inputs: {
                    v1: { type: ['int'], required: true },
                    v2: { type: ['uint'], required: true },
                    v3: { type: ['float'], required: true }
                }
            };
            const blockContent = {
                v1: { "#text": { value: "10", type: "int", size: 32 } },
                v2: { "#text": { value: "20", type: "uint", size: 64 } },
                v3: { "#text": { value: "3.14", type: "float", size: 64 } }
            };

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.v1).toEqual({ value: '10', type: "int", size: 32 });
            expect(result.v2).toEqual({ value: '20', type: "uint", size: 64 });
            expect(result.v3).toEqual({ value: '3.14', type: "float", size: 64 });
        });
    });

    describe('Default Values', () => {
        it('should provide correct defaults for all types', async () => {
            const blockDef = {
                inputs: {
                    s: { type: ['string'], required: false, default: 'def' },
                    b: { type: ['bool'], required: false }, // defaults to false
                    i: { type: ['int'], required: false, default: 42 },
                    u: { type: ['uint'], required: false },
                    f: { type: ['float'], required: false }
                }
            };
            const blockContent = {};

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.s).toEqual({ value: '"def"', type: "string" });
            expect(result.b).toEqual({ value: 'false', type: "bool" });
            expect(result.i).toEqual({ value: '42', type: "int", size: 32 });
            expect(result.u).toEqual({ value: '0', type: "uint", size: 32 });
            expect(result.f).toEqual({ value: '0', type: "float", size: 64 });
        });
    });

    describe('Multiple Inputs', () => {
        it('should resolve multiple inputs mapped to a single definition', async () => {
            const blockDef = {
                inputs: {
                    items: { type: ['string'], multiple: true }
                }
            };
            const blockContent = {
                item1: { "#text": { value: "v1", type: "string" }, "#flags": { for: "items" } },
                item2: { "#text": { value: "v2", type: "string" }, "#flags": { for: "items" } }
            };

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.items).toEqual({
                item1: { value: '"v1"', type: "string" },
                item2: { value: '"v2"', type: "string" }
            });
        });

        it('should resolve multiple inputs containing nested blocks', async () => {
            const blockDef = {
                inputs: {
                    items: { type: ['block'], multiple: true }
                }
            };
            const blockContent = {
                item1: {
                    "#text": [{ b1: {}, "#flags": { module: "m1" } }],
                    "#flags": { for: "items" }
                },
                item2: {
                    "#text": [{ b2: {}, "#flags": { module: "m1" } }],
                    "#flags": { for: "items" }
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockImplementation((mod, name) => ({
                code: `addAtBlockLocation('call_${name}();')`,
                inputs: {}
            }));

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.items).toEqual({
                item1: { value: "call_b1();", type: "block" },
                item2: { value: "call_b2();", type: "block" }
            });
        });
    });

    describe('Nested Blocks', () => {
        it('should resolve action blocks', async () => {
            const blockDef = {
                inputs: {
                    body: { type: ['block'], required: true }
                }
            };
            const blockContent = {
                body: {
                    "#text": [
                        { call_fn: {}, "#flags": { module: "m1" } }
                    ]
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "addAtBlockLocation('fn_call();')",
                inputs: {}
            });

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.body).toEqual({ value: "fn_call();", type: "block" });
        });

        it('should resolve return blocks', async () => {
            const blockDef = {
                inputs: {
                    val: { type: ['int'], required: true }
                }
            };
            const blockContent = {
                val: {
                    "#text": [
                        { get_val: {}, "#flags": { module: "m1" } }
                    ]
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "addAtBlockLocation('123')",
                return: { type: "int", size: 32 },
                inputs: {}
            });

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.val).toEqual({ value: "123", type: "int", size: 32 });
        });

        it('should throw error if return type is incompatible', async () => {
            const blockDef = {
                inputs: {
                    val: { type: ['int'], required: true }
                }
            };
            const blockContent = {
                val: {
                    "#text": [
                        { get_str: {}, "#flags": { module: "m1" } }
                    ]
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "addAtBlockLocation('\"hi\"')",
                return: { type: "string" },
                inputs: {}
            });

            await expect(blockInputs(blockDef as any, blockContent as any, 'test', {}, 0)).rejects.toThrow(/does not allow type/);
        });

        it('should resolve dynamic return type size from script', async () => {
            const blockDef = {
                inputs: {
                    val: { type: ['int'], required: true }
                }
            };
            const blockContent = {
                val: {
                    "#text": [
                        { get_dynamic: {}, "#flags": { module: "m1" } }
                    ]
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "addAtBlockLocation('456')",
                return: {
                    type: "return 'int'",
                    size: "return 64"
                },
                inputs: {}
            });

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.val).toEqual({ value: "456", type: "int", size: 64 });
        });

        it('should have access to isThereBlockInTheInput in action block script', async () => {
            const blockDef = {
                inputs: {
                    body: { type: ['block'], required: true }
                }
            };
            const blockContent = {
                body: {
                    "#text": [
                        { check_block: { sub: { "#text": [{ x: {} }] } }, "#flags": { module: "m1" } }
                    ]
                }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock)
                .mockResolvedValueOnce({ // check_block def
                    code: "if(isThereBlockInTheInput('sub')) addAtBlockLocation('has_sub' + input.sub.value); else addAtBlockLocation('no_sub');",
                    inputs: { sub: { type: ['block'] } }
                })
                .mockResolvedValueOnce({ // x def
                    code: "addAtBlockLocation('called_x');",
                    inputs: {}
                });

            const result = await blockInputs(blockDef as any, blockContent as any, 'test', {}, 0);
            expect(result.body.value).toContain('has_sub');
            expect(result.body.value).toContain('called_x');
        });
    });

    describe('Errors', () => {
        it('should throw if direct value is provided where block is required', async () => {
            const blockDef = {
                inputs: {
                    body: { type: ['block'], required: true }
                }
            };
            const blockContent = {
                body: { "#text": { value: "some text", type: "string" } }
            };

            await expect(blockInputs(blockDef as any, blockContent as any, 'test', {}, 0)).rejects.toThrow(/requires a block input, but received a direct value/);
        });

        it('should throw if action block code execution fails', async () => {
            const blockDef = {
                inputs: { body: { type: ['block'], required: true } }
            };
            const blockContent = {
                body: { "#text": [{ fail_block: {}, "#flags": { module: "m1" } }] }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "throw new Error('boom')",
                inputs: {}
            });

            await expect(blockInputs(blockDef as any, blockContent as any, 'test', {}, 0)).rejects.toThrow(/Error during the execution of the code section/);
        });

        it('should throw if dynamic type determination fails', async () => {
            const blockDef = {
                inputs: { val: { type: ['int'], required: true } }
            };
            const blockContent = {
                val: { "#text": [{ dynamic_fail: {}, "#flags": { module: "m1" } }] }
            };

            (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('m1');
            (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
                code: "123",
                return: { type: "throw new Error('bad script')" },
                inputs: {}
            });

            await expect(blockInputs(blockDef as any, blockContent as any, 'test', {}, 0)).rejects.toThrow(/Script execution error in the 'type' section/);
        });
    });
});
