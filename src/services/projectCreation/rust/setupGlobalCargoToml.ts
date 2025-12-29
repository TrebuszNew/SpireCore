import { logger } from "../../../utils/utils";
import { convertedPath, listAllModules, loadModuleLangConfig, loadProjectConfig, writeToFile } from "../../../utils/fs";
import path from "path";

export async function setUpGlobalCargoToml() {
    const projectConfig = await loadProjectConfig();
    const projectPath = path.join(convertedPath, projectConfig.name);
    const modulesList = await listAllModules();
    
    const moduleChecks = await Promise.all(
        modulesList.map(async (name) => {
            if (name === "target") return null;
            const config = await loadModuleLangConfig(name);
            return config?.addFileToLocalScope ? `"src/spirelite_${name}"` : null;
        })
    );
    const members = moduleChecks
        .filter((entry): entry is string => entry !== null)
        .join(",\n");


    await writeToFile(
        path.join(projectPath, "Cargo.toml"),
        `
            [workspace]
            members = [
                "src/target",
                ${members}
            ]
            default-members = ["src/target"]
            resolver = "2"
        `
    );

    logger.log("Configured the workspace Cargo.toml file.");
}