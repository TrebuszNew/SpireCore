import { blockDef, EventBlockDef, ActionBlockDef, ReturnBlockDef, InputSectionParametersSchema, CodeResultValueTypeSchema, OutputsSectionParametersSchema, POSSIBLE_OUTPUT_TYPES, ResultValueTypeSchema, HandleSectionParametersSchema } from '../../schemas/blocks';
import { blocksList, getFileContent } from '../../utils/fs'
import { parseBlockDef } from '../../utils/parsers/blockDef';
import { isResultValueType, logger } from '../../utils/utils';
import { resolveBlockKind, checkIfReturns, validateNumericTypeSize } from './utils';
import path from 'path';
import * as acorn from "acorn";
import * as walk from "acorn-walk";

export async function validateBlocksDef() {
    logger.log("<--------------------{ Blocks Validation }-------------------->");
    const blockDefPaths = await blocksList();
    let first = true;
    for (const moduleName in blockDefPaths) {
        if (first)
            logger.log(`[===== ${moduleName} =====]`)
        else
            logger.log(`\n[===== ${moduleName} =====]`)
        first = false
        const blocksNames = blockDefPaths[moduleName];
        for (const blockName of blocksNames) {

            if (blockName === "#flags") {
                throw new Error(`Block in module "${moduleName}" cannot be named "#flags".`);
            }

            const filePath = path.join("modules", moduleName, `${blockName}.xml`);
            const blockDefText = await getFileContent(filePath);
            if (blockDefText === null) {
                throw new Error(`Block definition not found...`);
            }
            const blockDef = await parseBlockDef(blockDefText, blockName)
            const kind = resolveBlockKind(blockDef);

            if (kind === "action") {
                checkInputsSection(blockDef as ActionBlockDef, blockName);
                checkCodeSection(blockDef as ActionBlockDef, blockName);
            }
            if (kind === "return") {
                checkInputsSection(blockDef as ReturnBlockDef, blockName);
                checkReturnSection(blockDef as ReturnBlockDef, blockName);
                checkCodeSection(blockDef as ReturnBlockDef, blockName);
            }
            if (kind === "event") {
                checkOutputsSection(blockDef as EventBlockDef, blockName);
                checkResultTypeSection(blockDef as EventBlockDef, blockName);
                checkHandleSection(blockDef as EventBlockDef, blockName);
            }
            logger.log(`✔ ${blockName}`)
        }

    }
}


export function checkInputsSection(blockDef: blockDef, blockName: string) {
    const inputsSection = (blockDef as ActionBlockDef | ReturnBlockDef).inputs;

    for (const inputName in inputsSection) {
        const result = InputSectionParametersSchema.safeParse(inputsSection[inputName]);

        if (!result.success) {
            const errorMessages = result.error.issues.map(err => {
                if (err.code === 'unrecognized_keys') {
                    return `Input "${inputName}" in block "${blockName}" has an unknown parameter: "${err.keys.join(', ')}".`;
                }
                return `Input "${inputName}" in block "${blockName}", field "${err.path.join('.')}" - ${err.message}`;
            }).join('\n');

            throw new Error(errorMessages);
        }

        const inputParameters = result.data;

        if (inputParameters.type.includes("block") && inputParameters.type.length > 1) {
            throw new Error(`Block: "${blockName}" in input: "${inputName}" May have either a "block" type input or other types (uint, int, float, string, bool), but not both simultaneously!`);
        }

        for (const type of inputParameters.type) {
            if (type === "block" && inputParameters.canYouPutBlockIn === false) {
                throw new Error(`input: "${inputName}" in block: "${blockName}" Requires a block, but "canYouPutBlockIn" is set to false. Which makes no sense.`);
            }
        }
    }
}

export function checkCodeSection(blockDef: blockDef, blockName: string) {
    const actionOrReturnBlock = blockDef as ActionBlockDef | ReturnBlockDef;
    const codeSection = actionOrReturnBlock.code;
    if (typeof codeSection !== "string") {
        throw new Error(`The "code" section in block: "${blockName}", is not of type string.`);
    }
    if (codeSection === undefined || codeSection.trim() === "") {
        throw new Error(`The "code" section in block: "${blockName}", is empty!`)
    }

    let ast: acorn.Node;
    try {
        ast = acorn.parse(codeSection, { ecmaVersion: "latest" });
    } catch {
        throw new Error(
            `The "code" section in block: "${blockName}", has incorrect JS code.`
        );
    }

    let addAtBlockLocationUsed = 0;
    walk.simple(ast, {
        CallExpression(node: any) {
            const callee = node.callee;

            let isTargetFunction = false;

            if (callee.type === "Identifier" && callee.name === "addAtBlockLocation") {
                isTargetFunction = true;
            }

            if (
                callee.type === "MemberExpression" &&
                callee.property?.type === "Identifier" &&
                callee.property.name === "addAtBlockLocation"
            ) {
                isTargetFunction = true;
            }

            if (!isTargetFunction) return;
            addAtBlockLocationUsed++;

            if (node.arguments.length !== 1) {
                throw new Error(
                    `The addAtBlockLocation() function within block "${blockName}" Must have exactly 1 parameter.`
                );
            }
        }
    });

    if (addAtBlockLocationUsed === 0) {
        throw new Error(
            `The addAtBlockLocation() function within block "${blockName}" Must be used at least once.`
        );
    }
}

