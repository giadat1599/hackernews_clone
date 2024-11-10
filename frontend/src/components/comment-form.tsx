import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";

import { toast } from "sonner";

import { createCommentSchema } from "@/shared/schemas";
import { useCreateComment } from "@/lib/api-hooks";

import { FieldInfo } from "./field-info";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface CommentFormProps {
  id: number;
  isParent?: boolean;
  onSuccess?: () => void;
}

export function CommentForm({ id, isParent, onSuccess }: CommentFormProps) {
  const { mutateAsync: createComment } = useCreateComment();
  const form = useForm({
    defaultValues: {
      content: "",
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: createCommentSchema,
    },
    onSubmit: async ({ value }) => {
      await createComment(
        { id, isParent: !!isParent, content: value.content },
        {
          onSuccess: (data) => {
            if (!data.success) {
              if (!data.isFormError) {
                toast.error("Failed to create comment", {
                  description: data.error,
                });
              }
              form.setErrorMap({
                onSubmit: data.isFormError ? data.error : "Unexpected error",
              });
              throw new Error(data.error);
            } else {
              form.reset();
              onSuccess?.();
            }
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid gap-2"
    >
      <form.Field
        name="content"
        children={(field) => (
          <div className="grid gap-2">
            <Textarea
              id={field.name}
              aria-label={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="What are your thoughts?"
              rows={4}
              className="w-full p-2 text-sm"
            />
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.errorMap]}
        children={([errorMap]) =>
          errorMap.onSubmit ? (
            <p className="text-[0.8rem] font-medium text-destructive">{errorMap.onSubmit.toString()}</p>
          ) : null
        }
      />
      <div className="flex items-center justify-end space-x-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "..." : "Add comment"}
            </Button>
          )}
        />
      </div>
    </form>
  );
}
