import * as React from "react"
import { cn } from "@/lib/utils"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col border-r bg-card", className)}
    {...props}
  />
))
Sidebar.displayName = "Sidebar"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto p-4", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean
  }
>(({ className, active, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active
        ? "bg-accent text-foreground dark:bg-[hsl(240_3.7%_25%)] dark:text-foreground"
        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:hover:bg-accent/25 dark:hover:text-foreground/90",
      className
    )}
    {...props}
  />
))
SidebarItem.displayName = "SidebarItem"

export { Sidebar, SidebarContent, SidebarItem }
