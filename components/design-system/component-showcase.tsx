import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

      <Group label="Inputs">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <label htmlFor="ds-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input id="ds-email" type="email" placeholder="you@example.com" />
          <Input disabled placeholder="Disabled" />
        </div>
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
  );
}
