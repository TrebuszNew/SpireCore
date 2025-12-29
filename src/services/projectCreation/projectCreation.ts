import { log, warn } from 'console';
import { initProject } from './initProject';
import { CodeGenerated } from '../../schemas/user';
import { runInTheEnd, targetLang } from '../../schemas/config';
import { SectionKeys, SectionKey, SectionsType } from '../../schemas/config';
import { spawn } from "child_process";
import { setupModulesConfigs } from './rust/setupModules';
import { setUpGlobalCargoToml } from './rust/setupGlobalCargoToml';
import { setUpTargetDir } from './rust/setupTargetDir';
import { sections } from './sections';

export async function projectCreation(code: CodeGenerated) {
    log("\n\n#################### PROJECT_CREATION ####################");

    let projectPath = await initProject();

    if (targetLang === "rust") {
        await setupModulesConfigs();
        await setUpGlobalCargoToml();
        await setUpTargetDir(code, sections);
        const command = runInTheEnd ? "run" : "build";
        await executeCargo(command, projectPath);
    }
}


async function executeCargo(command: "run" | "build", cwd: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        const cargo = spawn("cargo", [command, ...args], {
            cwd,
            stdio: "inherit",
            shell: true,
        });

        cargo.on("error", reject);
        cargo.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`cargo ${command} exited with code ${code}`));
        });
    });
}