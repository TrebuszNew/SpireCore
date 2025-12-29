import { XMLParser } from "fast-xml-parser";
import { getBlockDef, blockFromModule } from "../fs";
import type {
    UserCode,
    BlockUser,
    BlockValueUser,
    BlockContentUser,
    BlockInputFlagsUser,
    EventBlockFlagsUser,
    EventBlockUser,
    Number as NumberType,
    String as StringType,
    Bool as BoolType,
    Block as BlockType,
    ActionAndReturnBlockFlagsUser
} from "../../schemas/user";

import type {
    ReturnBlockDef,
    ActionBlockDef
} from "../../schemas/blocks";


// --- New helper functions for base types ---

function createNumber(value: string, type: 'int' | 'uint' | 'float' = 'int', size: number = 32): NumberType {
    if (type === 'float') {
        const floatSize = [32, 64].includes(size) ? size : 32;
        return { value, type: 'float', size: floatSize as 32 | 64 };
    }
    const intSize = [8, 16, 32, 64, 128].includes(size) ? size : 32;
    return { value, type: type as 'int' | 'uint', size: intSize as 8 | 16 | 32 | 64 | 128 };
}

function createString(value: string): StringType {
    return { value, type: "string" };
}

function createBool(value: string): BoolType {
    return { value, type: "bool" };
}


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    preserveOrder: true,
    parseTagValue: true,
});


// Parses a simple value from the '#text' node and wraps it in a new type.
async function parseSimpleValue(value: any, blockName: string, inputName: string, moduleName: string): Promise<StringType | NumberType | BoolType> {
    if (typeof value === 'string') {
        if (value.startsWith('"') && value.endsWith('"')) {
            return createString(value.substring(1, value.length - 1));
        }

        if (value.toLowerCase() === 'true') return createBool("true");
        if (value.toLowerCase() === 'false') return createBool("false");

        return createString(value);
    }

    if (typeof value === 'boolean') {
        return createBool(String(value));
    }

    if (typeof value === 'number') {
        const blockDef = await getBlockDef(moduleName, blockName) as ReturnBlockDef | ActionBlockDef

        if (!blockDef.inputs || !blockDef.inputs[inputName]) {
            throw new Error(`Unknown input: "${inputName}" in block "${blockName}"!`)
        }

        const requiredInputType = blockDef.inputs[inputName].type
        const typeIncludes = (types: string | string[], check: string) =>
            Array.isArray(types) ? types.includes(check) : types === check;


        switch (true) {
            case typeIncludes(requiredInputType, "uint"):
                return createNumber(String(value), "uint", 32);

            case typeIncludes(requiredInputType, "int"):
            case typeIncludes(requiredInputType, "number"):
            case typeIncludes(requiredInputType, "any"):
                return createNumber(String(value), "int", 32);

            case typeIncludes(requiredInputType, "float"):
                return createNumber(String(value), "float", 64);
        }
    }

    // Handling null/undefined (in case of missing block/value)
    if (value === null || value === undefined) {
        const blockDef = await getBlockDef(moduleName, blockName) as ReturnBlockDef | ActionBlockDef
        const requiredInputType = blockDef.inputs[inputName].type

        const typeIncludes = (types: string | string[], check: string) =>
            Array.isArray(types) ? types.includes(check) : types === check;

        switch (true) {
            case typeIncludes(requiredInputType, "uint"):
                return createNumber("0", "uint", 32);

            case typeIncludes(requiredInputType, "int"):
            case typeIncludes(requiredInputType, "number"):
            case typeIncludes(requiredInputType, "any"):
                return createNumber("0", "int", 32);

            case typeIncludes(requiredInputType, "float"):
                return createNumber("0.0", "float", 64);

            case typeIncludes(requiredInputType, "bool"):
                return createBool("false");

            case typeIncludes(requiredInputType, "string"):
                return createString("");
        }
    }

    // Ultimacy
    return createString(String(value));
}


