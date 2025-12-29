import path from "path";
import os from "os";
import fs from "fs";

import { parseBlockDef } from "./parsers/blockDef";
import {
    ActionAndReturnBlockFlagsUser,
    EventBlockFlagsUser
} from "../schemas/user";

import {
    ActionBlockDef,
    EventBlockDef,
    ReturnBlockDef
} from "../schemas/blocks";

import {
    ModuleConfig,
    ModuleConfigLang,
    ProjectConfig,
    ProjectConfigSchema,
    ModuleConfigSchema,
    ModuleConfigLangSchema
} from "../schemas/config";

/* ============================================================
   BASE PATHS
============================================================ */

export const baseDir = (() => {
    switch (process.platform) {
        case "win32":
            return process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
        case "linux":
            return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
        case "darwin":
            return path.join(os.homedir(), "Library", "Application Support");
        default:
            return os.tmpdir();
    }
})();

export const projectPath = path.join(baseDir, "SpireLite");
export const unpackedPath = path.join(projectPath, "unpacked");
export const convertedPath = path.join(projectPath, "converted");

/* ============================================================
   VIRTUAL FILE SYSTEM
============================================================ */

type FolderContent = { [name: string]: Buffer | FolderContent };
let cachedUnpacked: FolderContent | null = null;

function normalizeVirtualPath(p: string): string[] {
    return path
        .normalize(p)
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean);
}

async function readFolderRecursive(dirPath: string): Promise<FolderContent> {
    const content: FolderContent = {};
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
            content[item.name] = await readFolderRecursive(fullPath);
        } else if (item.isFile()) {
            content[item.name] = await fs.promises.readFile(fullPath);
        }
    }
    return content;
}

async function unpackedFolder(): Promise<FolderContent> {
    if (cachedUnpacked) return cachedUnpacked;

    try {
        await fs.promises.stat(unpackedPath);
        cachedUnpacked = await readFolderRecursive(unpackedPath);
        return cachedUnpacked;
    } catch (err) {
        console.error(
            `Failed to load application directory (${unpackedPath}).`,
            err
        );
        cachedUnpacked = {};
        return cachedUnpacked;
    }
}

/* ============================================================
   UNPACKED ACCESS
============================================================ */

// Returns the content of a file in the 'unpacked' directory as a string, or null if the file does not exist.
export async function getFileContent(filePath: string): Promise<string | null> {
    const tree = await unpackedFolder();
    const segments = normalizeVirtualPath(filePath);

    let current: Buffer | FolderContent | undefined = tree;

    for (const segment of segments) {
        if (!current || Buffer.isBuffer(current)) return null;
        current = current[segment];
    }

    return Buffer.isBuffer(current) ? current.toString("utf8") : null;
}

/* ============================================================
   BLOCK & MODULE
============================================================ */

type BlockResult = { [moduleName: string]: string[] };
let cachedBlockMap: BlockResult | null = null;

function buildBlockIndex(tree: FolderContent): BlockResult {
    const map: BlockResult = {};

    function walk(dir: FolderContent, relPath: string) {
        for (const name in dir) {
            const value = dir[name];
            const nextPath = path.posix.join(relPath, name);

            if (Buffer.isBuffer(value)) {
                if (name.toLowerCase().endsWith(".xml")) {
                    const parts = nextPath.split("/");
                    if (parts[0] === "modules" && parts.length >= 3) {
                        const moduleName = parts[1];
                        const blockName = name.slice(0, -4);

                        map[moduleName] ??= [];
                        map[moduleName].push(blockName);
                    }
                }
            } else {
                walk(value, nextPath);
            }
        }
    }

    const modules = tree["modules"];
    if (!modules || Buffer.isBuffer(modules)) {
        throw new Error("The modules directory is missing from the application structure.");
    }

    walk(modules, "modules");
    return map;
}

export async function blocksList(): Promise<BlockResult> {
    if (cachedBlockMap) return cachedBlockMap;

    const tree = await unpackedFolder();
    cachedBlockMap = buildBlockIndex(tree);
    return cachedBlockMap;
}

export async function getBlockDef(
    moduleName: string,
    blockName: string
): Promise<ActionBlockDef | ReturnBlockDef | EventBlockDef> {
    const text = await getFileContent(
        path.posix.join("modules", moduleName, `${blockName}.xml`)
    );

    if (!text) {
        throw new Error(`Block definition: "${blockName}" not found in module: "${moduleName}".`);
    }

    return parseBlockDef(text, blockName);
}

export async function blockFromModule(
    blockName: string,
    flags: ActionAndReturnBlockFlagsUser | EventBlockFlagsUser | undefined
): Promise<string> {
    if (flags?.module) return flags.module;

    const map = await blocksList();
    const matches = Object.keys(map).filter(m => map[m].includes(blockName));

    if (matches.length === 0) {
        throw new Error(`Module containing block: "${blockName}" not found.`);
    }

    if (matches.length > 1) {
        throw new Error(
            `Block "${blockName}" occurs in multiple modules: ${matches.join(", ")}. ` +
            `Provide flags: module="MODULE_NAME".`
        );
    }

    return matches[0];
}

export async function listAllModules(): Promise<string[]> {
    const tree = await unpackedFolder();
    const modules = tree["modules"];

    if (!modules || Buffer.isBuffer(modules)) {
        throw new Error("The 'modules' directory is missing.");
    }

    return Object.keys(modules).filter(
        k => typeof modules[k] === "object" && !Buffer.isBuffer(modules[k])
    );
}

/* ============================================================
   FS UTILITIES
============================================================ */

export async function dirOrFileExists(p: string): Promise<boolean> {
    try {
        await fs.promises.access(p, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export async function createDir(p: string, mode = 0o755) {
    await fs.promises.mkdir(p, { recursive: true, mode });
}

export async function createFile(
    filePath: string,
    content = "",
    options?: { overwrite?: boolean; mode?: number }
) {
    const { overwrite = true, mode = 0o644 } = options ?? {};

    if (!overwrite && await dirOrFileExists(filePath)) return;

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, { encoding: "utf8", mode });
}

export async function copyFolderContents(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });

    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyFolderContents(s, d);
        } else if (entry.isFile()) {
            await fs.promises.copyFile(s, d);
        }
    }
}

export async function isFolderEmpty(folderPath: string): Promise<boolean> {
    try {
        const files = await fs.promises.readdir(folderPath);
        return files.length === 0;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return true;
        throw err;
    }
}

export async function writeToFile(filePath: string, content: string | Buffer) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content);
}

export async function deleteFile(filePath: string) {
    await fs.promises.rm(filePath, { force: true });
}

/* ============================================================
   CONFIG LOADERS
============================================================ */

export async function loadProjectConfig(): Promise<ProjectConfig> {
    const text = await getFileContent("config.json");
    if (!text) throw new Error("Missing config.json.");
    return ProjectConfigSchema.parse(JSON.parse(text));
}

export async function loadModuleConfig(moduleName: string): Promise<ModuleConfig> {
    const text = await getFileContent(
        path.posix.join("modules", moduleName, "config.json")
    );
    if (!text) {
        throw new Error(`config.json missing in module: "${moduleName}".`);
    }
    return ModuleConfigSchema.parse(JSON.parse(text));
}

export async function loadModuleLangConfig(
    moduleName: string
): Promise<ModuleConfigLang | null> {
    const text = await getFileContent(
        path.posix.join("modules", moduleName, "config.rs.json")
    );
    if (!text) return null;
    return ModuleConfigLangSchema.parse(JSON.parse(text));
}
