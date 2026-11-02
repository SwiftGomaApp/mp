import { Package, ShoppingBag, Store, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Espace vendeur",
  description: "Gérez votre boutique SwiftGoma.",
  path: "/seller",
  index: false,
});

export const instant = false;

const UPCOMING: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Ma boutique",
    description: "Présentez votre boutique et ses informations.",
    icon: Store,
  },
  {
    title: "Produits",
    description: "Publiez et mettez à jour votre catalogue.",
    icon: Package,
  },
  {
    title: "Commandes",
    description: "Recevez et suivez les commandes de vos clients.",
    icon: ShoppingBag,
  },
  {
    title: "Ventes",
    description: "Suivez vos ventes et vos résultats.",
    icon: TrendingUp,
  },
];

export default function SellerDashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Espace vendeur</h1>
        <p className="text-sm text-muted-foreground">
          Votre tableau de bord vendeur arrive bientôt. Voici ce que vous pourrez y faire.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {UPCOMING.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="opacity-80">
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <CardTitle className="flex items-center gap-2">
                {title}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Bientôt
                </span>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
