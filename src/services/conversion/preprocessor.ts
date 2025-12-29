import { customData, fileSystem } from "./conversion";
import { logger, stripQuotes } from "../../utils/utils";
import { createDir, dirOrFileExists, getFileContent, listAllModules, loadModuleConfig, loadModuleLangConfig, unpackedPath } from "../../utils/fs";
import { addToSectionInTargetScope } from "../projectCreation/sections";
import { validateModuleSectionAccess } from "../../utils/moduleValidation";
import { SectionKey } from "../../schemas/config";
import path from 'path';

export async function preprocess() {
    const modules = await listAllModules();

    for (const moduleName of modules) {

        const langConfig = await loadModuleLangConfig(moduleName);
        if (!langConfig?.Preprocessors) continue;

        const moduleConfig = await loadModuleConfig(moduleName);
        const fileApi = fileSystem(moduleName);

        const dataPath = path.join(unpackedPath, "data", moduleName);
        if (!await dirOrFileExists(dataPath)) {
            await createDir(dataPath);
        }

        for (const task of langConfig.Preprocessors) {
            const taskPath = path.join("modules", moduleName, task);
            const taskCode = await getFileContent(taskPath);
            if (!taskCode) continue;

            try {
                customData[moduleName] ??= {};

                const wrappedAddToSectionInTargetScope = (section: SectionKey, code: string) => {
                    validateModuleSectionAccess(moduleName, moduleConfig, section, code);
                    addToSectionInTargetScope(section, code);
                };

                // Running with better isolation and a more comprehensive API.
                new Function(
                    "customData", "stripQuotes", "fs", "addToSectionInTargetScope", "logger",
                    taskCode
                )(
                    customData[moduleName],
                    stripQuotes,
                    fileApi,
                    wrappedAddToSectionInTargetScope,
                    logger
                );
            } catch (err) {
                throw new Error(`[Preprocess Error] Module: ${moduleName}, Task: ${task} \n ${(err as Error).message}`);
            }
        }
    }
}

