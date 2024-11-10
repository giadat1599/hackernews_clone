import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { current, produce } from "immer";
import { toast } from "sonner";

import { Comment, PaginatedResponse, Post, SuccessResponse } from "@/shared/types";

import { GetPostsSuccess, postComment, upvoteComment, upvotePost } from "./api";

const updatePostUpvote = (draft: Post) => {
  draft.points += draft.isUpvoted ? -1 : +1;
  draft.isUpvoted = !draft.isUpvoted;
};

export const useUpvotePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upvotePost,
    onMutate: async (variable) => {
      let prevPosts;
      let prevPost;
      await queryClient.cancelQueries({ queryKey: ["post", Number(variable)] });

      queryClient.setQueryData<SuccessResponse<Post>>(
        ["post", Number(variable)],
        produce((draft) => {
          prevPost = current(draft);
          if (!draft) {
            return undefined;
          }
          updatePostUpvote(draft.data);
        }),
      );
      queryClient.setQueriesData<InfiniteData<GetPostsSuccess>>(
        { queryKey: ["posts"], type: "active" },
        produce((oldData) => {
          prevPosts = current(oldData);
          if (!oldData) {
            return undefined;
          }
          oldData.pages.forEach((page) => {
            page.data.forEach((post) => {
              if (post.id.toString() === variable) {
                updatePostUpvote(post);
              }
            });
          });
        }),
      );

      return {
        prevPosts,
        prevPost,
      };
    },
    onSuccess: (upvoteData, variable) => {
      queryClient.setQueryData<SuccessResponse<Post>>(
        ["post", Number(variable)],
        produce((draft) => {
          if (!draft) {
            return undefined;
          }
          draft.data.points = upvoteData.data.count;
          draft.data.isUpvoted = upvoteData.data.isUpvoted;
        }),
      );

      queryClient.setQueriesData<InfiniteData<GetPostsSuccess>>(
        { queryKey: ["posts"], type: "active" },
        produce((oldData) => {
          if (!oldData) {
            return undefined;
          }
          oldData.pages.forEach((page) => {
            page.data.forEach((post) => {
              if (post.id.toString() === variable) {
                post.points = upvoteData.data.count;
                post.isUpvoted = upvoteData.data.isUpvoted;
              }
            });
          });
        }),
      );
      queryClient.invalidateQueries({
        queryKey: ["posts"],
        type: "inactive",
        refetchType: "none",
      });
    },
    onError: (err, variable, context) => {
      console.error(err);

      toast.error("Failed to upvote post");
      if (context?.prevPosts) {
        queryClient.setQueriesData({ queryKey: ["posts"], type: "active" }, context.prevPosts);
      }
      if (context?.prevPost) {
        queryClient.setQueryData(["post", Number(variable)], context.prevPost);
      }
      queryClient.invalidateQueries({ queryKey: ["post", Number(variable)] });
      queryClient.invalidateQueries({
        queryKey: ["posts"],
      });
    },
  });
};

export const useUpvoteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number; parentCommentId: number | null; postId: number | null }) => {
      return upvoteComment(data.id);
    },
    onMutate: async ({ id, parentCommentId, postId }) => {
      let prevData;
      const queryKey = parentCommentId
        ? ["comments", "comment", parentCommentId]
        : ["comments", "post", postId];

      await queryClient.cancelQueries({
        queryKey,
      });

      queryClient.setQueriesData<InfiniteData<PaginatedResponse<Comment[]>>>(
        { queryKey },
        produce((oldData) => {
          prevData = current(oldData);
          if (!oldData) {
            return undefined;
          }

          oldData.pages.forEach((page) => {
            page.data.forEach((comment) => {
              if (comment.id === id) {
                const isUpvoted = comment.commentUpvotes.length > 0;
                comment.points += isUpvoted ? -1 : 1;
                comment.commentUpvotes = isUpvoted ? [] : [{ userId: "" }];
              }
            });
          });
        }),
      );

      return { prevData };
    },
    onSuccess: async (data, { id, postId, parentCommentId }) => {
      const queryKey = parentCommentId
        ? ["comments", "comment", parentCommentId]
        : ["comments", "post", postId];

      queryClient.setQueriesData<InfiniteData<PaginatedResponse<Comment[]>>>(
        { queryKey },
        produce((oldData) => {
          if (!oldData) {
            return undefined;
          }

          oldData.pages.forEach((page) => {
            page.data.forEach((comment) => {
              if (comment.id === id) {
                comment.points = data.data.count;
                comment.commentUpvotes = data.data.commentUpvotes;
              }
            });
          });
        }),
      );

      queryClient.invalidateQueries({
        queryKey: ["comments", "post"],
        refetchType: "none",
      });
    },
    onError: (err, { postId, parentCommentId }, context) => {
      console.error(err);
      const queryKey = parentCommentId
        ? ["comments", "comment", parentCommentId]
        : ["comments", "post", postId];

      toast.error("Failed to upvote comment");

      if (context?.prevData) {
        queryClient.setQueriesData({ queryKey }, context.prevData);
      }
      queryClient.invalidateQueries({
        queryKey,
      });
    },
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; content: string; isParent: boolean }) => {
      return postComment(data.id, data.content, data.isParent);
    },
    onMutate: async ({ id, content, isParent }) => {
      const commentQueryKey = isParent ? ["comments", "comment", id] : ["comments", "post", id];

      let prevData;
      const user = queryClient.getQueryData<string | null>(["user"]);

      queryClient.setQueriesData<InfiniteData<PaginatedResponse<Comment[]>>>(
        {
          queryKey: commentQueryKey,
        },
        produce((oldData) => {
          prevData = current(oldData);
          if (!oldData) {
            return undefined;
          }

          const draftComment: Comment = {
            content,
            points: 0,
            depth: 0,
            createdAt: new Date().toISOString(),
            postId: id,
            commentCount: 0,
            author: {
              id: "",
              username: user ?? "",
            },
            id: -1,
            userId: "",
            parentCommentId: null,
            commentUpvotes: [],
          };

          if (oldData.pages.length > 0) {
            oldData.pages[0].data.unshift(draftComment);
          }
        }),
      );

      return { prevData };
    },
    onSuccess: (data, { id, isParent }) => {
      const commentQueryKey = isParent ? ["comments", "comment", id] : ["comments", "post", id];

      if (data.success) {
        queryClient.invalidateQueries({
          queryKey: ["post", data.data.postId],
        });
        queryClient.setQueriesData<InfiniteData<PaginatedResponse<Comment[]>>>(
          {
            queryKey: commentQueryKey,
          },
          produce((oldData) => {
            if (!oldData) {
              return undefined;
            }
            if (oldData.pages.length > 0) {
              // filter out the draft comment
              oldData.pages[0].data = [data.data, ...oldData.pages[0].data.filter((c) => c.id !== -1)];
            }
          }),
        );
      }
    },
    onError: (err, { id, isParent }, context) => {
      console.error(err);
      const commentQueryKey = isParent ? ["comments", "comment", id] : ["comments", "post", id];
      toast.error("Failed to create comment");
      if (context?.prevData) {
        queryClient.setQueriesData({ queryKey: commentQueryKey }, context.prevData);
      }
      queryClient.invalidateQueries({ queryKey: commentQueryKey });
    },
  });
};
