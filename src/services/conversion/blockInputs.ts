import { customData } from './conversion';
import type { ActionAndReturnBlockFlagsUser, BlockContentUser, String, Number, Bool, Block, BlockUser, BlockValueUser } from "../../schemas/user";
import type { ActionBlockDef, ReturnBlockDef, ResultValueType, ExpectedInputType, OutputResult } from "../../schemas/blocks";
import { blockFromModule, getBlockDef } from '../../utils/fs';
import { isValidType, logger, stripQuotes } from '../../utils/utils'

export async function blockInputs(
    blockDef: ActionBlockDef | ReturnBlockDef,
    blockContent: BlockContentUser,
    blockName: string,
    eventOutput: { [outputName: string]: OutputResult },
    depth: number,
): Promise<{ [inputName: string]: String | Number | Bool | Block }> {

    const resolvedInputs: {
        [inputDefName: string]: String | Number | Bool | Block | {
            [inputNameMultiple: string]: String | Number | Bool | Block;
        };
    } = {};

    for (const inputDefName in blockDef["inputs"]) {
        const inputDef = blockDef["inputs"][inputDefName];

        // 1. Option: Multiple entry.
        if (inputDef.multiple) {
            const multipleInputs: { [name: string]: BlockValueUser } = {};
            for (const userInputName in blockContent) {
                const flags = blockContent[userInputName]["#flags"];
                if (flags?.for === inputDefName) {
                    multipleInputs[userInputName] = blockContent[userInputName];
                }
            }

            const resolvedMultipleInputs: { [inputName: string]: String | Number | Bool | Block } = {};

            for (const inputName in multipleInputs) {
                const inputData = multipleInputs[inputName];
                const textContent = inputData["#text"];

                if (Array.isArray(textContent)) {
                    // The value is a nested block.
                    logger.log(`${"\t".repeat(depth)}${inputDefName.toLocaleUpperCase()} (${inputName}):`);
                    resolvedMultipleInputs[inputName] = await resolveBlockValue(textContent, blockDef, inputDefName, eventOutput, depth);
                } else {
                    // The value is direct.
                    resolvedMultipleInputs[inputName] = resolveDirectValue(blockDef, inputDefName, blockName, textContent);
                    logger.log(`${"\t".repeat(depth)}${inputDefName.toLocaleUpperCase()} (${inputName}): (value: ${resolvedMultipleInputs[inputName].value} | type: ${resolvedMultipleInputs[inputName].type})`);
                }
            }

            resolvedInputs[inputDefName] = resolvedMultipleInputs;
            continue;
        }

        // 2. Option: Single entry.
        let blockValueUser: BlockValueUser;

        // Checking whether the input has been defined by the user.
        if (blockContent[inputDefName] === undefined) {
            // Assigning a default value if the input is optional.
            blockValueUser = {
                "#text": assignDefaultInputValue(blockDef, inputDefName, blockName),
                "#flags": undefined
            };
        } else {
            blockValueUser = blockContent[inputDefName];
        }

        const textContent = blockValueUser["#text"];

        if (Array.isArray(textContent)) {
            // The value is a nested (block).
            logger.log(`${"\t".repeat(depth)}${inputDefName.toLocaleUpperCase()}:`);
            resolvedInputs[inputDefName] = await resolveBlockValue(textContent, blockDef, inputDefName, eventOutput, depth);
        } else {
            // The value is direct (String, Number, Bool).
            resolvedInputs[inputDefName] = resolveDirectValue(blockDef, inputDefName, blockName, textContent);
            logger.log(`${"\t".repeat(depth)}${inputDefName.toLocaleUpperCase()}: (value: ${resolvedInputs[inputDefName].value} | type: ${resolvedInputs[inputDefName].type})`);
        }


    }

    return resolvedInputs as { [inputNameDef: string]: String | Number | Bool | Block };
}



async function resolveBlockValue(
    blockContentArray: BlockUser[],
    parentBlockDef: ReturnBlockDef | ActionBlockDef,
    inputDefName: string,
    eventOutput: { [outputName: string]: OutputResult },
    depth: number,
): Promise<String | Number | Bool | Block> {
    const isActionBlock = parentBlockDef["inputs"][inputDefName].type[0] === "block";

    if (isActionBlock) {
        // ACTION BLOCK
        return resolveActionBlocks(blockContentArray, eventOutput, depth + 1);
    } else {
        // RETURN BLOCK
        return resolveReturnBlock(blockContentArray[0], parentBlockDef, inputDefName, eventOutput, depth + 1);
    }
}

