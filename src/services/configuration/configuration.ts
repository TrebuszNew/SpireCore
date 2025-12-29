import { validateBlocksDef } from './validateBlocks';
import { validateModulesConf } from './validateModulesConf';
import { validateProjectConf } from './validateProjectConf';
import { logger } from '../../utils/utils'
import { spawn } from "child_process";
import { allowedPlatforms, allowedArchs, allowedLangs, targetLang, targetArch, targetPlatform, devMode } from '../../schemas/config';
import { convertedPath, copyFolderContents, createDir, dirOrFileExists, isFolderEmpty, loadProjectConfig, projectPath, unpackedPath } from '../../utils/fs';
import path from 'path'

export async function configuration() {
	logger.log("#################### CONFIGURATION ####################")
	if (!(allowedLangs as readonly string[]).includes(targetLang)) {
		throw new Error(`Unsupported language: ${targetLang}. Allowed languages: ${allowedLangs.join(", ")}.`);
	}
	if (!(allowedPlatforms as readonly string[]).includes(targetPlatform)) {
		throw new Error(`Unsupported platform: ${targetPlatform}. Allowed platforms: ${allowedPlatforms.join(", ")}.`);
	}
	if (!(allowedArchs as readonly string[]).includes(targetArch)) {
		throw new Error(`Unsupported architecture: ${targetArch}. Allowed architectures: ${allowedArchs.join(", ")}.`);
	}

	if (targetPlatform !== "default" && targetArch === "default") {
		throw new Error(`Unspecified architecture for platform "${targetPlatform}". Please set ARCH environment variable.`);
	}
	if (targetPlatform === "default" && targetArch !== "default") {
		throw new Error("Cannot specify architecture when target platform is 'default'.");
	}

	if (!(await hasCargo())) {
		throw new Error("Cargo not found (Rust is not installed or not in PATH).");
	}
	
	const dirsToEnsure = [projectPath, unpackedPath, convertedPath];
	for (const dir of dirsToEnsure) {
		if (!await dirOrFileExists(dir)) {
			await createDir(dir);
		}
	}
	if (await isFolderEmpty(unpackedPath)) {
		await copyFolderContents(path.resolve(__dirname, "../../../helloWorldProgram"), unpackedPath);
	}

	const subDirs = ["modules", "data"];
	for (const sub of subDirs) {
		const fullPath = path.join(unpackedPath, sub);
		if (!await dirOrFileExists(fullPath)) {
			await createDir(fullPath);
		}
	}
	await copyFolderContents(path.resolve(__dirname, "../../../defaultModule"), path.join(unpackedPath, "modules", "target"));

	
	const projectConfig = await loadProjectConfig();
	const userProjectPath = path.join(convertedPath, projectConfig.name);
	await createDir(userProjectPath);

	// If devMode is enabled, we log everything one by one; otherwise, we can do it all at once.
	if (devMode) {
		await validateBlocksDef();
		await validateModulesConf();
		await validateProjectConf();
	} else {
		await Promise.all([
			validateBlocksDef(),
			validateModulesConf(),
			validateProjectConf()
		]);
	}
}

function hasCargo(): Promise<boolean> {
	return new Promise(resolve => {
		const child = spawn("cargo", ["--version"], {
			stdio: "ignore",
			shell: process.platform === "win32",
		});

		child.on("error", () => resolve(false));
		child.on("close", code => resolve(code === 0));
	});
}