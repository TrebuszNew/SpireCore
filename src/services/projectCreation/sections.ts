import { SectionKeys, SectionKey, SectionsType } from '../../schemas/config';

export const sections: SectionsType = {
    global: "", preUser: "", eventLoop: "",
    eventOS: "", stateApp: "", eventRender: "", stateRender: ""
};

export function addToSectionInTargetScope(section: SectionKey, data: string) {
    if (!SectionKeys.includes(section)) {
        console.warn(`Incorrect usage of function addToSectionInTargetScope. The provided section parameter is:\nsection: "${section}".`)
        return
    }
    if (typeof data !== "string") {
        console.warn(`Incorrect usage of function addToSectionInTargetScope. The provided data parameter is:\ndata: "${section}".`);
        return
    }

    sections[section] += `\n${data}\n`;
}
