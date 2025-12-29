import { ModuleConfig, SectionKey, SectionKeys, WindowSectionKeys } from "../schemas/config";

export function validateModuleSectionAccess(moduleName: string, moduleConfig: ModuleConfig, section: SectionKey, code: string) {
    if (!SectionKeys.includes(section)) {
        throw new Error(`Module "${moduleName}" tried to use an unknown section: "${section}". Valid sections are: ${SectionKeys.join(", ")}`);
    }

    const requiredTypes: Partial<Record<SectionKey, string>> = {
        stateRender: "rendering",
        eventRender: "rendering",
        stateApp: "windowing",
        eventOS: "windowing",
        eventLoop: "windowing",
    };

    const requiredType = requiredTypes[section];

    if (requiredType && moduleConfig.moduleType !== requiredType) {
        throw new Error(
            `Module "${moduleName}" of type "${moduleConfig.moduleType}" is not allowed to use section "${section}". Only "${requiredType}" modules can.`
        );
    }


    for (const key of WindowSectionKeys) {
        if (code.includes(`\${${key}}`) && moduleConfig.moduleType !== "rendering") {
            throw new Error(`Module "${moduleName}" of type "${moduleConfig.moduleType}" is not allowed to use WindowSectionKey "\${${key}}". Only "rendering" modules can.`);
        }
    }
}

export function validateWindowSectionUsage(moduleName: string, moduleConfig: ModuleConfig) {
    if (moduleConfig.moduleType !== "rendering") {
        throw new Error(`Module "${moduleName}" of type "${moduleConfig.moduleType}" is not allowed to use "addToSectionInWindowTargetScope". Only "rendering" modules can.`);
    }
}
