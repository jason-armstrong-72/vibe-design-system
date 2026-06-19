import type { Metadata } from "next";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing. Pick the plan that fits your team.",
};

type Plan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    description: "Everything you need to get off the ground.",
    features: [
      "Up to 3 projects",
      "1 team member",
      "Community support",
      "1 GB storage",
      "Basic analytics",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For growing teams that need more power and polish.",
    features: [
      "Unlimited projects",
      "Up to 10 team members",
      "Priority support",
      "100 GB storage",
      "Advanced analytics & insights",
    ],
    cta: "Get started",
    featured: true,
  },
  {
    name: "Team",
    price: "$99",
    period: "/mo",
    description: "Scale across your whole organisation with control.",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Dedicated success manager",
      "1 TB storage",
      "SSO & audit logs",
    ],
    cta: "Get started",
  },
];

export default function PricingPage() {
  return (
    <main className="flex flex-col items-center px-6 py-16 sm:py-24">
      <header className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
          <Sparkles className="size-4" />
          Pricing
        </span>
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
          Simple pricing for every team
        </h1>
        <p className="text-lg text-muted-foreground">
          Start free, upgrade when you&rsquo;re ready. No hidden fees, cancel
          anytime.
        </p>
      </header>

      <section className="mt-16 grid w-full max-w-lg grid-cols-1 items-center gap-6 lg:grid-cols-3 lg:gap-4">
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </section>
    </main>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const { featured } = plan;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl bg-card text-card-foreground transition-all ease-standard",
        featured
          ? // Hero: premium, celebratory — lifts off the page, brand-tinted,
            // glowing ring + shadow, and scaled up on large screens so the eye lands here first.
            "z-sticky border-base border-brand-500 bg-gradient-to-b from-brand-50 to-card p-8 shadow-lg ring-4 ring-brand-500/15 lg:-my-4 lg:scale-105 dark:from-brand-950 dark:to-card"
          : "border-thin border-border p-8 shadow-sm hover:shadow-md"
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-brand-50 shadow-md">
          <Sparkles className="size-3.5" />
          Most popular
        </span>
      )}

      <div className="flex flex-col gap-2">
        <h2
          className={cn(
            "text-lg font-semibold",
            featured ? "text-brand-700" : "text-foreground"
          )}
        >
          {plan.name}
        </h2>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-base text-muted-foreground">
              {plan.period}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>

      <ul className="mt-8 flex flex-1 flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                featured
                  ? "bg-brand-500 text-brand-50"
                  : "bg-success/15 text-success"
              )}
            >
              <Check className="size-3.5" />
            </span>
            <span className="text-card-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        variant={featured ? "default" : "outline"}
        className={cn(
          "mt-8 w-full",
          featured && "bg-brand-500 text-brand-50 hover:bg-brand-600"
        )}
      >
        {plan.cta}
      </Button>
    </div>
  );
}