// Processes an array of Action Blocks. Returns a single object of type Block.
async function resolveActionBlocks(
    blockContentArray: BlockUser[],
    eventOutput: { [outputName: string]: OutputResult },
    depth: number,
): Promise<Block> {
    let generatedCode = "";

    for (const block of blockContentArray) {
        const actionBlockName = Object.keys(block).find(key => key !== 'type' && key !== '#flags')!;
        const actionBlockFlags = block['#flags'] as ActionAndReturnBlockFlagsUser;
        const moduleName = await blockFromModule(actionBlockName, actionBlockFlags);

        const actionBlockDef = await getBlockDef(moduleName, actionBlockName) as ActionBlockDef;
        logger.log(`\t[===== ${actionBlockName} (Action Block) =====]`);
        const actionBlockContentMap = block[actionBlockName] as BlockContentUser;

        const inputs = await blockInputs(actionBlockDef, actionBlockContentMap, actionBlockName, eventOutput, depth);

        // Generating code for this block.
        let localCode = "";
        const codeAppender = (s: unknown) => {
            if (typeof s !== 'string') {
                throw new Error(`Argument must be of type string. Received: ${typeof s}`);
            }
            localCode += s;
        };

        // Helper function to check whether the input contains a nested block.
        function isThereBlockInTheInput(input: unknown) {
            if (typeof input !== "string") throw new Error("No string was provided for the input, but it is required by isThereBlockInTheInput")
            return Array.isArray(block[actionBlockName][input]?.["#text"])
        }

        try {
            customData[moduleName] ??= {};
            // Executing the code within the definition from the code section to determine what to insert in place of this action block.
            new Function(
                "input", "output", "customData", "stripQuotes", "addAtBlockLocation", "isThereBlockInTheInput",
                actionBlockDef["code"]
            )(
                inputs,
                eventOutput,
                customData[moduleName],
                stripQuotes,
                codeAppender,
                isThereBlockInTheInput
            );
        } catch {
            throw new Error(`Error during the execution of the code section in an action block named: ${actionBlockName}.`)
        }

        generatedCode += localCode;
    }

    return {
        value: generatedCode,
        type: "block"
    } as Block;
}
// Processes a single Return Block.
async function resolveReturnBlock(
    returnBlockUser: BlockUser,
    parentBlockDef: ActionBlockDef | ReturnBlockDef,
    inputDefName: string,
    eventOutput: { [outputName: string]: OutputResult },
    depth: number,
): Promise<String | Number | Bool> {
    const returnBlockName = Object.keys(returnBlockUser).find(key => key !== 'type' && key !== '#flags')!;
    const returnBlockFlags = returnBlockUser['#flags'] as ActionAndReturnBlockFlagsUser;
    const moduleName = await blockFromModule(returnBlockName, returnBlockFlags);

    const returnBlockDef = await getBlockDef(moduleName, returnBlockName) as ReturnBlockDef;
    logger.log(`${"\t".repeat(depth)}[===== ${returnBlockName} (Return Block) =====]`);
    const returnBlockContentMap = returnBlockUser[returnBlockName] as BlockContentUser;

    const inputs = await blockInputs(returnBlockDef, returnBlockContentMap, returnBlockName, eventOutput, depth);

    // 1. Determine the return type (ResultValueType).
    const returnedType = await determineReturnedType(
        returnBlockDef,
        inputs,
        eventOutput,
        moduleName,
        returnBlockName,
        parentBlockDef["inputs"][inputDefName].type
    );

    // 2. Checking type compatibility.
    if (!isValidType(parentBlockDef["inputs"][inputDefName].type, returnedType)) {
        throw new Error(`Type: "${parentBlockDef["inputs"][inputDefName].type}", does not allow type: "${JSON.stringify(returnedType)}"`);
    }

    // 3. Generating code/values.
    let generatedCode = "";
    const codeAppender = (s: string) => (generatedCode += s);

    try {
        // Executing the code within the definition from the code section to determine what to insert in place of this return block.
        new Function(
            "input", "output", "customData", "stripQuotes", "addAtBlockLocation",
            returnBlockDef["code"]
        )(inputs, eventOutput, customData[moduleName], stripQuotes, codeAppender);
    } catch {
        throw new Error(`Error during the execution of the "code" section in the return block: ${returnBlockName}.`)
    }
    // 4. Returning the final value object.
    const value = generatedCode;

    if (returnedType.type === "string") {
        return { value: value, type: "string" };
    } else if (returnedType.type === "bool") {
        return { value: value, type: "bool" };
    } else {
        const numericType = returnedType.type as "float" | "int" | "uint";
        const numericSize = (returnedType as Number).size;

        return {
            value: value,
            type: numericType,
            size: numericSize
        } as Number;
    }
}



