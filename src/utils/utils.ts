import { devMode } from "../schemas/config";
import {
    ExpectedInputType,
    ResultValueType
} from "../schemas/blocks";

import { exec } from "child_process";
import { promisify } from "util";

/* ============================================================
   LOGGING
============================================================ */

class DevLogger {
    private _warnings: string[] = [];

    log(...args: unknown[]) {
        if (devMode) console.log(...args);
    }

    warn(...args: unknown[]) {
        if (devMode) console.warn("⚠", ...args);
        this._warnings.push(args.map(String).join(" "));
    }

    get warnings(): readonly string[] {
        return this._warnings;
    }

    clear() {
        this._warnings.length = 0;
    }
}

export const logger = new DevLogger();

/* ============================================================
   TYPE UTILITIES
============================================================ */

export function isValidType(
    expected: ExpectedInputType | ExpectedInputType[],
    actual: ResultValueType
): boolean {
    return Array.isArray(expected)
        ? expected.includes(actual.type)
        : expected === actual.type;
}

export function isResultValueType(value: unknown): value is ResultValueType {
    if (!value || typeof value !== "object") return false;

    const v = value as { type?: unknown; size?: unknown };

    if (v.type === "string" || v.type === "bool") return true;

    if (v.type === "float") {
        return v.size === 32 || v.size === 64;
    }

    if (v.type === "int" || v.type === "uint") {
        return (
            v.size === 8 ||
            v.size === 16 ||
            v.size === 32 ||
            v.size === 64 ||
            v.size === 128
        );
    }

    return false;
}

/* ============================================================
   OUTPUT VALIDATION
============================================================ */

const FLOAT_SIZES = new Set([32, 64]);
const INT_SIZES = new Set([8, 16, 32, 64, 128]);

export function getValidatedOutput(
    def: { type: string; size?: 8 | 16 | 32 | 64 | 128 }
): ResultValueType | undefined {
    const { type, size } = def;

    if (type === "string" || type === "bool") {
        return { type };
    }

    if (type === "float" && size && FLOAT_SIZES.has(size)) {
        return { type: "float", size: size as 32 | 64 };
    }

    if ((type === "int" || type === "uint") && size && INT_SIZES.has(size)) {
        return { type, size };
    }

    return undefined;
}

/* ============================================================
   STRING UTILITIES
============================================================ */

export function stripQuotes(value: unknown): string {
    if (typeof value !== "string") {
        throw new Error(`Expected string, got ${typeof value}`);
    }

    const first = value[0];
    const last = value[value.length - 1];

    if (
        (first === "'" || first === '"' || first === "`") &&
        first === last
    ) {
        return value.slice(1, -1);
    }

    return value;
}

/* ============================================================
   PROCESS UTILITIES
============================================================ */

const execAsync = promisify(exec);

export async function runCmd(command: string, cwd: string) {
    return execAsync(command, { cwd });
}
