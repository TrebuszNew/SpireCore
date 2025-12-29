import { OutputResult, ResultValueType } from "../../../schemas/blocks";
import { SectionsType } from "../../../schemas/config";
import { CodeGenerated } from "../../../schemas/user";
import { logger } from "../../../utils/utils";
import { convertedPath, createDir, createFile, listAllModules, loadModuleLangConfig, loadProjectConfig } from "../../../utils/fs";
import path from "path";

// --- Helper functions for dependencies ---

async function getDependentModules(modulesList: string[]): Promise<string> {
    const result: string[] = [];
    for (const name of modulesList) {
        if (name === "target") continue;
        const langConfig = await loadModuleLangConfig(name);
        if (langConfig?.addFileToLocalScope) {
            result.push(`spirelite_${name} = { path = "../${`spirelite_${name}`}" }`);
        }
    }
    return result.join("\n");
}

async function getDependentLibraries(modulesList: string[]): Promise<string> {
    const libs = await Promise.all(modulesList.map(async (moduleName) => {
        const langConfig = await loadModuleLangConfig(moduleName);
        if (!langConfig || !langConfig.libraries) return [];

        return Object.entries(langConfig.libraries)
            .filter(([, cfg]) => cfg.scope.includes("target"))
            .map(([name, cfg]) => {
                const source = cfg.version ? `version = "${cfg.version}"` : `git = "${cfg.git}"`;
                const features = (cfg.features ?? []).map(f => `"${f}"`).join(", ");
                return `${name} = { ${source}, features = [${features}] }`;
            });
    }));
    return libs.flat().join("\n");
}

// --- Rust code generation functions ---

function generateEventParameters(outputs: { [key: string]: OutputResult }): string {
    let params = "";
    for (const [outputName, output] of Object.entries(outputs)) {
        if (typeof output === "object" && output !== null) {
            // Multiple Outputs handling
            for (const [subName, subValue] of Object.entries(output)) {
                params += `${outputName}__${subName}: ${convertToFunctionType(subValue)}, `;
            }
        } else {
            params += `${outputName}: ${convertToFunctionType(output)}, `;
        }
    }
    return params;
}

function generateRustEvents(codeGenerated: CodeGenerated): string {
    const allEvents: Record<string, { code: string[], outputs: { [key: string]: OutputResult } }> = {};

    for (const event of codeGenerated) {
        const eventName = Object.keys(event)[0];
        const eventContent = event[eventName];
        if (!allEvents[eventName]) {
            allEvents[eventName] = { code: [], outputs: eventContent.outputs };
        }
        allEvents[eventName].code.push(eventContent.code);
    }

    return Object.entries(allEvents).map(([name, data]) => {
        const params = generateEventParameters(data.outputs);
        const body = data.code.length === 1
            ? data.code[0]
            : data.code.map(s => `std::thread::spawn(|| {${s}});\n`).join("");

        return `fn ${name}(${params}) {\n ${body} \n}`;
    }).join("\n");
}

// --- "Main process function ---

export async function setUpTargetDir(codeGenerated: CodeGenerated, sections: SectionsType) {
    const projectConfig = await loadProjectConfig();
    const modulesList = await listAllModules();
    const targetPath = path.join(convertedPath, projectConfig.name, "src", "target");

    // 1. Preparing data for Cargo.toml
    const [depModules, depLibs] = await Promise.all([
        getDependentModules(modulesList),
        getDependentLibraries(modulesList)
    ]);

    // 2. Creating directory structure
    await createDir(targetPath);
    await createDir(path.join(targetPath, "src"));

    // 3. Generating Cargo.toml
    await createFile(path.join(targetPath, "Cargo.toml"), `
        [package]
        name = "${projectConfig.name}"
        version = "${projectConfig.version}"
        edition = "2024"

        [dependencies]
        raw-window-handle = { version = "0.6.2" }
        once_cell = "1.21.3"

        ${depModules}
        
        ${depLibs}
    `);

    // 4. Generating main.rs
    await createFile(path.join(targetPath, "src", "main.rs"), `
        fn main() {
            ${projectConfig.name}::entry();
        }
    `);

    // 5. Generating lib.rs
    const generatedEventsCode = generateRustEvents(codeGenerated);
    const exitStrategy = sections.eventLoop === ""
        ? "static target__EXIT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);"
        : "";

    const eventLoopCode = sections.eventLoop === ""
        ? `loop { if target__EXIT.load(std::sync::atomic::Ordering::Relaxed) { break; } }`
        : sections.eventLoop;

    await createFile(path.join(targetPath, "src", "lib.rs"), `
        #![allow(warnings)]
        ${exitStrategy}

        enum target__EventsOS { ${sections.eventOS} }
        pub enum target__EventsRender { ${sections.eventRender} }

        struct target__App {
            renders: std::collections::HashMap<u32, target__Render>,
            ${sections.stateApp}
        }

        struct target__Render {
            rx: std::sync::mpsc::Receiver<target__EventsRender>,
            ${sections.stateRender}
        }

        static target__RENDER: once_cell::sync::OnceCell<std::sync::Mutex<std::collections::HashMap<u32, std::sync::mpsc::Sender<target__EventsRender>>>> = once_cell::sync::OnceCell::new();

        ${sections.global}

        pub fn entry() {
            target__RENDER.set(std::sync::Mutex::new(std::collections::HashMap::new())).expect("Failed to init");
            ${sections.preUser}
            std::thread::spawn(|| { target__on_start() });
            ${eventLoopCode}
        }

        ${generatedEventsCode}
    `);

    logger.log("Target scope created and configured");
}

function convertToFunctionType(type: ResultValueType): string {
    if (type.type === "string")
        return "String"
    if (type.type === "bool")
        return "bool"
    if (type.type === "int" || type.type === "uint") {
        return `${type.type[0]}${type.size}`
    }
    if (type.type === "float") {
        return `${type.type[0]}${type.size}`
    }
    throw new Error(`Unsupported or invalid type for conversion to function type`)
}