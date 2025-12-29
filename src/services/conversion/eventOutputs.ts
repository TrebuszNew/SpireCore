import { EventBlockFlagsUser } from "../../schemas/user";
import { EventBlockDef, OutputsSectionParameters, ResultValueType, OutputResult, ExpectedOutputType, codeResultValueType } from "../../schemas/blocks";
import { getValidatedOutput, isResultValueType, stripQuotes } from "../../utils/utils";
import { POSSIBLE_OUTPUT_TYPES } from "../../schemas/blocks";
import { fileSystem } from "./conversion";
import { INT_SIZES } from "../../schemas/blocks";

// --- Main Function ---

export function eventOutputs(
    eventDef: EventBlockDef,
    moduleName: string,
    eventFlags: EventBlockFlagsUser | undefined,
    customData: { [moduleName: string]: unknown },
    eventName: string,
): { [outputName: string]: OutputResult } {

    const results: { [outputName: string]: OutputResult } = {};

    for (const outputName in eventDef.outputs) {
        const outputDef = eventDef.outputs[outputName];
        const returnSection = (() => {
            if (eventDef.resultType) {
                return eventDef.resultType[outputName];
            } else {
                return undefined
            }
        })();
        results[outputName] = returnTypeForOutput(outputName, outputDef, returnSection, moduleName, eventName, customData, eventFlags);
    }

    return results;
}

function returnTypeForOutput(
    outputName: string,
    outputDef: OutputsSectionParameters,
    returnSection: codeResultValueType | undefined,
    moduleName: string,
    eventName: string,
    customData: { [moduleName: string]: unknown },
    eventFlags: EventBlockFlagsUser | undefined
): OutputResult {
    if (outputDef.type) {

        if (outputDef.multiple) {
            return multipleKnownType(outputName, outputDef, returnSection, moduleName, eventName, customData, eventFlags)
        } else {
            return notMultipleKnownType(outputDef)
        }
    } else {

        if (!returnSection) {
            throw new Error(`ResultType not provided, even though "${outputName}" does not specify a type. Create a "resultType" section in block: "${eventName}"`);
        }
        if (outputDef.multiple) {
            return multipleUnknownType(outputName, outputDef, returnSection, moduleName, eventName, customData, eventFlags);
        } else {
            return notMultipleUnknownType(outputName, outputDef, returnSection, moduleName, eventName, customData, eventFlags);
        }
    }
}

// --- scenarios ---

function multipleKnownType(
    outputName: string,
    outputDef: OutputsSectionParameters,
    returnSection: codeResultValueType | undefined,
    moduleName: string,
    eventName: string,
    customData: { [moduleName: string]: unknown },
    eventFlags: EventBlockFlagsUser | undefined
): { [nameOfMultiple: string]: ResultValueType } {

    // 1. Validation: If 'multiple' is true, we need the resultType script to provide the keys/names.
    if (!returnSection) {
        throw new Error(
            `Output "${outputName}" in block "${eventName}" is marked as multiple, ` +
            `but no "resultType" section was provided to determine dynamic names.`
        );
    }

    // 2. Execute the user script. 
    // In this "Known Type" scenario, the script should return an array of strings (the names of the outputs).
    const dynamicNames = executeUserScript(
        returnSection.type,
        customData,
        eventFlags,
        moduleName
    ) as string[];

    if (!Array.isArray(dynamicNames)) {
        throw new Error(
            `The resultType script for multiple output "${outputName}" in block "${eventName}" ` +
            `must return an array of strings representing the output names.`
        );
    }

    const result: { [nameOfMultiple: string]: ResultValueType } = {};

    // 3. Extract the base type from the definition (since it is a "Known Type" scenario).
    const baseType = outputDef.type as ExpectedOutputType;
    validateOutputType(baseType, eventName, outputName);

    // 4. Iterate through the names returned by the script and assign the predefined type to each.
    for (const name of dynamicNames) {
        // Validate the combination of the known type and the defined size.
        const validatedOutput = getValidatedOutput({
            type: baseType,
            size: outputDef.size
        });

        if (!validatedOutput) {
            throw new Error(
                `Failed to determine the return type for dynamic entry "${name}" ` +
                `in output "${outputName}" of block "${eventName}".`
            );
        }

        result[name] = validatedOutput;
    }

    return result;
}

