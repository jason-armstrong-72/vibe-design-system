import * as React from "react"
import { Menubar as MenubarPrimitive } from "radix-ui"
import { Check, ChevronRight, Circle } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"

function Menubar({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Root>) {
  return <MenubarPrimitive.Root data-slot="menubar" className={cn("flex h-9 items-center gap-1 rounded-md border border-border bg-background p-1 shadow-sm", className)} {...props} />
}
function MenubarMenu(props: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />
}
function MenubarGroup(props: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />
}
function MenubarPortal(props: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />
}
function MenubarRadioGroup(props: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
}
function MenubarSub(props: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}
function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return <MenubarPrimitive.Trigger data-slot="menubar-trigger" className={cn("flex select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground", className)} {...props} />
}
function MenubarContent({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }: React.ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content data-slot="menubar-content" align={align} alignOffset={alignOffset} sideOffset={sideOffset} className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
    </MenubarPrimitive.Portal>
  )
}
function MenubarItem({ className, inset, ...props }: React.ComponentProps<typeof MenubarPrimitive.Item> & { inset?: boolean }) {
  return <MenubarPrimitive.Item data-slot="menubar-item" data-inset={inset} className={cn("relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset=true]:pl-8 [&_svg]:size-4", className)} {...props} />
}
function MenubarCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof MenubarPrimitive.CheckboxItem>) {
  return (
    <MenubarPrimitive.CheckboxItem data-slot="menubar-checkbox-item" checked={checked} className={cn("relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><MenubarPrimitive.ItemIndicator><Check aria-hidden className="size-4" /></MenubarPrimitive.ItemIndicator></span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
}
function MenubarRadioItem({ className, children, ...props }: React.ComponentProps<typeof MenubarPrimitive.RadioItem>) {
  return (
    <MenubarPrimitive.RadioItem data-slot="menubar-radio-item" className={cn("relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><MenubarPrimitive.ItemIndicator><Circle aria-hidden className="size-2 fill-current" /></MenubarPrimitive.ItemIndicator></span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
}
function MenubarLabel({ className, inset, ...props }: React.ComponentProps<typeof MenubarPrimitive.Label> & { inset?: boolean }) {
  return <MenubarPrimitive.Label data-slot="menubar-label" data-inset={inset} className={cn("px-2 py-1.5 text-sm font-medium data-[inset=true]:pl-8", className)} {...props} />
}
function MenubarSeparator({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Separator>) {
  return <MenubarPrimitive.Separator data-slot="menubar-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}
function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="menubar-shortcut" className={cn("ml-auto text-2xs tracking-widest text-muted-foreground", className)} {...props} />
}
function MenubarSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof MenubarPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <MenubarPrimitive.SubTrigger data-slot="menubar-sub-trigger" data-inset={inset} className={cn("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[inset=true]:pl-8", className)} {...props}>
      {children}
      <ChevronRight aria-hidden className="ml-auto size-4" />
    </MenubarPrimitive.SubTrigger>
  )
}
function MenubarSubContent({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return <MenubarPrimitive.SubContent data-slot="menubar-sub-content" className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
}

export { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarPortal, MenubarSubContent, MenubarSubTrigger, MenubarGroup, MenubarSub, MenubarShortcut }
