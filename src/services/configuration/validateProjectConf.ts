import { getFileContent } from "../../utils/fs";
import { ProjectConfigSchema, targetLang, targetPlatform } from "../../schemas/config";
import { logger } from '../../utils/utils';
import { formatZodError } from "./utils";

export async function validateProjectConf() {
    logger.log("\n<--------------------{ Project Validation }-------------------->");
    const projectConfigPath = "config.json";
    const projectConfigText = await getFileContent(projectConfigPath);

    if (!projectConfigText) {
        throw new Error(`Project configuration "config.json" not found.`);
    }

    if (projectConfigText.trim() === "") {
        throw new Error(`Project configuration "config.json" is empty.`);
    }

    let projectConfig: unknown;
    try {
        projectConfig = JSON.parse(projectConfigText);
    } catch {
        throw new Error(`Error while parsing "config.json".`);
    }

    const parseResult = ProjectConfigSchema.safeParse(projectConfig);

    if (!parseResult.success) {
        const errorMessages = formatZodError(parseResult.error.issues);
        throw new Error(`Project configuration validation errors:\n${errorMessages}`);
    }

    const config = parseResult.data;

    // Check if project supports the target platform
    if (targetPlatform !== "default" && !config.targetPlatforms.includes(targetPlatform)) {
        throw new Error(`The project does not support the target platform: "${targetPlatform}". Supported platforms: ${config.targetPlatforms.join(", ")}`);
    }

    // Check if project supports the target language
    if (!config.targetLanguages.includes(targetLang)) {
        throw new Error(`The project does not support the target language: "${targetLang}". Supported languages: ${config.targetLanguages.join(", ")}`);
    }

    // Check entry points
    for (const entryPoint of config.entryPoints) {
        const content = await getFileContent(entryPoint);
        if (content === null) {
            throw new Error(`Entry point file "${entryPoint}" specified in "config.json" does not exist.`);
        }
    }

    logger.log("✔ Everything is fine");
}