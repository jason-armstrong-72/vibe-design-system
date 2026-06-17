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

      <Group label="Status (token utilities)">
        <span className="inline-flex items-center rounded-md bg-success px-2.5 py-1 text-xs font-medium text-success-foreground">
          Success
        </span>
        <span className="inline-flex items-center rounded-md bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground">
          Warning
        </span>
        <span className="inline-flex items-center rounded-md bg-info px-2.5 py-1 text-xs font-medium text-info-foreground">
          Info
        </span>
        <span className="inline-flex items-center rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground">
          Error
        </span>
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
