import { z } from 'zod';

// --- Basic Types ---
export const POSSIBLE_INPUT_TYPES = ["uint", "int", "float", "bool", "string", "block"] as const;
export const POSSIBLE_OUTPUT_TYPES = ["uint", "int", "float", "bool", "string"] as const;
export const FLOAT_SIZES = [32, 64] as const;
export const INT_SIZES = [8, 16, 32, 64, 128] as const;
export const ExpectedInputTypeSchema = z.enum(POSSIBLE_INPUT_TYPES as unknown as [string, ...string[]]);
export const ExpectedOutputTypeSchema = z.enum(POSSIBLE_OUTPUT_TYPES as unknown as [string, ...string[]]);

export const CodeResultValueTypeSchema = z.object({
    type: z.string(),
    size: z.string().optional(),
}).strict();
export const ResultValueTypeSchema = z.union([
    z.object({ type: z.literal("float"), size: z.union([z.literal(32), z.literal(64)]) }),
    z.object({ type: z.literal("int"), size: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64), z.literal(128)]) }),
    z.object({ type: z.literal("uint"), size: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64), z.literal(128)]) }),
    z.object({ type: z.literal("string") }),
    z.object({ type: z.literal("bool") }),
]);

export const OutputResultSchema = z.union([
    ResultValueTypeSchema,
    z.record(z.string(), ResultValueTypeSchema)
]);

// --- Section Parameters ---

export const InputSectionParametersSchema = z.object({
    type: z.array(ExpectedInputTypeSchema),
    required: z.boolean().default(true),
    default: z.union([z.string(), z.boolean(), z.number()]).optional(),
    canYouPutBlockIn: z.boolean().default(true),
    valueList: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
    blockDoc: z.string().optional(),
    multiple: z.boolean().default(false),
    multipleMax: z.number().optional(),
}).strict();

export const OutputsSectionParametersSchema = z.union([
    z.object({
        type: z.literal("float"),
        size: z.union([z.literal(32), z.literal(64)]),
        blockDoc: z.string().optional(),
        multiple: z.boolean().default(false),
        multipleMax: z.number().optional(),
    }).strict(),
    z.object({
        type: z.union([z.literal("int"), z.literal("uint")]),
        size: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64), z.literal(128)]),
        blockDoc: z.string().optional(),
        multiple: z.boolean().default(false),
        multipleMax: z.number().optional(),
    }).strict(),
    z.object({
        type: z.union([z.literal("bool"), z.literal("string")]),
        size: z.never().optional(),
        blockDoc: z.string().optional(),
        multiple: z.boolean().default(false),
        multipleMax: z.number().optional(),
    }).strict(),
    z.object({
        type: z.undefined(),
        size: z.undefined(),
        blockDoc: z.string().optional(),
        multiple: z.boolean().default(false),
        multipleMax: z.number().optional(),
    })
]);

export const HandleSectionParametersSchema = z.object({
    suffix: z.string().optional(),
}).strict();

// --- Block Definitions ---

export const ActionBlockDefSchema = z.object({
    inputs: z.record(z.string(), InputSectionParametersSchema),
    code: z.string(),
}).strict();

export const ReturnBlockDefSchema = z.object({
    inputs: z.record(z.string(), InputSectionParametersSchema),
    return: z.union([ResultValueTypeSchema, CodeResultValueTypeSchema]),
    code: z.string(),
}).strict();

export const EventBlockDefSchema = z.object({
    outputs: z.record(z.string(), OutputsSectionParametersSchema),
    resultType: z.record(z.string(), CodeResultValueTypeSchema).optional(),
    handle: HandleSectionParametersSchema.optional(),
}).strict();

export const blockDefSchema = z.union([
    ActionBlockDefSchema,
    ReturnBlockDefSchema,
    EventBlockDefSchema
]);

// --- Exports ---

export type ExpectedInputType = z.infer<typeof ExpectedInputTypeSchema>;
export type ExpectedOutputType = z.infer<typeof ExpectedOutputTypeSchema>;
export type codeResultValueType = z.infer<typeof CodeResultValueTypeSchema>;
export type ResultValueType = z.infer<typeof ResultValueTypeSchema>;
export type OutputResult = z.infer<typeof OutputResultSchema>;
export type InputSectionParameters = z.infer<typeof InputSectionParametersSchema>;
export type OutputsSectionParameters = z.infer<typeof OutputsSectionParametersSchema>;
export type HandleSectionParameters = z.infer<typeof HandleSectionParametersSchema>;
export type ActionBlockDef = z.infer<typeof ActionBlockDefSchema>;
export type ReturnBlockDef = z.infer<typeof ReturnBlockDefSchema>;
export type EventBlockDef = z.infer<typeof EventBlockDefSchema>;
export type blockDef = z.infer<typeof blockDefSchema>;