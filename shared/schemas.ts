import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(31)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(3).max(255),
});

export const createPostSchema = z
  .object({
    title: z.string().min(3, { message: "Title must be at least 3 characters" }),
    url: z.string().trim().url({ message: "URL must be a valid URL" }).optional().or(z.literal("")),
    content: z.string().optional(),
  })
  .refine((data) => data.url || data.content, {
    message: "Either URL or content must be provided",
    path: ["url", "content"],
  });

export const sortBySchema = z.enum(["points", "recent"]);
export const orderSchema = z.enum(["asc", "desc"]);

export const paginationSchema = z.object({
  limit: z.number({ coerce: true }).optional().default(10),
  page: z.number({ coerce: true }).optional().default(1),
  sortBy: sortBySchema.optional().default("recent"),
  order: orderSchema.optional().default("desc"),
  author: z.string().optional(),
  site: z.string().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(3, { message: "Comment must be at least 3 characters" }),
});
