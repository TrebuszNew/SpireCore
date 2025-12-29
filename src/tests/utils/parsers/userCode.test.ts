import { parseCodeUser } from '../../../utils/parsers/userCode';
import * as fsUtils from '../../../utils/fs';

jest.mock('../../../utils/fs');

describe('utils/parsers/userCode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should parse simple user code', async () => {
        const xml = `
            <on_start>
                <print>
                    <message>"Hello"</message>
                </print>
            </on_start>
        `;

        (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('mockModule');
        (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
            inputs: {
                message: { type: ['string'] }
            },
            code: 'console.log(message)'
        });

        const result = await parseCodeUser(xml);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('on_start');
    });

    it('should handle attributes/flags', async () => {
        const xml = `
            <on_start _module="test">
                <print #flags__module="test">
                    <message>"Hello"</message>
                </print>
            </on_start>
        `;

        (fsUtils.blockFromModule as jest.Mock).mockResolvedValue('test');
        (fsUtils.getBlockDef as jest.Mock).mockResolvedValue({
            inputs: { message: { type: ['string'] } },
            code: ''
        });

        const result = await parseCodeUser(xml);
        expect(result[0]['#flags']).toHaveProperty('module', 'test');
    });
});
