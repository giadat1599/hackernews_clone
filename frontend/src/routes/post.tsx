import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  infiniteQueryOptions,
  queryOptions,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";

import { ChevronDownIcon } from "lucide-react";
import { z } from "zod";

import { orderSchema, sortBySchema } from "@/shared/schemas";
import { getComments, getPost } from "@/lib/api";
import { useUpvoteComment, useUpvotePost } from "@/lib/api-hooks";
import { userQueryOptions } from "@/lib/query-options";
import { Card, CardContent } from "@/components/ui/card";
import { CommentCard } from "@/components/comment-card";
import { CommentForm } from "@/components/comment-form";
import { PostCard } from "@/components/post-card";
import { SortBar } from "@/components/sort-bar";

const postSearchSchema = z.object({
  id: fallback(z.number(), 0).default(0),
  sortBy: fallback(sortBySchema, "points").default("points"),
  order: fallback(orderSchema, "desc").default("desc"),
});

const postQueryOptions = (id: number) => {
  return queryOptions({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    staleTime: Infinity,
    retry: false,
    throwOnError: true,
  });
};

const commentInfiniteQueryOptions = ({ id, sortBy, order }: z.infer<typeof postSearchSchema>) => {
  return infiniteQueryOptions({
    queryKey: ["comments", "post", id, sortBy, order],
    queryFn: ({ pageParam }) =>
      getComments(id, pageParam, 10, {
        sortBy,
        order,
      }),
    initialPageParam: 1,
    staleTime: Infinity,
    retry: false,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.pagination.totalPages <= lastPageParam) {
        return undefined;
      }

      return lastPageParam + 1;
    },
  });
};

export const Route = createFileRoute("/post")({
  component: Post,
  validateSearch: zodSearchValidator(postSearchSchema),
  loaderDeps: ({ search }) => ({ ...search }),
  loader: async ({ context, deps: { sortBy, order, id } }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(postQueryOptions(id)),
      context.queryClient.ensureInfiniteQueryData(
        commentInfiniteQueryOptions({
          id,
          order,
          sortBy,
        }),
      ),
    ]);
  },
});

function Post() {
  const { id, sortBy, order } = Route.useSearch();
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const { data: user } = useQuery(userQueryOptions());

  const { data: post } = useSuspenseQuery(postQueryOptions(id));
  const {
    data: commentsData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(
    commentInfiniteQueryOptions({
      id,
      sortBy,
      order,
    }),
  );

  const { mutate: upvotePost } = useUpvotePost();
  const { mutate: upvoteComment } = useUpvoteComment();

  const comments = commentsData.pages.flatMap((page) => page.data);

  return (
    <div className="mx-auto max-w-3xl">
      {post && <PostCard post={post.data} onUpvote={(id) => upvotePost(id.toString())} />}
      <div className="mb-4 mt-8">
        {comments.length > 0 && <h2 className="mb-2 text-lg font-semibold text-foreground">Comments</h2>}
        {user && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <CommentForm id={id} />
            </CardContent>
          </Card>
        )}
        {comments.length > 0 && <SortBar sortBy={sortBy} order={order} />}
        {comments.length > 0 && (
          <Card>
            <CardContent className="p-4">
              {comments.map((comment, index) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  activeReplyId={activeReplyId}
                  setActiveReplyId={setActiveReplyId}
                  toggleUpvote={upvoteComment}
                  isLast={index === comments.length - 1}
                />
              ))}
              {hasNextPage && (
                <div className="mt-2">
                  <button
                    className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => fetchNextPage()}
                    disabled={!hasNextPage}
                  >
                    {isFetchingNextPage ? (
                      <span>Loading...</span>
                    ) : (
                      <>
                        <ChevronDownIcon size={12} />
                        <span>More replies</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
