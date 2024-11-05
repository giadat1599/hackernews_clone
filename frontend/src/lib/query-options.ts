import { queryOptions } from "@tanstack/react-query";

import { getUser } from "./api";

export const userQueryOptions = () =>
  queryOptions({
    queryKey: ["user"],
    queryFn: getUser,
    staleTime: Infinity,
  });
