import * as z from "zod";

export const querySchema = z.object({
  question: z.string().min(1),
});
export type queryDatatype = z.infer<typeof querySchema>;
