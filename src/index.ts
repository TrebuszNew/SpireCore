import { configuration } from './services/configuration/configuration'
import { conversion } from './services/conversion/conversion'
import { projectCreation } from './services/projectCreation/projectCreation';

async function run() {
    await configuration();
    const code = await conversion();
    await projectCreation(code);
};

run();