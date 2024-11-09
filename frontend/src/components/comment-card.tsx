import { Dispatch, SetStateAction, useState } from "react";
import { useQuery, useQueryClient, useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { ChevronDownIcon, ChevronUpIcon, MessageSquareIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Comment } from "@/shared/types";
import { getCommentComments } from "@/lib/api";
import { userQueryOptions } from "@/lib/query-options";
import { cn, relativeTime } from "@/lib/utils";

interface CommentCardProps {
  comment: Comment;
  depth: number;
  activeReplyId: number | null;
  setActiveReplyId: Dispatch<SetStateAction<number | null>>;
  isLast: boolean;
  toggleUpvote: () => void;
}

export function CommentCard({
  comment,
  depth,
  activeReplyId,
  setActiveReplyId,
  toggleUpvote,
  isLast,
}: CommentCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const queryClient = useQueryClient();
  const { data: user } = useQuery(userQueryOptions());
  const {
    data: commentsData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery({
    queryKey: ["comments", "comment", comment.id],
    queryFn: ({ pageParam }) => getCommentComments(comment.id, pageParam),
    initialPageParam: 1,
    staleTime: Infinity,
    initialData: {
      pageParams: [1],
      pages: [
        {
          success: true,
          message: "Comments fetched",
          data: comment.childComments ?? [],
          pagination: {
            page: 1,
            totalPages: Math.ceil(comment.commentCount / 2),
          },
        },
      ],
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.pagination.totalPages <= lastPageParam) {
        return undefined;
      }
      return lastPageParam + 1;
    },
  });

  const isReplying = activeReplyId === comment.id;
  const isUpvoted = comment.commentUpvotes.length > 0;
  const comments = commentsData.pages.flatMap((page) => page.data);
  const loadFirstPage = comments.length === 0 && comment.commentCount > 0;

  return (
    <div className={cn(depth > 0 && "ml-4  border-l border-border pl-4", !isLast && "border-b")}>
      <div className="py-2">
        <div className="mb-2 flex items-center space-x-1 text-xs">
          <button
            disabled={!user}
            className={cn(
              "flex items-center space-x-1 hover:text-primary",
              isUpvoted ? "text-primary" : "text-muted-foreground",
            )}
          >
            <ChevronUpIcon size={14} />
            <span className="font-medium">{comment.points}</span>
          </button>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{comment.author.username}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{relativeTime(comment.createdAt)}</span>
          <span className="text-muted-foreground">·</span>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setIsCollapsed((prev) => !prev)}
          >
            {isCollapsed ? <PlusIcon size={14} /> : <MinusIcon size={14} />}
          </button>
        </div>
        {!isCollapsed && (
          <>
            <p className="mb-2 text-sm text-foreground">{comment.content}</p>

            {user && (
              <button
                className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setActiveReplyId(isReplying ? null : comment.id)}
              >
                <MessageSquareIcon size={12} />
                <span>reply</span>
              </button>
            )}
            {isReplying && <div className="mt-2">COMMENT FORM</div>}
          </>
        )}
      </div>
      {!isCollapsed &&
        comments.length > 0 &&
        comments.map((reply, index) => {
          const isLastPage = index === comments.length - 1;
          return (
            <CommentCard
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
              isLast={isLastPage && index === comments.length - 1}
              toggleUpvote={toggleUpvote}
            />
          );
        })}
      {!isCollapsed && (hasNextPage || loadFirstPage) && (
        <div className="mt-2">
          <button
            className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (loadFirstPage) {
                queryClient.invalidateQueries({ queryKey: ["comments", "comment", comment.id] });
              } else {
                fetchNextPage();
              }
            }}
            disabled={!(hasNextPage || loadFirstPage) || isFetchingNextPage}
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
      <div className="my-2" />
      {/* {false && <Separator className="my-2" />} */}
    </div>
  );
}