export function checkReturnSection(blockDef: blockDef, blockName: string) {
    const returnSection = (blockDef as ReturnBlockDef).return;
    const staticResult = ResultValueTypeSchema.safeParse(returnSection);

    if (staticResult.success) {
        const data = staticResult.data;
        const returnType = data.type;
        const returnSize = "size" in data ? data.size : undefined;

        if (POSSIBLE_OUTPUT_TYPES.includes(returnType)) {
            if (["string", "bool"].includes(returnType)) return;

            validateNumericTypeSize(
                returnType,
                returnSize as number | undefined,
                `The "return" section in block "${blockName}" type "${returnType}"`
            );
        }
    } else {
        const codeResult = CodeResultValueTypeSchema.safeParse(returnSection);

        if (!codeResult.success) {
            const errorMessages = codeResult.error.issues.map(err => {
                return `The "return" section in block "${blockName}", field "${err.path.join('.')}" - ${err.message}`;
            }).join('\n');
            throw new Error(errorMessages);
        }

        const { type: returnType, size: returnSize } = codeResult.data;
        checkIfReturns(returnType, "type", blockName);

        if (returnSize)
            checkIfReturns(returnSize, "size", blockName);
    }
}

export function checkOutputsSection(blockDef: EventBlockDef, blockName: string) {
    const outputsSection = blockDef.outputs;

    for (const outputName in outputsSection) {
        const result = OutputsSectionParametersSchema.safeParse(outputsSection[outputName]);

        if (!result.success) {
            const errorMessages = result.error.issues.map(err => {
                if (err.code === 'unrecognized_keys') {
                    return `Output "${outputName}" in block "${blockName}" has an unknown parameter: "${err.keys.join(', ')}".`;
                }
                return `Output "${outputName}" in block "${blockName}", field "${err.path.join('.')}" - ${err.message}`;
            }).join('\n');
            throw new Error(errorMessages);
        }

        const outputParameters = result.data;
        const outputType = outputParameters.type;
        const outputSize = outputParameters.size;

        if (!isResultValueType(outputParameters) && outputType !== undefined)
            throw new Error(
                `Output "${outputName}" in block "${blockName}" provided an invalid data type: "${outputType}". ` +
                `Allowed types are one of: ${POSSIBLE_OUTPUT_TYPES.join(', ')}.`
            );

        if (!outputType) {
            const resultTypeSection = (blockDef as EventBlockDef).resultType;
            if (resultTypeSection === undefined || resultTypeSection === null)
                throw new Error(
                    `Block: "${blockName}" the output "${outputName}" has no type specified,` +
                    `Yet it does not implement the "resultType" section.`
                );
        }

        validateNumericTypeSize(
            outputType,
            outputSize,
            `Output "${outputName}" in block "${blockName}"`
        );
    }
}

export function checkResultTypeSection(eventBlock: EventBlockDef, blockName: string) {
    const resultTypeSection = eventBlock.resultType;
    if (resultTypeSection === undefined) return;

    for (const outputResultName in resultTypeSection) {
        const outputResult = resultTypeSection[outputResultName];
        const result = CodeResultValueTypeSchema.safeParse(outputResult);

        if (!result.success) {
            const errorMessages = result.error.issues.map(err => {
                return `The "resultType" section, field "${outputResultName}" in block "${blockName}", error in "${err.path.join('.')}" - ${err.message}`;
            }).join('\n');
            throw new Error(errorMessages);
        }

        const { type, size } = result.data;

        if (type) {
            if (POSSIBLE_OUTPUT_TYPES.includes(type as any)) {
                if (typeof size === "number") {
                    validateNumericTypeSize(
                        type,
                        size,
                        `The "resultType" section, field "${outputResultName}" in block "${blockName}"`
                    );
                }
            } else {
                checkIfReturns(type, "type", blockName);
            }
        }

        if (size && typeof size === "string") {
            checkIfReturns(size, "size", blockName);
        }
    }
}

export function checkHandleSection(eventBlock: EventBlockDef, blockName: string) {
    const handleSection = eventBlock.handle;
    if (handleSection === undefined) return;

    const result = HandleSectionParametersSchema.safeParse(handleSection);

    if (!result.success) {
        const errorMessages = result.error.issues.map(err => {
            if (err.code === 'unrecognized_keys') {
                return `The "handle" section in block "${blockName}" has an unknown parameter: "${err.keys.join(', ')}".`;
            }
            return `The "handle" section in block "${blockName}", field "${err.path.join('.')}" - ${err.message}`;
        }).join('\n');
        throw new Error(errorMessages);
    }
}