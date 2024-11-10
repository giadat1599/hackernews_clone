import { createFileRoute } from "@tanstack/react-router";
import { infiniteQueryOptions, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { fallback, zodSearchValidator } from "@tanstack/router-zod-adapter";

import { z } from "zod";

import { orderSchema, sortBySchema } from "@/shared/schemas";
import { getPosts } from "@/lib/api";
import { useUpvotePost } from "@/lib/api-hooks";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";
import { SortBar } from "@/components/sort-bar";

const homeSearchSchema = z.object({
  sortBy: fallback(sortBySchema, "points").default("points"),
  order: fallback(orderSchema, "desc").default("desc"),
  author: fallback(z.string(), "").optional(),
  site: fallback(z.string(), "").optional(),
});

const postsInfiniteQueryOptions = ({ sortBy, order, author, site }: z.infer<typeof homeSearchSchema>) => {
  return infiniteQueryOptions({
    queryKey: ["posts", sortBy, order, author, site],
    queryFn: ({ pageParam }) =>
      getPosts({
        pageParam,
        pagination: {
          sortBy,
          order,
          author,
          site,
        },
      }),
    initialPageParam: 1,
    staleTime: Infinity,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (lastPage.pagination.totalPages <= lastPageParam) {
        return undefined;
      }
      return lastPageParam + 1;
    },
  });
};

export const Route = createFileRoute("/")({
  component: HomeComponent,
  validateSearch: zodSearchValidator(homeSearchSchema),
  loaderDeps: ({ search }) => ({ ...search }),
  loader: ({ context, deps: { sortBy, order, author, site } }) => {
    context.queryClient.ensureInfiniteQueryData(
      postsInfiniteQueryOptions({
        sortBy,
        order,
        author,
        site,
      }),
    );
  },
});

function HomeComponent() {
  const { sortBy, order, author, site } = Route.useSearch();
  const { mutate: upvotePost } = useUpvotePost();
  const { data, isFetchingNextPage, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery(
    postsInfiniteQueryOptions({
      sortBy,
      order,
      author,
      site,
    }),
  );

  const posts = data?.pages.flatMap((data) => data.data);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Submissions</h1>
      <SortBar sortBy={sortBy} order={order} />
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onUpvote={(id) => upvotePost(id.toString())} />
        ))}
      </div>
      <div className="mt-6">
        <Button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
          {isFetchingNextPage ? "Loading more..." : hasNextPage ? "Load more" : "Nothing more"}
        </Button>
      </div>
    </div>
  );
}
