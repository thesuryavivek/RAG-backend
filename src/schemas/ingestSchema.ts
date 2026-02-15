import * as z from "zod";

export const ingestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("note"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("url"),
    url: z.url(),
  }),
]);

export type ingestDatatype = z.infer<typeof ingestSchema>;
