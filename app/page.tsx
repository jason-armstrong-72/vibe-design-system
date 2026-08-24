import Link from "next/link";
import { ArrowRight, Grid01, LayoutAlt01, CurrencyDollarCircle } from "@untitled-ui/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";

const manifest = designSystem as Manifest;

const routes = [
  {
    href: "/design-system",
    icon: Grid01,
    title: "Design system",
    description: `All ${manifest.tokens.length} tokens, grouped and live, plus the full component showcase. Open the visual editor here to edit a token point-and-click.`,
    cta: "Open the token reference",
  },
  {
    href: "/preview-app",
    icon: LayoutAlt01,
    title: "App preview",
    description:
      "A dense issue-tracker shell built only from tokens and primitives — the dogfood check that the system holds up in a real product UI.",
    cta: "Open the app preview",
  },
  {
    href: "/pricing",
    icon: CurrencyDollarCircle,
    title: "Pricing page",
    description:
      "A marketing-style pricing layout on the same tokens — the counterpart to the app shell, proving the system covers both.",
    cta: "Open the pricing page",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto flex max-w-lg flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight">Design System Starter</h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Themed entirely from <code className="font-mono text-base">app/globals.css</code>. Edit a
            token and it ripples through every page below.
          </p>
        </header>

        <nav aria-label="Pages" className="grid gap-4 sm:grid-cols-2">
          {routes.map(({ href, icon: Icon, title, description, cta }) => (
            <Card key={href} className="flex flex-col gap-4 p-6">
              <CardHeader className="flex flex-col gap-2 p-0">
                <Icon aria-hidden className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto p-0">
                <Button asChild variant="outline">
                  <Link href={href}>
                    {cta}
                    <ArrowRight aria-hidden data-icon="inline-end" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </nav>
      </div>
    </main>
  );
}
