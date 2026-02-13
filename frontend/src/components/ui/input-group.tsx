import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  prefix?: string
  suffix?: string
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, prefix, suffix, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center", className)}
        {...props}
      >
        {prefix && (
          <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <div className="flex-1">
          {React.cloneElement(children as React.ReactElement, {
            className: cn(
              (children as React.ReactElement)?.props?.className,
              prefix && !suffix && "rounded-l-none",
              suffix && !prefix && "rounded-r-none",
              prefix && suffix && "rounded-none"
            )
          })}
        </div>
        {suffix && (
          <span className="inline-flex items-center px-3 py-2 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    )
  }
)
InputGroup.displayName = "InputGroup"

export { InputGroup }
