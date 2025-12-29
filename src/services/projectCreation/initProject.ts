import { convertedPath, dirOrFileExists, loadProjectConfig } from "../../utils/fs";
import fs from "fs";
import path from "path";
import { targetLang } from "../../schemas/config";
import { logger, runCmd } from "../../utils/utils";

export async function initProject(): Promise<string> {
    try {
        const projectConfig = await loadProjectConfig();
        const projectPath = path.join(convertedPath, projectConfig.name);

        if (targetLang === "rust") {
            await clearDirExcept(projectPath, ["target", "Cargo.lock"]);
            await runCmd("cargo init", projectPath);
            await fs.promises.rm(path.join(projectPath, "src", "main.rs"));
        }

        logger.log("Space initialized");
        return projectPath;
    } catch (error) {
        throw new Error("Error during project initialization: " + error);
    }
}

async function clearDirExcept(
  dir: string,
  keepNames: string[]
) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    await Promise.all(
        entries.map(entry => {
            if (keepNames.includes(entry.name)) return Promise.resolve();
            return fs.promises.rm(path.join(dir, entry.name), {
                recursive: true,
                force: true,
            });
        })
    );
}