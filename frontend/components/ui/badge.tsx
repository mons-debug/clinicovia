import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90",
        secondary:
          "border-transparent bg-[var(--background)] text-[var(--text-primary)] hover:bg-[var(--background)]/80",
        destructive:
          "border-transparent bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90",
        success:
          "border-transparent bg-[var(--success)] text-white hover:bg-[var(--success)]/90",
        warning:
          "border-transparent bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90",
        outline: "text-[var(--text-primary)] border-[var(--border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
