import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { XClose } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"

function ToastProvider(props: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}
function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return <ToastPrimitive.Viewport data-slot="toast-viewport" className={cn("fixed right-0 bottom-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm", className)} {...props} />
}
function Toast({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Root>) {
  return <ToastPrimitive.Root data-slot="toast" className={cn("group pointer-events-auto relative flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-right-2 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0 data-[swipe=cancel]:transition-transform", className)} {...props} />
}
function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title data-slot="toast-title" className={cn("text-sm font-semibold", className)} {...props} />
}
function ToastDescription({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return <ToastPrimitive.Description data-slot="toast-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}
function ToastAction({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return <ToastPrimitive.Action data-slot="toast-action" className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", className)} {...props} />
}
function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close data-slot="toast-close" className={cn("rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none", className)} toast-close="" {...props}>
      <XClose className="size-4" />
      <span className="sr-only">Close</span>
    </ToastPrimitive.Close>
  )
}

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose }
