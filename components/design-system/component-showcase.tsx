"use client";

import * as React from "react";
import {
  Plus,
  Settings01,
  InfoCircle,
  Star01,
} from "@untitled-ui/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Code, Kbd } from "@/components/ui/code";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Toaster, toast } from "@/components/ui/sonner";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ComponentShowcase() {
  return (
    <TooltipProvider>
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-foreground">Components</h2>

        <Group label="Buttons — variants">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </Group>

        <Group label="Buttons — sizes">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add"><Plus /></Button>
        </Group>

        <Group label="Badges">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success"><span className="size-1.5 rounded-full bg-current" />Done</Badge>
          <Badge variant="warning"><span className="size-1.5 rounded-full bg-current" />In progress</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="outline">Outline</Badge>
        </Group>

        <Group label="Avatars">
          <Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>
          <AvatarGroup>
            <Avatar aria-label="A"><AvatarFallback aria-hidden>A</AvatarFallback></Avatar>
            <Avatar aria-label="B"><AvatarFallback aria-hidden>B</AvatarFallback></Avatar>
            <Avatar aria-label="2 more"><AvatarFallback aria-hidden>+2</AvatarFallback></Avatar>
          </AvatarGroup>
        </Group>

        <Group label="Inline code & keys">
          <span className="text-sm text-foreground">Run <Code>npm run tokens</Code> or press <Kbd>⌘</Kbd> <Kbd>K</Kbd></span>
        </Group>

        <Group label="Separator">
          <div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">Docs <Separator orientation="vertical" /> API <Separator orientation="vertical" /> Blog</div>
        </Group>

        <Separator />

        <Group label="Form controls">
          <div className="flex items-center gap-2">
            <Checkbox id="ds-terms" defaultChecked />
            <Label htmlFor="ds-terms">Accept terms</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-notify" defaultChecked />
            <Label htmlFor="ds-notify">Notifications</Label>
          </div>
          <RadioGroup defaultValue="m" className="flex items-center gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="m" id="ds-m" /><Label htmlFor="ds-m">Monthly</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="y" id="ds-y" /><Label htmlFor="ds-y">Yearly</Label></div>
          </RadioGroup>
        </Group>

        <Group label="Select & Combobox">
          <Select defaultValue="next">
            <SelectTrigger className="w-44"><SelectValue placeholder="Framework" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="next">Next.js</SelectItem>
              <SelectItem value="remix">Remix</SelectItem>
              <SelectItem value="astro">Astro</SelectItem>
            </SelectContent>
          </Select>
          <Combobox
            className="w-44"
            options={[
              { value: "next", label: "Next.js" },
              { value: "remix", label: "Remix" },
              { value: "astro", label: "Astro" },
              { value: "nuxt", label: "Nuxt" },
            ]}
            defaultValue="next"
          />
        </Group>

        <Group label="Inputs & Textarea">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Label htmlFor="ds-email">Email</Label>
            <Input id="ds-email" type="email" placeholder="you@example.com" />
            <Textarea placeholder="Add a note…" />
            <Input disabled placeholder="Disabled" />
          </div>
        </Group>

        <Group label="Date picker">
          <DatePicker className="w-56" />
        </Group>

        <Group label="One-time code">
          <InputOTP maxLength={6}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </Group>

        <Group label="Slider & Progress">
          <div className="flex w-full max-w-sm flex-col gap-5">
            <Slider defaultValue={[60]} max={100} step={1} />
            <Progress value={60} />
          </div>
        </Group>

        <Group label="Toggle & ToggleGroup">
          <Toggle aria-label="Star"><Star01 /></Toggle>
          <ToggleGroup type="single" defaultValue="b">
            <ToggleGroupItem value="a">Day</ToggleGroupItem>
            <ToggleGroupItem value="b">Week</ToggleGroupItem>
            <ToggleGroupItem value="c">Month</ToggleGroupItem>
          </ToggleGroup>
        </Group>

        <Separator />

        <Group label="Tabs">
          <Tabs defaultValue="overview" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-3 text-sm text-muted-foreground">A summary of your workspace.</TabsContent>
            <TabsContent value="activity" className="pt-3 text-sm text-muted-foreground">Recent events appear here.</TabsContent>
            <TabsContent value="settings" className="pt-3 text-sm text-muted-foreground">Tune your preferences.</TabsContent>
          </Tabs>
        </Group>

        <Group label="Accordion">
          <Accordion type="single" collapsible className="w-full max-w-md">
            <AccordionItem value="a">
              <AccordionTrigger>What is a token?</AccordionTrigger>
              <AccordionContent>A named design value that themes can swap.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>How do I extend it?</AccordionTrigger>
              <AccordionContent>Add the variable to globals.css, then run npm run tokens.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </Group>

        <Group label="Collapsible">
          <Collapsible className="w-full max-w-md">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">Toggle details</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 text-sm text-muted-foreground">
              Hidden content revealed on demand.
            </CollapsibleContent>
          </Collapsible>
        </Group>

        <Group label="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="#">Components</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Showcase</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Group>

        <Group label="Pagination">
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
              <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#" isActive>2</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
              <PaginationItem><PaginationNext href="#" /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </Group>

        <Separator />

        <Group label="Overlays">
          <Dialog>
            <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription>Make changes and save when done.</DialogDescription>
              </DialogHeader>
              <DialogFooter><Button>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild><Button variant="outline">Sheet</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Panel</SheetTitle>
                <SheetDescription>A side panel sliding in from the edge.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
            <PopoverContent className="text-sm text-muted-foreground">Floating content anchored to the trigger.</PopoverContent>
          </Popover>

          <HoverCard>
            <HoverCardTrigger asChild><Button variant="link">@vector</Button></HoverCardTrigger>
            <HoverCardContent className="text-sm text-muted-foreground">Profile preview on hover.</HoverCardContent>
          </HoverCard>

          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Settings"><Settings01 /></Button></TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">Menu</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Group>

        <Group label="Alerts">
          <Alert variant="info" className="max-w-md">
            <InfoCircle />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>This is an inline, non-blocking notice.</AlertDescription>
          </Alert>
        </Group>

        <Group label="Toast">
          <Button variant="outline" onClick={() => toast("Saved", { description: "Your changes were stored." })}>
            Show toast
          </Button>
        </Group>

        <Group label="Skeleton">
          <div className="flex w-full max-w-sm items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </Group>

        <Separator />

        <Group label="Table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Seats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Acme</TableCell>
                <TableCell><Badge variant="success">Active</Badge></TableCell>
                <TableCell className="text-right">12</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Globex</TableCell>
                <TableCell><Badge variant="warning">Trial</Badge></TableCell>
                <TableCell className="text-right">3</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Group>

        <Group label="Aspect ratio">
          <div className="w-64">
            <AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-md border border-border bg-muted text-sm text-muted-foreground">
              16 : 9
            </AspectRatio>
          </div>
        </Group>

        <Group label="Resizable">
          <ResizablePanelGroup orientation="horizontal" className="h-32 max-w-md rounded-md border border-border">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Left</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Right</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Group>

        <Group label="Card">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Pro plan</CardTitle>
              <CardDescription>Everything in Starter, plus more.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A card composed entirely from design-system tokens — swap the theme and it follows.
            </CardContent>
            <CardFooter>
              <Button className="w-full">Choose Pro</Button>
            </CardFooter>
          </Card>
        </Group>
      </section>
      <Toaster />
    </TooltipProvider>
  );
}
