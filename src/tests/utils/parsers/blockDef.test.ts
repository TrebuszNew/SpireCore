import { parseBlockDef, getBlockType } from '../../../utils/parsers/blockDef';

describe('utils/parsers/blockDef', () => {
    describe('parseBlockDef', () => {
        it('should parse an action block', () => {
            const xml = `
                <block>
                    <inputs>
                        <param1 type="int" size="32" />
                    </inputs>
                    <code><![CDATA[ console.log("hello"); ]]></code>
                </block>
            `;
            const result = parseBlockDef(xml, 'test_action');
            expect(result).toHaveProperty('inputs');
            expect(result).toHaveProperty('code');
            expect((result as any).inputs).toHaveProperty('param1');
        });

        it('should parse a return block', () => {
            const xml = `
                <block>
                    <inputs>
                        <param1 type="int" size="32" />
                    </inputs>
                    <return>
                        <type>int</type>
                        <size>32</size>
                    </return>
                    <code><![CDATA[ return 1; ]]></code>
                </block>
            `;
            const result = parseBlockDef(xml, 'test_return');
            expect(result).toHaveProperty('return');
            expect((result as any).return.type).toBe('int');
        });

        it('should parse an event block', () => {
            const xml = `
                <block>
                    <outputs>
                        <output1 type="int" size="32" />
                    </outputs>
                    <resultType>
                        <res1>
                            <type>string</type>
                        </res1>
                    </resultType>
                </block>
            `;
            const result = parseBlockDef(xml, 'test_event');
            expect(result).toHaveProperty('outputs');
            expect(result).toHaveProperty('resultType');
        });
    });

    describe('getBlockType', () => {
        it('should detect event type', () => {
            expect(getBlockType({ outputs: {} } as any)).toBe('event');
        });

        it('should detect return type', () => {
            expect(getBlockType({ return: {} } as any)).toBe('return');
        });

        it('should detect action type', () => {
            expect(getBlockType({ inputs: {} } as any)).toBe('action');
        });
    });
});
