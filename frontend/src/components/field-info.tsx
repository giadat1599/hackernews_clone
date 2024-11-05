import { FieldApi } from "@tanstack/react-form";

interface FieldInfoProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldApi<any, any, any, any>;
}

export function FieldInfo({ field }: FieldInfoProps) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length ? (
        <p className="text-[0.8rem] font-medium text-destructive">{field.state.meta.errors.join(", ")}</p>
      ) : null}
    </>
  );
}
