import { XMLParser } from "fast-xml-parser";
import { blockDef, ActionBlockDef, ReturnBlockDef, EventBlockDef, InputSectionParameters, OutputsSectionParameters, ResultValueType, codeResultValueType, HandleSectionParameters } from '../../schemas/blocks'
import { logger } from '../utils';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    preserveOrder: true,
    parseTagValue: true,
});

export function parseBlockDef(xml: string, blockName: string): blockDef {
    const blockDefParsed = parser.parse(xml)[0]["block"];
    try {
        const sectionNameMap = (() => {
            let sectionsNames: string[] = [];
            for (const section in blockDefParsed) {
                sectionsNames.push(Object.keys(blockDefParsed[section])[0]);
            }
            return sectionsNames;
        })();
        const sectionContentMap: { [sectionName: string]: unknown } = (() => {
            let sectionsContents: { [sectionName: string]: unknown } = {};
            for (const section in blockDefParsed) {
                const sectionName = Object.keys(blockDefParsed[section])[0];
                const sectionContent = blockDefParsed[section][sectionName]
                sectionsContents[sectionName] = sectionContent;
            }
            return sectionsContents;
        })();

        // Event
        if (sectionNameMap.includes("outputs")) {
            let parsedResultType: { [outputName: string]: codeResultValueType } | undefined = (() => {
                const result: { [outputName: string]: codeResultValueType } = {};
                const resultTypeSection = (sectionContentMap["resultType"] as any);
                if (!resultTypeSection) return;
                for (const outputResultType of resultTypeSection) {
                    const outputName = Object.keys(outputResultType)[0];
                    const outputContent = outputResultType[outputName];
                    let type = "";
                    let size: string | undefined = "";
                    for (const properties of outputContent) {
                        const propertyName = Object.keys(properties)[0];
                        const propertyContent: string = properties[propertyName][0]["#text"]
                        if (propertyName === "type") type = propertyContent;
                        if (propertyName === "size") size = propertyContent;
                    }
                    result[outputName] = { type, size };
                }
                return result;
            })();

            const handleData = (() => {
                const handleSection = sectionContentMap["handle"] as any;
                if (!handleSection) return undefined;
                const result: { [key: string]: HandleSectionParameters } = {};
                for (const key of handleSection) {
                    const handleName = Object.keys(key)[0];
                    const handleContent = normalizeCDATAtoString(key[handleName]) || null;
                    result[handleName] = handleContent as HandleSectionParameters;
                }
                return result;
            })();

            return {
                "outputs": normalizeOutput(sectionContentMap["outputs"]),
                "resultType": parsedResultType,
                "handle": handleData
            } as EventBlockDef;
        }

        // Return
        if (sectionNameMap.includes("return")) {
            let parsedReturn: ResultValueType | codeResultValueType = (() => {

                let type: string = "";
                let size: undefined | number | string = undefined;
                const returnSection = (sectionContentMap["return"] as any);
                for (const key of returnSection) {
                    if (Object.keys(key)[0] === "type") {
                        type = normalizeCDATAtoString(key["type"]) as string;
                    }
                    if (Object.keys(key)[0] === "size") {
                        size = normalizeCDATAtoString(key["size"]) as number;
                    }
                }

                if (type === "" || type === undefined) {
                    throw new Error(`Missing return type in return block (block name: ${blockName}). Expected a type.`);
                }

                if (["int", "uint", "float"].includes(type) && size === undefined) {
                    throw new Error(`Missing size for return type ${type} in return block (block name: ${blockName}}). "Expected size to be provided.`);
                }

                if (["int", "uint", "float"].includes(type)) {
                    return { type: type as "int" | "uint" | "float" | "bool" | "string", size: size as 8 | 16 | 32 | 64 | 128 } as ResultValueType;
                }
                if (["string", "bool"].includes(type)) {
                    return { type: type as "string" | "bool" } as ResultValueType;
                }
                return { "type": type, "size": size } as codeResultValueType;

            })();

            return {
                "inputs": normalizeInput(sectionContentMap["inputs"]),
                "return": parsedReturn,
                "code": normalizeCDATAtoString(sectionContentMap["code"])
            } as ReturnBlockDef;
        }

        // Action
        return {
            "inputs": normalizeInput(sectionContentMap["inputs"]),
            "code": normalizeCDATAtoString(sectionContentMap["code"])
        } as ActionBlockDef;

    } catch (e) {
        throw new Error(`"Failed to parse block definition, error: ${e}`)
    }
}
function normalizeInput(inputs: any): { [inputName: string]: InputSectionParameters } {
    const toReturn: { [inputName: string]: InputSectionParameters } = {};
    for (const inputIndex in inputs) {
        const input = inputs[inputIndex];
        const inputName = Object.keys(inputs[inputIndex])[0];
        const inputParameters = input[":@"]

        try {
            const types = JSON.parse(inputParameters.type)
            if (Array.isArray(types)) {
                inputParameters.type = types
            }
        } catch {
            inputParameters.type = [inputParameters.type]
        }
        try {
            if (inputParameters.valueList) {
                const valueList = JSON.parse(inputParameters.valueList);
                inputParameters.valueList = valueList
            }
        } catch {
            logger.warn(`Invalid valueList provided in input: ${inputName} `);
            inputParameters.valueList = undefined;
        }

        toReturn[inputName] = inputParameters
    }
    return toReturn;
}
function normalizeOutput(outputs: any): { [outputName: string]: OutputsSectionParameters } {
    const toReturn: { [outputName: string]: OutputsSectionParameters } = {};
    for (const outputIndex in outputs) {
        const output = outputs[outputIndex];
        const outputName = Object.keys(outputs[outputIndex])[0];
        const outputParameters = output[":@"];
        try {
            if (outputParameters.valueList) {
                const valueList = JSON.parse(outputParameters.valueList);
                outputParameters.valueList = valueList
            }
        } catch {
            logger.warn(`Invalid valueList provided in input: ${outputName} `);
            outputParameters.valueList = undefined
        }

        toReturn[outputName] = outputParameters
    }
    return toReturn;
}
function normalizeCDATAtoString(CDATA: any): unknown {
    if (!CDATA)
        return undefined
    return CDATA[0]["#text"]
}


export function getBlockType(def: blockDef): "action" | "return" | "event" {
    if ("outputs" in def) {
        return "event";
    }

    if ("return" in def) {
        return "return";
    }

    return "action";
}