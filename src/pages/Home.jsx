import { Link } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlus, Download, Share2, Images } from "lucide-react";

const features = [
  {
    icon: ImagePlus,
    title: "Téléchargez une image",
    description: "Importez n'importe quelle image depuis votre ordinateur.",
  },
  {
    icon: Download,
    title: "Ajoutez du texte",
    description: "Personnalisez votre mème avec du texte en haut et en bas.",
  },
  {
    icon: Share2,
    title: "Partagez",
    description: "Téléchargez ou partagez votre mème sur les réseaux sociaux.",
  },
  {
    icon: Images,
    title: "Galerie",
    description: "Retrouvez tous vos mèmes précédemment créés.",
  },
];

export default function Home() {
  const { user, loginWithGoogle } = useAuth();

  return (
    <div className="flex flex-col items-center gap-12">
      <section className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-[family-name:var(--font-heading)]">
          Créez vos mèmes <br />
          <span className="text-primary">en quelques clics</span>
        </h1>
        <p className="max-w-md text-muted-foreground text-lg">
          Téléchargez une image, ajoutez du texte et partagez vos créations
          avec le monde entier.
        </p>
        <div className="flex gap-4">
          {user ? (
            <Link to="/editor">
              <Button size="lg" className="gap-2">
                <ImagePlus className="h-5 w-5" />
                Créer un mème
              </Button>
            </Link>
          ) : (
            <Button size="lg" onClick={loginWithGoogle} className="gap-2">
              Commencer gratuitement
            </Button>
          )}
          {user && (
            <Link to="/my-memes">
              <Button size="lg" variant="outline" className="gap-2">
                <Images className="h-5 w-5" />
                Mes mèmes
              </Button>
            </Link>
          )}
        </div>
      </section>

      <section className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold font-[family-name:var(--font-heading)]">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
