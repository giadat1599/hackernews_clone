import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { current, produce } from "immer";
import { toast } from "sonner";

import { Post, SuccessResponse } from "@/shared/types";

import { GetPostsSuccess, upvotePost } from "./api";

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
