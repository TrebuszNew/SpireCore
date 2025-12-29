import { addToSectionInTargetScope } from "../sections";
import { ModuleConfig, ModuleConfigLang, SectionKey, SectionKeys, SectionsType, WindowSectionKey, WindowSectionKeys } from "../../../schemas/config";
import { logger } from "../../../utils/utils";
import { convertedPath, createDir, createFile, getFileContent, listAllModules, loadModuleConfig, loadModuleLangConfig, loadProjectConfig } from "../../../utils/fs";
import path from "path";
import { validateModuleSectionAccess, validateWindowSectionUsage } from "../../../utils/moduleValidation";

export async function setupModulesConfigs() {
    const projectConfig = await loadProjectConfig();
    const projectPath = path.join(convertedPath, projectConfig.name);
    const modules = await listAllModules();

    const windowTargetScope = await WindowSections(modules);
    for (const moduleName of modules) {
        if (moduleName === "target") continue;
        await setupRustModule(projectPath, moduleName, windowTargetScope);
    }
    logger.log("Added module configuration.");
}

async function WindowSections(modules: string[]): Promise<{ [key in WindowSectionKey]?: string }> {
    for (const moduleName of modules) {
        if (moduleName === "target") continue;

        const config = await loadModuleConfig(moduleName);
        const langConfig = await loadModuleLangConfig(moduleName);

        if (langConfig?.addToSectionInWindowTargetScope) {
            validateWindowSectionUsage(moduleName, config);
        }

        if (config.moduleType !== "rendering") continue;
        if (!langConfig) {
            throw new Error(`Module (${moduleName}) requires a config.rs.json file for rendering modules!`);
        }

        const sectionsRaw = langConfig.addToSectionInWindowTargetScope;
        if (!sectionsRaw) return {};

        const result: { [key in WindowSectionKey]?: string } = {};

        // Processing configuration entries
        for (const [key, entry] of Object.entries(sectionsRaw)) {
            const sectionKey = key as WindowSectionKey;
            if (!entry) continue;

            if ("file" in entry) {
                const filePath = path.join("modules", moduleName, entry.file);
                const content = await getFileContent(filePath);

                if (!content) throw new Error(`Failed to fetch file content for section ${sectionKey}`);
                result[sectionKey] = content;
            } else if ("text" in entry) {
                result[sectionKey] = entry.text;
            }
        }

        return result; // Returns the result of the first rendering module found
    }

    return {};
}

async function setupRustModule(
    projectPath: string,
    moduleName: string,
    windowTargetScope: { [key in WindowSectionKey]?: string }
) {
    const [langConfig, moduleConfig] = await Promise.all([
        loadModuleLangConfig(moduleName),
        loadModuleConfig(moduleName)
    ]);

    if (!moduleConfig) {
        throw new Error(`Module (${moduleName}) does not have a config.json file!`);
    }

    const moduleRootPath = path.join(projectPath, "src", `spirelite_${moduleName}`);
    const moduleSrcPath = path.join(moduleRootPath, "src");

    await createDir(moduleRootPath);
    if (langConfig?.addFileToLocalScope) {
        await createDir(moduleSrcPath);
        await createLocalScopeFiles(moduleName, moduleRootPath, langConfig);
    }

    await createModuleCargoToml(moduleRootPath, moduleName, moduleConfig, langConfig);

    // 2. Target Scope handling
    const targetScope = langConfig?.addToSectionInTargetScope;
    if (!targetScope) return;

    for (const sectionKey of SectionKeys) {
        const config = targetScope[sectionKey];
        if (!config) continue;
        let content = "";
        if ("file" in config) {
            const filePath = path.join("modules", moduleName, config.file);
            const rawContent = await getFileContent(filePath);

            if (!rawContent) {
                throw new Error(`Failed to fetch file content for section ${sectionKey}`);
            }

            // Efficient replacement of all keys at once
            content = WindowSectionKeys.reduce((acc, key) => {
                const regex = new RegExp(`^[ \\t]*\\$\\{${key}\\}[ \\t]*$`, "gm");
                return acc.replace(regex, windowTargetScope[key] || "");
            }, rawContent);
        } else if ("text" in config) {
            content = config.text;
        }

        if (content) {
            validateModuleSectionAccess(moduleName, moduleConfig, sectionKey as SectionKey, content);
            addToSectionInTargetScope(sectionKey as keyof SectionsType, content);
        }
    }
}

async function createLocalScopeFiles(moduleName: string, moduleRoot: string, langConfig: ModuleConfigLang) {
    const logicFilesPath = path.join(moduleRoot, "src");
    const addFileToLocalScope = langConfig.addFileToLocalScope;
    if (!addFileToLocalScope) return;
    for (const file in addFileToLocalScope) {
        if ("text" in addFileToLocalScope[file]) {
            createFile(path.join(logicFilesPath, file), `#![allow(warnings)]\n${addFileToLocalScope[file].text}`);
        }
        if ("file" in addFileToLocalScope[file]) {
            const content = await getFileContent(path.join("modules", moduleName, addFileToLocalScope[file].file));
            if (!content)
                throw new Error(`No file found at path: ${path.join(moduleRoot, addFileToLocalScope[file].file)}. Even so, module: "${moduleName}" refers to it.`)
            createFile(path.join(logicFilesPath, file), `#![allow(warnings)]\n${content}`);
        }
    }
}

async function createModuleCargoToml(moduleRoot: string, moduleName: string, moduleConfig: ModuleConfig, langConfig: ModuleConfigLang | null) {
    const dependencies = langConfig?.libraries
        ? Object.entries(langConfig.libraries)
            .filter(([, cfg]) => cfg.scope.includes("local"))
            .map(([name, cfg]) => {
                const source = cfg.version ? `version = "${cfg.version}"` : `git = "${cfg.git}"`;
                return `${name} = { ${source} }`;
            })
            .join("\n")
        : "";

    const lib = langConfig?.addFileToLocalScope ?
        `
            [lib]
            name = "${`spirelite_${moduleName}`}"
            path = "src/lib.rs"
            crate-type = ["cdylib", "rlib"]
        ` : ""

    await createFile(
        path.join(moduleRoot, "Cargo.toml"),
        `
            [package]
            name = "${`spirelite_${moduleName}`}"
            version = "${moduleConfig.version}"
            edition = "2024"

            ${lib}

            [dependencies]
            ${dependencies}
        `
    );
}