// Processes the block content (the array of its inputs/fields).
async function processBlockContent(contentArray: any[], blockName: string, blockFlags: ActionAndReturnBlockFlagsUser): Promise<BlockContentUser> {
    const content: BlockContentUser = {};

    for (const entry of contentArray) {
        const key = Object.keys(entry).find((k) => k !== ':@');
        if (!key) {
            continue;
        }

        const valueArray = entry[key];
        const flagsEntry = entry[':@'];
        let flags: BlockInputFlagsUser | undefined = undefined;

        if (flagsEntry && flagsEntry['@_for']) {
            flags = { for: flagsEntry['@_for'] };
        }

        let processedValue: BlockValueUser;
        const moduleName = await blockFromModule(blockName, blockFlags);

        const simpleValueEntry = Array.isArray(valueArray) ? valueArray.find((v: any) => v && v['#text'] !== undefined) : undefined;

        const processValue = async (): Promise<StringType | NumberType | BoolType | BlockUser[]> => {
            if (simpleValueEntry) {
                // Case 1: Simple value (np. <inputName>value</inputName>)
                return await parseSimpleValue(simpleValueEntry['#text'], blockName, key, moduleName);

            } else if (Array.isArray(valueArray) && valueArray.length > 0) {
                // Case 2: One or more nested blocks
                return await Promise.all(valueArray.map(processBlockUser));

            } else {
                // Case 3: Missing value (empty tag <inputName />)
                const blockDef = await getBlockDef(moduleName, blockName) as ReturnBlockDef | ActionBlockDef;
                const requiredInputType = blockDef.inputs[key].type;

                const typeIncludes = (types: string | string[], check: string) =>
                    Array.isArray(types) ? types.includes(check) : types === check;

                if (typeIncludes(requiredInputType, "block")) {
                    return [];
                }

                return await parseSimpleValue(null, blockName, key, moduleName);
            }
        };

        const resultValue = await processValue();

        processedValue = {
            "#text": resultValue,
            "#flags": flags
        };

        content[key] = processedValue;
    }
    return content;
}


// Processes a single BlockUser (e.g., { "create_window": [...] }).
async function processBlockUser(block: any): Promise<BlockUser> {
    const blockName = Object.keys(block).find((k) => k !== ':@');
    if (!blockName) {
        throw new Error(`Empty block tag detected. Check the XML structure.`);
    }

    const contentArray = block[blockName];
    const flagsEntry = block[':@'];

    const contentToProcess = Array.isArray(contentArray) ? contentArray : [];

    let processedContent = await processBlockContent(contentToProcess, blockName, flagsEntry);

    if (flagsEntry) {
        const attributesToMerge: { [key: string]: any } = {};
        let hasMergeableAttributes = false;

        for (const flagKey in flagsEntry) {
            if (flagKey !== '@_for') {
                const cleanFlagKey = flagKey.substring(2); // remove '@_'
                attributesToMerge[cleanFlagKey] = flagsEntry[flagKey];
                hasMergeableAttributes = true;
            }
        }

        if (hasMergeableAttributes) {
            // Block-level flags (e.g., test="true") are merged into BlockContentUser.
            processedContent = { ...processedContent, ...attributesToMerge };
        }
    }

    const result = (() => {
        if (flagsEntry) {
            return {
                [blockName]: processedContent,
                "#flags": { "module": flagsEntry['@_module'] }
            } as BlockUser;
        } else {
            return {
                [blockName]: processedContent,
            } as BlockUser;
        }
    })();


    return result;
}



// Processes a single BlockEventUser (unchanged, remains correct).
async function processBlockEventUser(event: any): Promise<EventBlockUser> {
    const eventName = Object.keys(event).find((k) => k !== ':@');
    if (!eventName) return {};

    const blocksArray = event[eventName];
    const blocksToProcess = Array.isArray(blocksArray) ? blocksArray : [];
    const processedBlocks = await Promise.all(blocksToProcess.map(processBlockUser));

    const result: EventBlockUser = { [eventName]: processedBlocks };

    const flagsEntry = event[':@'];
    if (flagsEntry) {
        const flags: { module: string } & Record<string, string> = { 
            module: String(flagsEntry['@_module'] || await blockFromModule(eventName, flagsEntry['@_module']))
        };

        for (const key in flagsEntry) {
            if (key.startsWith('@_')) {
                const cleanKey = key.substring(2); // remove '@_'
                if (cleanKey.startsWith('_') && cleanKey !== 'module') {
                    flags[cleanKey] = String(flagsEntry[key]);
                }
            }
        }

        result['#flags'] = flags;
    }

    console.log("Processed EventBlockUser:", result);
    return result;
}


// Main parsing function.
export async function parseCodeUser(inputJsonString: string): Promise<UserCode> {
    let parsed: any;
    try {
        parsed = parser.parse(inputJsonString);
    } catch (e: any) {
        throw new Error(`XML parsing error: ${e.message}`)
    }

    const eventsToProcess = Array.isArray(parsed) ? parsed : [parsed];
    if (eventsToProcess.length === 0) return [];

    const codeUserResult = await Promise.all(eventsToProcess.map(processBlockEventUser));

    return codeUserResult;
}