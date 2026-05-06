import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-purple disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-linear-to-br from-primary-purple to-primary-blue text-white shadow-lg hover:shadow-primary-purple/25 hover:-translate-y-0.5",
        destructive: "bg-error/10 text-error hover:bg-error/20 border border-error/20",
        outline:
          "border border-neutral-600 bg-transparent hover:bg-neutral-800 hover:text-white text-neutral-300",
        secondary:
          "bg-neutral-700 text-neutral-300 border border-neutral-600 hover:bg-neutral-600 hover:text-white",
        ghost: "hover:bg-neutral-800 hover:text-white text-neutral-400",
        link: "text-primary-purple underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