async function determineReturnedType(
    returnBlockDef: ReturnBlockDef,
    inputs: { [inputName: string]: String | Number | Bool | Block },
    eventOutput: { [outputName: string]: OutputResult },
    moduleName: string,
    returnBlockName: string,
    possibleInputTypes: ExpectedInputType[]
): Promise<ResultValueType> {
    const returnDef = returnBlockDef["return"];

    // Scenario A: The type is static.
    if (["uint", "int", "float", "string", "bool"].includes(returnDef.type)) {
        return returnDef as ResultValueType;
    }

    // Scenario B: The type is dynamic.
    let type: string;
    try {
        type = new Function(
            "input", "output", "customData", "stripQuotes", "possibleInputsTypes",
            returnDef.type
        )(inputs, eventOutput, customData[moduleName], stripQuotes, possibleInputTypes);
    } catch (e) {
        throw new Error(`Script execution error in the 'type' section of block: ${returnBlockName}.`);
    }

    if (!["string", "bool", "int", "uint", "float"].includes(type)) {
        throw new Error(`Failed to determine the type in block: ${returnBlockName}. Received: "${type}"`);
    }

    // If the type is not numeric, return immediately.
    if (type === "string" || type === "bool") {
        return { type: type } as ResultValueType;
    }

    // Handling the size for numeric types.
    const rawSize = "size" in returnDef ? returnDef.size : undefined;
    if (rawSize === undefined) {
        throw new Error(`Missing size for numeric type in block: ${returnBlockName}`);
    }

    let size: 8 | 16 | 32 | 64 | 128;
    if (typeof rawSize === "string") {
        try {
            size = new Function(
                "input", "output", "customData", "stripQuotes", "possibleInputsTypes",
                rawSize
            )(inputs, eventOutput, customData[moduleName], stripQuotes, possibleInputTypes);
        } catch (e) {
            throw new Error(`Script execution error in the 'size' section of block: ${returnBlockName}.`);
        }
    } else {
        size = rawSize as 8 | 16 | 32 | 64 | 128;
    }

    return {
        type: type as "int" | "uint" | "float",
        size: size
    } as ResultValueType;
}


function resolveDirectValue(
    blockDef: ActionBlockDef | ReturnBlockDef,
    inputDefName: string,
    blockName: string,
    textContent: String | Number | Bool
): String | Number | Bool {
    if (blockDef["inputs"][inputDefName].type[0] === "block")
        throw new Error(`Block: "${blockName}" requires a block input, but received a direct value`);

    const textData = textContent;

    if (textData.type === "string") {
        return {
            value: `"${textData.value}"`,
            type: "string"
        };
    } else if (textData.type === "bool") {
        return {
            value: textData.value,
            type: "bool"
        };
    } else {
        return {
            value: textData.value,
            type: textData.type as "float" | "int" | "uint",
            size: textData.size as 64 | 32
        };
    }
}

// Assigning a default value for an optional and undefined input.
function assignDefaultInputValue(
    blockDef: ActionBlockDef | ReturnBlockDef,
    inputDefName: string,
    blockName: string
): String | Number | Bool {
    const inputDef = blockDef["inputs"][inputDefName];
    if (inputDef.required) throw new Error(`Required input missing: ${inputDefName} in ${blockName}`);

    // Assuming the first type in the array is the base type for the default value.
    const type = inputDef.type[0];
    const defaultValue = inputDef.default;

    const defaults: Record<string, String | Number | Bool> = {
        string: {
            // OLD: value: `"${defaultValue ?? ''}"`,
            value: defaultValue ?? '',
            type: "string"
        } as String,
        bool: {
            value: String(defaultValue ?? false),
            type: "bool"
        } as Bool,
        int: {
            value: String(defaultValue ?? 0),
            type: "int",
            size: 32
        } as Number,
        uint: {
            value: String(defaultValue ?? 0),
            type: "uint",
            size: 32
        } as Number,
        float: {
            value: String(defaultValue ?? 0.0),
            type: "float",
            size: 64
        } as Number,
    };

    const result = defaults[type];
    if (!result) {
        throw new Error(`Error assigning default value for block: "${blockName}", input: "${inputDefName}". Unsupported type: ${type}`);
    }

    return result;
}