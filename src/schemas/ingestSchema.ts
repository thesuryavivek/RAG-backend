import * as z from "zod";

export const ingestSchema = z.discriminatedUnion("type", [
  z.object({
    title: z.string(),
    type: z.literal("note"),
    text: z.string().min(1),
  }),
  z.object({
    title: z.string(),
    type: z.literal("url"),
    url: z.url(),
  }),
]);

export type ingestDatatype = z.infer<typeof ingestSchema>;
