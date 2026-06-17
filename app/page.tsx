import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="p-8 flex flex-col gap-6">
      <h1 className="text-4xl font-bold text-foreground">Design System Starter</h1>
      <p className="text-base text-muted-foreground">
        Themed entirely from <code className="font-mono">app/globals.css</code> tokens.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button>Primary</Button>
        <Button className="bg-success text-success-foreground">Success</Button>
        <Button className="bg-warning text-warning-foreground">Warning</Button>
        <Button className="bg-info text-info-foreground">Info</Button>
      </div>
      <Card className="p-6 shadow-md rounded-lg max-w-md">
        <p className="text-lg">
          Card on <code className="font-mono">--card</code>, radius from{" "}
          <code className="font-mono">--radius</code>.
        </p>
      </Card>
    </main>
  );
}
