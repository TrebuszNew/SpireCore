import { z } from 'zod';

export const programVersion = "0.0.1" as const;

// --- Base Enums ---

export const allowedPlatforms = ["default", "windows", "linux", "web"] as const;
export const allowedArchs = ["default", "x86", "x64", "arm", "arm64"] as const;
export const allowedLangs = ["rust"] as const;

export const PlatformSchema = z.enum(allowedPlatforms as unknown as [string, ...string[]]);
export const ArchitectureSchema = z.enum(allowedArchs as unknown as [string, ...string[]]);
export const LanguageSchema = z.enum(allowedLangs as unknown as [string, ...string[]]);

const EnvSchema = z.object({
    PLATFORM: PlatformSchema.default("default"),
    ARCH: ArchitectureSchema.default("default"),
    TARGET_LANG: LanguageSchema.default("rust"),
    DEBUG_MODE: z.enum(["true", "false"]).default("false"),
    RUN_MODE: z.enum(["true", "false"]).default("true"),
});
const env = EnvSchema.parse(process.env);
export const targetPlatform = env.PLATFORM;
export const targetArch = env.ARCH;
export const targetLang = env.TARGET_LANG;
export const devMode = env.DEBUG_MODE;
export const runInTheEnd = env.RUN_MODE;

// --- Shared Types ---

export const TextOrFileSchema = z.union([
    z.object({ text: z.string() }),
    z.object({ file: z.string() }),
]);

export const CDataChunkSchema = z.array(z.object({ "#text": z.string() }));

// --- Libraries ---

export const LibraryScopeSchema = z.enum(["local", "target"]);

export const LibraryInfoSchema = z.object({
    version: z.string().optional(),
    git: z.string().optional(),
    scope: z.union([LibraryScopeSchema, z.array(LibraryScopeSchema)]),
    features: z.array(z.string()).optional(),
    optional: z.boolean().optional(),
    default_features: z.boolean().optional(),
}).refine(data => data.version || data.git, {
    message: "Library must have at least one of version or git",
});

// --- Configs ---

// Project Config
export const ProjectConfigSchema = z.object({
    name: z.string(),
    version: z.string(),
    engineVersion: z.string(),
    description: z.string().optional(),
    authors: z.array(z.string()).optional(),
    license: z.string().optional(),
    repository: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    readme: z.string().optional(),
    homepage: z.url().optional(),
    documentation: z.url().optional(),
    entryPoints: z.array(z.string()),
    targetPlatforms: z.array(PlatformSchema),
    targetLanguages: z.array(LanguageSchema),
    // programResources: ProjectResourcesSchema
});

// Module Config
export const ModuleConfigSchema = z.object({
    version: z.string(),
    engineVersion: z.string(),
    description: z.string().optional(),
    authors: z.array(z.string()).optional(),
    license: z.string().optional(),
    repository: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    readme: z.string().optional(),
    homepage: z.url().optional(),
    documentation: z.url().optional(),
    supportedPlatforms: z.array(PlatformSchema),
    supportedLanguages: z.array(LanguageSchema),
    // dependencies: z.record(z.string(), z.string()).nullable().optional(),
    // devDependencies: z.record(z.string(), z.string()).nullable().optional(),
    //categories: TODO
    moduleType: z.enum(["windowing", "rendering", "compilation", "default"]).default("default"),
});

// Sections
export const SectionKeys = ["preUser", "global", "eventLoop", "eventOS", "stateApp", "eventRender", "stateRender"] as const;
const SectionKeysSchema = z.enum(SectionKeys);

export const WindowSectionKeys = ["createWindow", "redrawRequested", "resized"] as const;
const WindowSectionKeysSchema = z.enum(WindowSectionKeys);

export const SectionsTypeSchema = z.object({
    preUser: z.string().optional(),
    global: z.string().optional(),
    eventLoop: z.string().optional(),
    eventOS: z.string().optional(),
    stateApp: z.string().optional(),
    eventRender: z.string().optional(),
    stateRender: z.string().optional(),
});
export const WindowSectionsTypeSchema = z.record(WindowSectionKeysSchema, z.string().optional());

export const ModuleConfigLangSchema = z.object({
    addFileToLocalScope: z.record(z.string(), TextOrFileSchema).optional(),
    addToSectionInTargetScope: z.record(SectionKeysSchema, TextOrFileSchema.optional()).optional(),
    addToSectionInWindowTargetScope: z.record(WindowSectionKeysSchema, TextOrFileSchema).optional(),
    libraries: z.record(z.string(), LibraryInfoSchema).optional(),
    Preprocessors: z.array(z.string()).optional(),
}).strict();


// --- Type Exports ---

export type Platform = z.infer<typeof PlatformSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type TextOrFile = z.infer<typeof TextOrFileSchema>;
export type CDataChunk = z.infer<typeof CDataChunkSchema>;
export type LibraryScope = z.infer<typeof LibraryScopeSchema>;
export type LibraryInfo = z.infer<typeof LibraryInfoSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
export type ModuleConfigLang = z.infer<typeof ModuleConfigLangSchema>;

export type SectionsType = z.infer<typeof SectionsTypeSchema>;
export type SectionKey = keyof SectionsType;
export type WindowSectionsType = z.infer<typeof WindowSectionsTypeSchema>;
export type WindowSectionKey = keyof WindowSectionsType;