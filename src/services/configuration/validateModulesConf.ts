import { unpackedPath, getFileContent } from "../../utils/fs";
import { logger } from '../../utils/utils';
import { ModuleConfig, ModuleConfigSchema, programVersion, targetPlatform, targetLang, ModuleConfigLang, ModuleConfigLangSchema } from "../../schemas/config";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateModuleSectionAccess, validateWindowSectionUsage } from "../../utils/moduleValidation";

import { formatZodError } from "./utils";



export async function validateModulesConf() {
    let windowingModule: string | null = null;
    let renderingModule: string | null = null;

    logger.log("\n<--------------------{ Modules Validation }-------------------->")
    const modulesDir = path.join(unpackedPath, "modules");

    try {
        await fs.promises.access(modulesDir);
    } catch {
        throw new Error(`The "modules" directory does not exist in: ${modulesDir}`);
    }

    const modules = await fs.promises.readdir(modulesDir, { withFileTypes: true });

    const moduleConfigs: Record<string, ModuleConfig> = {};

    for (const dirent of modules) {
        if (!dirent.isDirectory()) continue;

        const moduleName = dirent.name;
        const configPath = path.join("modules", moduleName, "config.json");
        const configText = await getFileContent(configPath);

        if (!configText) {
            throw new Error(`Module "${moduleName}" Does not have a config.json file.`);
        }

        const config = validateModuleConfig(configText, moduleName);
        moduleConfigs[moduleName] = config;
        validatePlatformSupport(config, moduleName);

        const result = checkModuleUniqueness(config, moduleName, windowingModule, renderingModule);
        windowingModule = result.windowing;
        renderingModule = result.rendering;

        await validateRustConfig(moduleName, config);

        logger.log(`✔ ${moduleName}`);
    }

    await validateGlobalModulesConfiguration(windowingModule, renderingModule, moduleConfigs);
}



export function validateModuleConfig(configText: string, moduleName: string): ModuleConfig {
    let configRaw: any;
    try {
        configRaw = JSON.parse(configText);
    } catch {
        throw new Error(`Error parsing config.json for module "${moduleName}".`);
    }

    const parseResult = ModuleConfigSchema.safeParse(configRaw);

    if (!parseResult.success) {
        const errorMessages = formatZodError(parseResult.error.issues);
        throw new Error(`Module "${moduleName}": validation failed.\n${errorMessages}`);
    }

    const config = parseResult.data;

    if (programVersion[0] !== config.engineVersion[0]) {
        throw new Error(`Module "${moduleName}": incompatible engine version (engineVersion).`);
    }

    return config;
}


export function validatePlatformSupport(config: ModuleConfig, moduleName: string) {
    if (!config.supportedPlatforms.includes(targetPlatform) && targetPlatform !== "default") {
        throw new Error(`Module "${moduleName}" does not support the target platform: "${targetPlatform}".`);
    }

    const platformMap: Record<string, string> = {
        'win32': 'windows',
        'linux': 'linux',
        'darwin': 'macos',
    };

    const currentOS = (platformMap[os.platform() as keyof typeof platformMap]) || "unknown";

    if (targetPlatform === "default") {
        const isSupported = config.supportedPlatforms.includes(currentOS as any);

        if (!isSupported) {
            throw new Error(
                `Module "${moduleName}" does not support the current platform (${currentOS}). ` +
                `Supported platforms: ${config.supportedPlatforms.join(", ")}`
            );
        }
    }
}


export function checkModuleUniqueness(
    config: ModuleConfig,
    moduleName: string,
    currentWindowing: string | null,
    currentRendering: string | null
): { windowing: string | null, rendering: string | null } {
    let windowing = currentWindowing;
    let rendering = currentRendering;

    if (config.moduleType === "windowing") {
        if (windowing) {
            throw new Error(`Module "${moduleName}": a window module already exists "${windowing}". Only one window module is allowed.`);
        }
        windowing = moduleName;
    }
    if (config.moduleType === "rendering") {
        if (rendering) {
            throw new Error(`Module "${moduleName}": a rendering module already exists "${rendering}". Only one rendering module is allowed.`);
        }
        rendering = moduleName;
    }

    return { windowing, rendering };
}


export async function validateRustConfig(moduleName: string, config: ModuleConfig) {
    if (targetLang !== "rust") return;

    const configLangPath = path.join("modules", moduleName, "config.rs.json");
    const configLangText = await getFileContent(configLangPath);

    if (!configLangText) return;

    let configLang: ModuleConfigLang;
    try {
        configLang = JSON.parse(configLangText);
    } catch {
        throw new Error(`Error parsing config.rs.json for module "${moduleName}".`);
    }

    const parseResult = ModuleConfigLangSchema.safeParse(configLang);

    if (!parseResult.success) {
        const errorMessages = formatZodError(parseResult.error.issues);
        logger.warn(`Module "${moduleName}": validation of config.rs.json failed:\n${errorMessages}`);
    }

    const allowedOptions = ["addFileToLocalScope", "addToSectionInTargetScope", "libraries", "addToSectionInWindowTargetScope", "Preprocessors"];
    const options = Object.keys(configLang);
    for (const option of options) {
        if (!allowedOptions.includes(option))
            logger.warn(
                `In config.rs.json, in module ${moduleName} there is a setting: ${option}. Which is not supported in this version of SpireCore (${programVersion}). supported are [${allowedOptions.join(", ")}]`
            )
    }

    if (configLang.addToSectionInTargetScope) {
        for (const [section, entry] of Object.entries(configLang.addToSectionInTargetScope)) {
            if (!entry) continue;
            let content = "";
            if ("text" in entry) content = entry.text;
            // Note: we might not have file content here without reading it, 
            // but for static validation we should at least check the keys.
            // If it's a file, we could read it, but preprocess/setupModules will catch it anyway.
            // Let's at least validate the section key first.
            validateModuleSectionAccess(moduleName, config, section as any, content);
        }
    }

    if (configLang.addToSectionInWindowTargetScope) {
        validateWindowSectionUsage(moduleName, config);
    }
}


export async function validateGlobalModulesConfiguration(
    windowingModule: string | null,
    renderingModule: string | null,
    moduleConfigs: Record<string, ModuleConfig>
) {
    if (!windowingModule) {
        logger.log("\n windowing module: None");
    } else {
        validateSpecificModule(windowingModule, "windowing", moduleConfigs[windowingModule]);
        logger.log(`windowing module: ${windowingModule}`);
    }

    if (!renderingModule) {
        logger.log("\n rendering module: None");
    } else {
        validateSpecificModule(renderingModule, "rendering", moduleConfigs[renderingModule]);
        logger.log(`rendering module: ${renderingModule}`);
    }
}

function validateSpecificModule(moduleName: string, expectedType: "windowing" | "rendering", config: ModuleConfig | undefined) {
    if (!config) {
        throw new Error(`Configuration for module "${moduleName}" not found.`)
    }

    if (config.moduleType !== expectedType) {
        throw new Error(`The module "${moduleName}" is not of type ${expectedType}, yet it was used as a module for ${expectedType}.`)
    }
}

