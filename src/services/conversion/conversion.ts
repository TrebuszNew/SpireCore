import type { EventBlockFlagsUser, ActionAndReturnBlockFlagsUser, CodeGenerated, UserCode, GeneratedEventEntry, BlockContentUser } from '../../schemas/user'
import type { ActionBlockDef, EventBlockDef } from '../../schemas/blocks'
import { getFileContent, getBlockDef, blockFromModule, unpackedPath, loadProjectConfig } from '../../utils/fs'
import { getBlockType } from '../../utils/parsers/blockDef'
import { parseCodeUser } from '../../utils/parsers/userCode'
import { logger, stripQuotes } from '../../utils/utils'
import { blockInputs } from './blockInputs'
import { eventOutputs } from './eventOutputs'
import { preprocess } from './preprocessor'
import fs from 'fs'
import path from 'path'

export const customData: { [moduleName: string]: unknown } = {}

export async function conversion(): Promise<CodeGenerated> {
    logger.log("\n\n#################### CONVERSION ####################")

    const code: CodeGenerated = [];
    const projectConfig = await loadProjectConfig()
    const entryFilePath = await getFileContent(projectConfig.entryPoints[0])
    if (!entryFilePath) {
        throw new Error(`User code not found at path: "${projectConfig.entryPoints[0]}"`)
    }
    const userCode = await parseCodeUser(entryFilePath);

    await preprocess();

    let firstEvent = true;
    for (const eventBlock of userCode) {
        const eventName = Object.keys(eventBlock)[0];
        const eventFlags = eventBlock["#flags"] as EventBlockFlagsUser;
        const eventContent = eventBlock[eventName];
        const eventModuleName = await blockFromModule(eventName, eventFlags);
        const eventDef = await getBlockDef(eventModuleName, eventName) as EventBlockDef;

        if (firstEvent)
            logger.log(`<--------------------{ ${eventName} }-------------------->`);
        else
            logger.log(`\n\n<--------------------{ ${eventName} }-------------------->`);
        firstEvent = false;

        const eventOutput = eventOutputs(eventDef, eventModuleName, eventFlags, customData, eventName);
        logger.log("EVENT OUTPUT:", eventOutput);

        const eventSuffix = (() => {
            const suffix = eventDef.handle?.suffix;
            if (!suffix) return undefined;
            const isCode = suffix.includes(' ');
            if (isCode) {
                return new Function(
                    "customData",
                    "flags",
                    "stripQuotes",
                    suffix
                )(customData[eventModuleName], eventFlags, stripQuotes);
            } else {
                return suffix;
            }
        })() as string | undefined;

        const realEventName = eventSuffix
            ? `${eventModuleName}__${eventName}__${eventSuffix}`
            : `${eventModuleName}__${eventName}`;

        const currentEventEntry = { [realEventName]: { code: "", outputs: eventOutput, flags: eventFlags! } };
        code.push(currentEventEntry);

        if (eventContent === undefined) continue;

        for (const block of eventContent) {
            const blockName = Object.keys(block)[0];
            const blockFlags = block["#flags"] as ActionAndReturnBlockFlagsUser;
            const blockContent = block[blockName];
            const blockModuleName = await blockFromModule(blockName, blockFlags);
            const blockDef = await getBlockDef(blockModuleName, blockName) as ActionBlockDef;

            logger.log(`\n[===== ${blockName} =====]`);

            if (getBlockType(blockDef) !== "action")
                throw new Error(`Expected an action type block, but received block type: ${getBlockType(blockDef)}`);

            const depth = 0;
            const blockInputMap = await blockInputs(blockDef, blockContent, blockName, eventOutput, depth);

            const helpers = createHelpers(
                currentEventEntry,
                blockContent,
                realEventName
            );

            customData[blockModuleName] ??= {};
            // Executing the code within the "code" section definition to determine the replacement for this action block (specifically at depth 0, i.e., directly attached to the event).
            new Function(
                "customData",
                "input",
                "addAtBlockLocation",
                "isThereSpecificBlockInTheInput",
                "isThereBlockInTheInput",
                "stripQuotes",
                blockDef.code
            )(customData[blockModuleName], blockInputMap, helpers.addAtBlockLocation, helpers.isThereSpecificBlockInTheInput, helpers.isThereBlockInTheInput, stripQuotes)
        }

    }

    return code;
}


export const fileSystem = (moduleName: string) => ({
    readFile(filePath: string) {
        try {
            const dirPath = path.join(unpackedPath, "data", moduleName, filePath);
            return fs.readFileSync(dirPath, "utf8");
        } catch {
            return null;
        }
    }
});

function createHelpers(currentEventEntry: GeneratedEventEntry, blockContent: BlockContentUser, realEventName: string) {
    return {
        addAtBlockLocation(what: unknown) {
            if (typeof what !== "string")
                throw new Error("Non-string value provided for an input that requires a string in addAtBlockLocation.")
            currentEventEntry[realEventName].code += what.trim()

        },
        isThereSpecificBlockInTheInput(input: unknown, block: unknown) {
            if (typeof input !== "string") throw new Error("A non-string value was provided for an input in isThereSpecificBlockInTheInput, which requires a string.")
            if (typeof block !== "string") throw new Error("A string is required for 'block' in isThereSpecificBlockInTheInput.");

            const content = blockContent[input];
            if (!content || typeof content !== 'object') return false;

            const text = content["#text"];
            if (Array.isArray(text)) {
                // Searching through array elements for a segment that constitutes a block named block.
                for (const item of text) {
                    if (item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, block)) {
                        // We have found the target block.
                        return true;
                    }
                }
                // Missing appropriate block.
                return false;
            }
            // Block missing.
            return false;
        },
        isThereBlockInTheInput(input: unknown) {
            if (typeof input !== "string") throw new Error("Non-string value provided for an input that requires a string in isThereBlockInTheInput.")
            return Array.isArray(blockContent[input]?.["#text"])
        }
    };
}