function notMultipleKnownType(outputDef: OutputsSectionParameters) {
    if (isResultValueType(outputDef)) {
        return outputDef as ResultValueType;
    } else {
        throw new Error(`"${JSON.stringify(outputDef)}" is not a valid output type.`)
    }
}

function multipleUnknownType(
    outputName: string,
    outputDef: OutputsSectionParameters,
    returnSection: codeResultValueType,
    moduleName: string,
    eventName: string,
    customData: { [moduleName: string]: unknown },
    eventFlags: EventBlockFlagsUser | undefined
) {
    const fileApi = fileSystem(moduleName);

    // 1. Calculating the resultType.
    const resultTypes = executeUserScript(
        returnSection.type,
        customData,
        eventFlags,
        moduleName
    ) as { [outputName: string]: ExpectedOutputType };

    if (!resultTypes)
        throw new Error(`The "resultTypes" property is required.`)

    const resultSizes = (() => {
        if (!returnSection.size) return undefined;
        return executeUserScript(
            returnSection.size,
            customData,
            eventFlags,
            moduleName
        ) as { [outputName: string]: 8 | 16 | 32 | 64 | 128 };
    })();

    const result: { [nameOfMultiple: string]: ResultValueType } = {}
    for (const resultName in resultTypes) {
        const resultType = resultTypes[resultName];
        validateOutputType(resultType, eventName, outputName);

        // 2. Result validation and optional size calculation.
        const validToReturn: ResultValueType = (() => {
            let validatedOutput1 = getValidatedOutput({ type: resultType, size: outputDef.size });
            if (validatedOutput1)
                return validatedOutput1

            if (resultSizes) {
                const size = resultSizes[resultName];
                validateOutputSize(size, eventName, outputName);
                let validatedOutput2 = getValidatedOutput({ type: resultType, size: size });
                if (validatedOutput2)
                    return validatedOutput2
            }

            throw new Error(`Difficulty determining size :/`)
        })();

        // 3. Returning the final, verified result.
        result[resultName] = validToReturn
    }

    return result;
}

function notMultipleUnknownType(
    outputName: string,
    outputDef: OutputsSectionParameters,
    returnSection: codeResultValueType,
    moduleName: string,
    eventName: string,
    customData: { [moduleName: string]: unknown },
    eventFlags: EventBlockFlagsUser | undefined
) {
    // 1. Calculating the resultType.
    const resultType = executeUserScript(
        returnSection.type,
        customData,
        eventFlags,
        moduleName
    ) as ExpectedOutputType;

    validateOutputType(resultType, eventName, outputName);

    const resultSizes = (() => {
        if (outputDef.size) return outputDef.size;
        if (!returnSection.size) return undefined;

        const result = executeUserScript(
            returnSection.size,
            customData,
            eventFlags,
            moduleName
        ) as 8 | 16 | 32 | 64 | 128;

        validateOutputSize(result, eventName, outputName);
        return result;
    })();

    let validatedOutput = getValidatedOutput({ type: resultType, size: resultSizes });
    if (!validatedOutput) {
        throw new Error(`Failed to determine the return type in event: "${eventName}", output: "${outputName}"`)
    }

    // 3. Returning the final, verified result.
    return validatedOutput;
}

// --- Helpers ---

function executeUserScript(
    scriptBody: string,
    customData: { [moduleName: string]: unknown },
    eventFlags: EventBlockFlagsUser | undefined,
    moduleName: string
) {
    const fileApi = fileSystem(moduleName);
    // Executing the user script in the resultType section of the event block.
    return new Function(
        "customData",
        "flags",
        "stripQuotes",
        "fs",
        scriptBody
    )(customData[moduleName], eventFlags, stripQuotes, fileApi);
}

function validateOutputType(resultType: string, eventName: string, outputName: string) {
    if (!POSSIBLE_OUTPUT_TYPES.includes(resultType as any)) {
        throw new Error(`Block: "${eventName}" Should be in resultType/${outputName}/type Return one of these types: [${POSSIBLE_OUTPUT_TYPES.join(", ")}] Instead, it returns: "${resultType}"`);
    }
}

function validateOutputSize(size: 8 | 16 | 32 | 64 | 128, eventName: string, outputName: string) {
    if (!INT_SIZES.includes(size)) {
        throw new Error(`Block: "${eventName}" Should be in resultType/${outputName}/size Return one of these sizes: [${INT_SIZES.join(", ")}] Instead, it returns: "${size}"`);
    }
}
