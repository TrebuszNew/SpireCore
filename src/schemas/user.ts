import { z } from 'zod';
import { OutputResultSchema } from './blocks';

// --- Basic Types ---

export const NumberSchema = z.union([
    z.object({ value: z.string(), type: z.literal("float"), size: z.union([z.literal(32), z.literal(64)]) }),
    z.object({ value: z.string(), type: z.literal("int"), size: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64), z.literal(128)]) }),
    z.object({ value: z.string(), type: z.literal("uint"), size: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64), z.literal(128)]) }),
]);

export const StringSchema = z.object({ value: z.string(), type: z.literal("string") });
export const BoolSchema = z.object({ value: z.string(), type: z.literal("bool") });
export const BlockSchema = z.object({ value: z.string(), type: z.literal("block") });

// --- Flags ---

export const BlockInputFlagsUserSchema = z.object({
    for: z.string()
});

export const EventBlockFlagsUserSchema = z.object({
    module: z.string(),
})
.catchall(z.string())
.superRefine((data, ctx) => {
    for (const key of Object.keys(data)) {
        if (key !== "module" && !key.startsWith("_")) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Field "${key}" is invalid. Dynamic fields must start with the "_" character.`,
                path: [key],
            });
        }
    }
}).strict();

export const ActionAndReturnBlockFlagsUserSchema = z.object({
    module: z.string()
});

// --- Recursive Types ---

// Hierarchy:
// UserCode -> EventBlockUser -> BlockUser -> BlockContentUser -> BlockValueUser -> BlockUser[]

// We define generic ZodType for recursive schemas to help TS inference
export const BlockUserSchema: z.ZodType<any> = z.lazy(() =>
    z.intersection(
        z.record(z.string(), BlockContentUserSchema),
        z.object({ "#flags": ActionAndReturnBlockFlagsUserSchema.optional() })
    )
);

export const BlockValueUserSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        "#text": z.union([
            StringSchema,
            NumberSchema,
            BoolSchema,
            z.array(BlockUserSchema)
        ]),
        "#flags": BlockInputFlagsUserSchema.optional()
    })
);

export const BlockContentUserSchema = z.record(z.string(), BlockValueUserSchema);

export const EventBlockUserSchema = z.intersection(
    z.object({ "#flags": EventBlockFlagsUserSchema.optional() }),
    z.record(z.string(), z.array(BlockUserSchema).optional())
);

export const UserCodeSchema = z.array(EventBlockUserSchema);

export const CodeGeneratedSchema = z.array(
    z.record(
        z.string(),
        z.object({
            code: z.string(),
            outputs: z.record(z.string(), OutputResultSchema),
            flags: EventBlockFlagsUserSchema
        })
    )
);


// --- Exports ---

export type Number = z.infer<typeof NumberSchema>;
export type String = z.infer<typeof StringSchema>;
export type Bool = z.infer<typeof BoolSchema>;
export type Block = z.infer<typeof BlockSchema>;

export type BlockInputFlagsUser = z.infer<typeof BlockInputFlagsUserSchema>;
export type EventBlockFlagsUser = z.infer<typeof EventBlockFlagsUserSchema>;
export type ActionAndReturnBlockFlagsUser = z.infer<typeof ActionAndReturnBlockFlagsUserSchema>;

export type BlockUser = { [name: string]: BlockContentUser } & { "#flags"?: ActionAndReturnBlockFlagsUser | undefined };
export type BlockContentUser = {
    [inputName: string]: BlockValueUser;
};
export type BlockValueUser = {
    "#text": String | Number | Bool | BlockUser[];
    "#flags"?: BlockInputFlagsUser | undefined
};

export type EventBlockUser = { "#flags"?: EventBlockFlagsUser | undefined } & { [eventName: string]: BlockUser[] | undefined };
export type UserCode = EventBlockUser[];

export type CodeGenerated = z.infer<typeof CodeGeneratedSchema>;
export type GeneratedEventEntry = CodeGenerated[number];