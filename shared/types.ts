import type { ApiRoutes } from "../server/index";

export { type ApiRoutes };

export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? {} : { data: T });

export type ErrorResponse = {
  success: false;
  error: string;
  isFormError?: boolean;
};

export type Post = {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
  points: number;
  createdAt: string;
  commentCount: number;
  author: {
    id: string;
    username: string;
  };
  isUpvoted: boolean;
};

export type Comment = {
  id: number;
  userId: string;
  content: string;
  points: number;
  depth: number;
  commentCount: number;
  createdAt: string;
  postId: number;
  parentCommentId: number | null;
  commentUpvotes: {
    userId: string;
  }[];
  author: {
    id: string;
    username: string;
  };
  childComments?: Comment[];
};

export type PaginatedResponse<T> = Omit<SuccessResponse, "data"> & {
  pagination: {
    page: number;
    totalPages: number;
  };
  data: T;
};
