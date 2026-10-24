import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm leading-[1.45]", {
  variants: {
    variant: {
      default: "border-border bg-surface text-foreground",
      destructive: "border-danger/30 bg-danger-subtle text-foreground",
      warning: "border-warning/40 bg-warning-subtle text-foreground",
      success: "border-success/30 bg-success-subtle text-foreground",
      info: "border-info/40 bg-info-subtle text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm [&_p]:leading-[1.45]", className)} {...props} />;
}
