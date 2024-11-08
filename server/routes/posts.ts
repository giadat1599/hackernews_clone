import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, asc, countDistinct, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/adapter";
import type { Context } from "@/context";
import { userTable } from "@/db/schemas/auth";
import { commentsTable } from "@/db/schemas/comments";
import { postsTable } from "@/db/schemas/posts";
import { commentUpvotesTable, postUpvotesTable } from "@/db/schemas/upvotes";
import { loggedIn } from "@/middlewares/loggedIn";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { createCommentSchema, createPostSchema, paginationSchema } from "@/shared/schemas";
import type { Comment, PaginatedResponse, Post, SuccessResponse } from "@/shared/types";
import { getISOFormatDateQuery } from "@/lib/utils";

export const postRouter = new Hono<Context>()
  .post("/", loggedIn, zValidator("form", createPostSchema), async (c) => {
    const { title, url, content } = c.req.valid("form");
    const user = c.get("user")!;
    const [post] = await db
      .insert(postsTable)
      .values({
        title,
        url,
        content,
        userId: user.id,
      })
      .returning({ id: postsTable.id });

    return c.json<SuccessResponse<{ postId: number }>>(
      {
        success: true,
        message: "Post created",
        data: { postId: post.id },
      },
      201,
    );
  })
  .get("/", zValidator("query", paginationSchema), async (c) => {
    const { limit, page, sortBy, order, author, site } = c.req.valid("query");
    const user = c.get("user");

    const offset = (page - 1) * limit;

    const sortByColumn = sortBy === "points" ? postsTable.points : postsTable.createdAt;
    const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);

    const [count] = await db
      .select({ count: countDistinct(postsTable.id) })
      .from(postsTable)
      .where(
        and(author ? eq(postsTable.userId, author) : undefined, site ? eq(postsTable.url, site) : undefined),
      );

    const postsQuery = db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        content: postsTable.content,
        points: postsTable.points,
        createdAt: getISOFormatDateQuery(postsTable.createdAt),
        commentCount: postsTable.commentCount,
        author: { username: userTable.username, id: userTable.id },
        isUpvoted: user
          ? sql<boolean>`CASE WHEN ${postUpvotesTable.userId} IS NOT NULL THEN true ELSE false END`
          : sql<boolean>`false`,
      })
      .from(postsTable)
      .leftJoin(userTable, eq(postsTable.userId, userTable.id))
      .orderBy(sortOrder)
      .limit(limit)
      .offset(offset)
      .where(
        and(author ? eq(postsTable.userId, author) : undefined, site ? eq(postsTable.url, site) : undefined),
      );

    if (user) {
      postsQuery.leftJoin(
        postUpvotesTable,
        and(eq(postUpvotesTable.postId, postsTable.id), eq(postUpvotesTable.userId, user.id)),
      );
    }

    const posts = await postsQuery;

    return c.json<PaginatedResponse<Post[]>>(
      {
        success: true,
        message: "Posts fetched",
        data: posts as Post[],
        pagination: {
          page,
          totalPages: Math.ceil(count.count / limit) as number,
        },
      },
      200,
    );
  })
  .post("/:id/upvote", loggedIn, zValidator("param", z.object({ id: z.coerce.number() })), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user")!;

    let pointsChange: -1 | 1 = 1;

    const points = await db.transaction(async (tx) => {
      const [existingUpvote] = await tx
        .select()
        .from(postUpvotesTable)
        .where(and(eq(postUpvotesTable.postId, id), eq(postUpvotesTable.userId, user.id)))
        .limit(1);

      pointsChange = existingUpvote ? -1 : 1;

      const [updated] = await tx
        .update(postsTable)
        .set({
          points: sql`${postsTable.points} + ${pointsChange}`,
        })
        .where(eq(postsTable.id, id))
        .returning({ points: postsTable.points });

      if (!updated) {
        throw new HTTPException(404, { message: "Post not found" });
      }

      if (existingUpvote) {
        await tx.delete(postUpvotesTable).where(eq(postUpvotesTable.id, existingUpvote.id));
      } else {
        await tx.insert(postUpvotesTable).values({
          postId: id,
          userId: user.id,
        });
      }

      return updated.points;
    });

    return c.json<SuccessResponse<{ count: number; isUpvoted: boolean }>>(
      {
        success: true,
        message: "Post updated",
        data: {
          count: points,
          isUpvoted: pointsChange > 0,
        },
      },
      200,
    );
  })
  .post(
    "/:id/comment",
    loggedIn,
    zValidator("param", z.object({ id: z.coerce.number() })),
    zValidator("form", createCommentSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { content } = c.req.valid("form");
      const user = c.get("user")!;

      const [comment] = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(postsTable)
          .set({
            commentCount: sql`${postsTable.commentCount} + 1`,
          })
          .where(eq(postsTable.id, id))
          .returning({ commentCount: postsTable.commentCount });

        if (!updated) {
          throw new HTTPException(404, { message: "Post not found" });
        }

        return await tx
          .insert(commentsTable)
          .values({
            content,
            userId: user.id,
            postId: id,
          })
          .returning({
            id: commentsTable.id,
            userId: commentsTable.userId,
            postId: commentsTable.postId,
            content: commentsTable.content,
            points: commentsTable.points,
            depth: commentsTable.depth,
            parentCommentId: commentsTable.parentCommentId,
            createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
            commentCount: commentsTable.commentCount,
          });
      });

      return c.json<SuccessResponse<Comment>>({
        success: true,
        message: "Comment created",
        data: {
          ...comment,
          commentUpvotes: [],
          childComments: [],
          author: {
            id: user.id,
            username: user.username,
          },
        } as Comment,
      });
    },
  )
  .get(
    "/:id/comments",
    zValidator("param", z.object({ id: z.coerce.number() })),
    zValidator(
      "query",
      paginationSchema.extend({
        includeChildren: z.coerce.boolean().optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const { includeChildren, limit, page, sortBy, order } = c.req.valid("query");
      const offset = (page - 1) * limit;

      const [postExists] = await db
        .select({ exists: sql`1` })
        .from(postsTable)
        .where(eq(postsTable.id, id))
        .limit(1);

      if (!postExists) {
        throw new HTTPException(404, { message: "Post not found" });
      }

      const sortByColumn = sortBy === "points" ? commentsTable.points : commentsTable.createdAt;
      const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);
      const [count] = await db
        .select({ count: countDistinct(commentsTable.id) })
        .from(commentsTable)
        .where(and(eq(commentsTable.postId, id), isNull(commentsTable.parentCommentId)));

      const comments = await db.query.comments.findMany({
        where: and(eq(commentsTable.postId, id), isNull(commentsTable.parentCommentId)),
        orderBy: sortOrder,
        limit,
        offset,
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
          commentUpvotes: {
            columns: {
              userId: true,
            },
            where: eq(commentUpvotesTable.userId, user?.id ?? ""),
            limit: 1,
          },
          childComments: {
            limit: includeChildren ? 2 : 0,
            with: {
              author: {
                columns: {
                  id: true,
                  username: true,
                },
              },
              commentUpvotes: {
                columns: {
                  userId: true,
                },
                where: eq(commentUpvotesTable.userId, user?.id ?? ""),
                limit: 1,
              },
            },
            orderBy: sortOrder,
            extras: {
              createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
            },
          },
        },
        extras: {
          createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
        },
      });

      return c.json<PaginatedResponse<Comment[]>>(
        {
          success: true,
          message: "Comments fetched",
          data: comments as Comment[],
          pagination: {
            page,
            totalPages: Math.ceil(count.count / limit) as number,
          },
        },
        200,
      );
    },
  )
  .get("/:id", zValidator("param", z.object({ id: z.coerce.number() })), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    const postQuery = db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        points: postsTable.points,
        createdAt: getISOFormatDateQuery(postsTable.createdAt),
        commentCount: postsTable.commentCount,
        author: { username: userTable.username, id: userTable.id },
        isUpvoted: user
          ? sql<boolean>`CASE WHEN ${postUpvotesTable.userId} IS NOT NULL THEN true ELSE false END`
          : sql<boolean>`false`,
      })
      .from(postsTable)
      .leftJoin(userTable, eq(postsTable.userId, userTable.id))
      .where(eq(postsTable.id, id));

    if (user) {
      postQuery.leftJoin(
        postUpvotesTable,
        and(eq(postUpvotesTable.postId, postsTable.id), eq(postUpvotesTable.userId, user.id)),
      );
    }

    const [post] = await postQuery;
    if (!post) {
      throw new HTTPException(404, { message: "Post not found" });
    }

    return c.json<SuccessResponse<Post>>(
      {
        success: true,
        message: "Post fetched",
        data: post as Post,
      },
      200,
    );
  });
