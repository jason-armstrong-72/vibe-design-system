// Dense Linear-style dogfood preview — token-only, real new primitives.
import {
  SearchMd, Settings01, Bell01, Inbox01, LayersThree01, Hash01,
  Zap, FilterLines, Plus, GitBranch01, MessageSquare01, Send01,
  CheckCircle, Circle, AlertCircle, User01,
} from "@untitled-ui/icons-react";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code, Kbd } from "@/components/ui/code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function NavItem({ icon: Icon, label, count, active }: { icon: typeof Hash01; label: string; count?: number; active?: boolean }) {
  return (
    <button className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}>
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {count != null && <span className="text-2xs text-muted-foreground">{count}</span>}
    </button>
  );
}

function IssueRow({ id, title, badge, who, branch, comments }: { id: string; title: string; badge: React.ReactNode; who: string; branch?: string; comments?: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 hover:bg-accent">
      <span className="text-2xs font-mono text-muted-foreground">{id}</span>
      {badge}
      <span className="flex-1 truncate text-sm text-foreground">{title}</span>
      {branch && (
        <span className="hidden items-center gap-1 text-2xs text-muted-foreground md:flex">
          <GitBranch01 className="size-3" />{branch}
        </span>
      )}
      {comments != null && (
        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
          <MessageSquare01 className="size-3" />{comments}
        </span>
      )}
      <Avatar aria-label={who} className="size-6">
        <AvatarFallback aria-hidden className="text-2xs">{who}</AvatarFallback>
      </Avatar>
    </div>
  );
}

export default function PreviewApp() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Zap className="size-5 text-info" />
          <span>Vector</span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="text-foreground">Engineering</span>
          <span>/</span>
          <span>Active</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <SearchMd className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" className="h-8 w-56 pl-8 text-sm" />
            <span className="absolute top-1/2 right-2 -translate-y-1/2"><Kbd>⌘</Kbd></span>
          </div>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Notifications"><Bell01 className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Settings"><Settings01 className="size-4" /></Button>
          <Avatar aria-label="You" className="size-7"><AvatarFallback aria-hidden>Yo</AvatarFallback></Avatar>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r border-border bg-surface p-3 md:flex">
          <Button className="justify-start gap-2"><Plus className="size-4" />New issue</Button>
          <div className="flex flex-col gap-0.5">
            <NavItem icon={Inbox01} label="Inbox" count={3} active />
            <NavItem icon={LayersThree01} label="My issues" count={12} />
            <NavItem icon={User01} label="Assigned" count={5} />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">Teams</h2>
            <NavItem icon={Hash01} label="Frontend" />
            <NavItem icon={Hash01} label="Backend" />
            <NavItem icon={Hash01} label="Design" />
          </div>
          <div className="mt-auto rounded-md border border-border bg-background p-3">
            <p className="text-2xs text-muted-foreground">Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> for commands, or run <Code>vector sync</Code> in your terminal.</p>
          </div>
        </aside>

        {/* main list */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
            <h1 className="text-sm font-semibold">Active issues</h1>
            <Badge variant="secondary">24</Badge>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Button variant="outline" size="sm" className="gap-1"><FilterLines className="size-4" />Filter</Button>
              <AvatarGroup>
                <Avatar aria-label="Ada" className="size-6"><AvatarFallback aria-hidden className="text-2xs">Ad</AvatarFallback></Avatar>
                <Avatar aria-label="Ben" className="size-6"><AvatarFallback aria-hidden className="text-2xs">Be</AvatarFallback></Avatar>
                <Avatar aria-label="Cy" className="size-6"><AvatarFallback aria-hidden className="text-2xs">Cy</AvatarFallback></Avatar>
                <Avatar aria-label="3 more" className="size-6"><AvatarFallback aria-hidden className="text-2xs">+3</AvatarFallback></Avatar>
              </AvatarGroup>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex items-center gap-2 bg-surface px-4 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              <Circle className="size-3" />In progress
            </div>
            <IssueRow id="VEC-218" title="Token editor drops focus on blur" badge={<Badge variant="warning"><span className="size-1.5 rounded-full bg-current" />Doing</Badge>} who="Ad" branch="fix/blur" comments={4} />
            <IssueRow id="VEC-204" title="Surface role parity across all themes" badge={<Badge variant="warning"><span className="size-1.5 rounded-full bg-current" />Doing</Badge>} who="Be" branch="feat/surface" comments={2} />
            <div className="flex items-center gap-2 bg-surface px-4 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              <AlertCircle className="size-3" />Todo
            </div>
            <IssueRow id="VEC-231" title="Add 2xs micro type step for kbd caps" badge={<Badge variant="info">Todo</Badge>} who="Cy" comments={1} />
            <IssueRow id="VEC-240" title="Activate accent as the hover surface" badge={<Badge variant="info">Todo</Badge>} who="Ad" branch="feat/accent" />
            <IssueRow id="VEC-245" title="Avatar group overflow chip needs a label" badge={<Badge variant="destructive"><span className="size-1.5 rounded-full bg-current" />Blocked</Badge>} who="Be" comments={7} />
            <div className="flex items-center gap-2 bg-surface px-4 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              <CheckCircle className="size-3" />Done
            </div>
            <IssueRow id="VEC-190" title="Badge replaces faked status pills" badge={<Badge variant="success"><span className="size-1.5 rounded-full bg-current" />Done</Badge>} who="Cy" comments={3} />
            <IssueRow id="VEC-188" title="Separator primitive (radix)" badge={<Badge variant="success"><span className="size-1.5 rounded-full bg-current" />Done</Badge>} who="Ad" />
          </div>
        </main>

        {/* agent panel */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface lg:flex">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4">
            <Zap className="size-4 text-info" />
            <span className="text-sm font-semibold">Agent</span>
            <Badge variant="outline" className="ml-auto">beta</Badge>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-sm text-foreground">I found <span className="font-medium">3 issues</span> touching the token gate. Want me to draft fixes?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">VEC-218</Badge>
                <Badge variant="secondary">VEC-204</Badge>
                <Badge variant="secondary">VEC-231</Badge>
              </div>
            </div>
            <div className="rounded-md bg-accent p-3 text-accent-foreground">
              <p className="text-sm">Run <Code>npm run check</Code> first — it gates hardcoded colors.</p>
            </div>
            <p className="text-2xs text-muted-foreground">Agent can edit files, run the gate, and open PRs.</p>
          </div>
          <div className="shrink-0 border-t border-border p-3">
            <div className="relative">
              <Input placeholder="Ask the agent…" className="h-9 pr-9 text-sm" />
              <Button size="icon" className="absolute top-1/2 right-1 size-7 -translate-y-1/2" aria-label="Send"><Send01 className="size-4" /></Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
