
import { blockDef, FLOAT_SIZES, INT_SIZES } from "../../schemas/blocks";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { z } from "zod";


// --- validateBlocks ---
export type BlocksKind = "action" | "return" | "event";
export function resolveBlockKind(blockDef: blockDef): BlocksKind {
    const sections = Object.keys(blockDef);

    if (sections.includes("return")) {
        return "return"
    }
    if (sections.includes("code")) {
        return "action"
    }
    if (sections.includes("outputs")) {
        return "event"
    }
    throw new Error("It is impossible to determine what type of block this is.")
}

export function checkIfReturns(what: string, typeORsize: "type" | "size", blockName: string) {
    let ast: acorn.Node;
    try {
        const wrappedCode = `(function(){ ${what} })()`;
        ast = acorn.parse(wrappedCode, { ecmaVersion: "latest" });
    } catch {
        throw new Error(
            `The "return" section (${typeORsize}) in block: "${blockName}", contains invalid JS code.`
        );
    }

    let hasReturn = false;

    walk.simple(ast, {
        ReturnStatement(node: any) {
            hasReturn = true;
        }
    });

    if (!hasReturn) {
        throw new Error(`The "return" section (${typeORsize}) in block "${blockName}" does not return any value (missing return).`);
    }
}

export function validateNumericTypeSize(
    type: string | undefined,
    size: number | undefined,
    contextInfo: string
) {
    if (!type) return;

    if (["uint", "int"].includes(type)) {
        if (!size) {
            throw new Error(
                `${contextInfo}, Size parameter is missing, although type is set to: "${type}". ` +
                `The size parameter must be set to one of these values: [${INT_SIZES.join(", ")}]`
            );
        }
        if (!INT_SIZES.includes(size as 8 | 16 | 32 | 64 | 128)) {
            throw new Error(
                `${contextInfo}, Incorrectly set size parameter: "${size}". ` +
                `The size parameter must be set to one of these values: [${INT_SIZES.join(", ")}], Because the type parameter is set to: "${type}"`
            );
        }
    }

    if (type === "float") {
        if (!size) {
            throw new Error(
                `${contextInfo}, Size parameter is missing, although type is set to: "${type}". ` +
                `The size parameter must be set to one of these values: [${FLOAT_SIZES.join(", ")}]`
            );
        }
        if (!FLOAT_SIZES.includes(size as 32 | 64)) {
            throw new Error(
                `${contextInfo}, Incorrectly set size parameter: "${size}". ` +
                `The size parameter must be set to one of these values: [${FLOAT_SIZES.join(", ")}], Because the type parameter is set to: "${type}"`
            );
        }
    }
}
export function formatZodError(issues: z.ZodIssue[]): string {
    return issues.map((err) => {
        const path = err.path.join(".");
        switch (err.code) {
            case "invalid_type": {
                const e = err as unknown as { expected: string; received: string };
                return `Field "${path}": expected ${e.expected}, received ${e.received}.`;
            }

            case "invalid_value": {
                const e = err as { options?: string[] };
                if (Array.isArray(e.options)) {
                    return `Field "${path}": Invalid value. Expected one of: ${e.options.join(", ")}.`;
                }
                return `Field "${path}": Invalid value.`;
            }

            case "too_small": {
                const e = err as unknown as { minimum: number };
                return `Field "${path}": Too short/small. Minimum: ${e.minimum}.`;
            }

            default:
                return `Field "${path}": ${err.message}`;
        }
    }).join("\n");
}
