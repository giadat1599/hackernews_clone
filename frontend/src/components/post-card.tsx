import { Link } from "@tanstack/react-router";

import { ChevronUpIcon } from "lucide-react";

import { Post } from "@/shared/types";
import { cn, relativeTime } from "@/lib/utils";

import { badgeVariants } from "./ui/badge";
import { Card, CardContent, CardTitle } from "./ui/card";

interface PostCardProps {
  post: Post;
  onUpvote?: (id: number) => void;
}

export function PostCard({ post, onUpvote }: PostCardProps) {
  return (
    <Card className="flex items-start justify-start pt-3">
      <button
        className={cn(
          "ml-3 flex flex-col items-center justify-center text-muted-foreground hover:text-primary",
          post.isUpvoted && "text-primary",
        )}
        onClick={() => onUpvote?.(post.id)}
      >
        <ChevronUpIcon size={20} />
        <span className="text-xs font-medium">{post.points}</span>
      </button>
      <div className="flex grow flex-col justify-between">
        <div className="flex items-start p-3 py-0">
          <div className="flex grow flex-wrap items-center gap-x-2 pb-1">
            <CardTitle className="text-xl font-medium">
              {post.url ? (
                <a href={post.url} className="text-foreground hover:text-primary hover:underline">
                  {post.title}
                </a>
              ) : (
                <Link to={"/"} className="text-foreground hover:text-primary hover:underline">
                  {post.title}
                </Link>
              )}
            </CardTitle>
            {post.url && (
              <Link
                to="/"
                search={{ site: post.url }}
                className={cn(
                  badgeVariants({ variant: "secondary" }),
                  "cursor-pointer text-xs font-normal transition-colors hover:bg-primary/80 hover:underline",
                )}
              >
                {new URL(post.url).hostname}
              </Link>
            )}
          </div>
        </div>
        <CardContent className="p-3 pt-0">
          {post.content && <p className="mb-2 text-sm text-foreground">{post.content}</p>}
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <span>
              by{" "}
              <Link to="/" search={{ author: post.author.id }} className="hover:underline">
                {post.author.username}
              </Link>
            </span>
            <span>·</span>
            <span>{relativeTime(post.createdAt)}</span>
            <span>·</span>
            <Link to="/" className="hover:underline">
              {post.commentCount} comments
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
