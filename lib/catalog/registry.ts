export type CatalogEntry = {
  name: string;        // logical primitive
  file: string;        // components/ui path
  exports: string[];   // every Capitalized export the file provides
  purpose: string;     // one line — what it's for
  whenToUse: string;   // when to reach for it
  import: string;      // copy-paste import line
  snippet: string;     // minimal usage
};

export const CATALOG: CatalogEntry[] = [
  { name: "Button", file: "components/ui/button.tsx", exports: ["Button"],
    purpose: "Clickable action — variants (default/secondary/outline/ghost/destructive/link) + sizes.",
    whenToUse: "Any action or submit. Use asChild to render a link as a button.",
    import: `import { Button } from "@/components/ui/button"`,
    snippet: `<Button variant="outline">Save</Button>` },
  { name: "Input", file: "components/ui/input.tsx", exports: ["Input"],
    purpose: "Single-line text field.",
    whenToUse: "Short text/email/number entry. Pair with Label.",
    import: `import { Input } from "@/components/ui/input"`,
    snippet: `<Input type="email" placeholder="you@example.com" />` },
  { name: "Card", file: "components/ui/card.tsx",
    exports: ["Card", "CardHeader", "CardTitle", "CardAction", "CardDescription", "CardContent", "CardFooter"],
    purpose: "Surface container with header/title/description/content/footer slots.",
    whenToUse: "Group related content into a panel.",
    import: `import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"`,
    snippet: `<Card><CardHeader><CardTitle>Plan</CardTitle></CardHeader><CardContent>…</CardContent></Card>` },
  { name: "Avatar", file: "components/ui/avatar.tsx",
    exports: ["Avatar", "AvatarImage", "AvatarFallback", "AvatarGroup"],
    purpose: "User image with initials fallback; AvatarGroup stacks with a +N overflow chip.",
    whenToUse: "Represent a person. Always give Avatar an aria-label (the name).",
    import: `import { Avatar, AvatarFallback } from "@/components/ui/avatar"`,
    snippet: `<Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>` },
  { name: "Badge", file: "components/ui/badge.tsx", exports: ["Badge"],
    purpose: "Small status/label pill — semantic variants (success/warning/info/destructive/…).",
    whenToUse: "Status or category. The label text must carry the meaning (never color alone).",
    import: `import { Badge } from "@/components/ui/badge"`,
    snippet: `<Badge variant="success">Done</Badge>` },
  { name: "Separator", file: "components/ui/separator.tsx", exports: ["Separator"],
    purpose: "Horizontal or vertical divider rule.",
    whenToUse: "Separate groups of content or toolbar items.",
    import: `import { Separator } from "@/components/ui/separator"`,
    snippet: `<Separator orientation="vertical" />` },
  { name: "Code", file: "components/ui/code.tsx", exports: ["Code", "Kbd"],
    purpose: "Code: inline <code> chip. Kbd: keyboard-cap glyph (uses the 2xs micro step).",
    whenToUse: "Inline command/code (Code) or a shortcut key (Kbd).",
    import: `import { Code, Kbd } from "@/components/ui/code"`,
    snippet: `Run <Code>npm run dev</Code> or press <Kbd>⌘</Kbd> <Kbd>K</Kbd>` },
];
