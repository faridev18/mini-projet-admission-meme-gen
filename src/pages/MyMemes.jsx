import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Trash2, Share2, ImageOff } from "lucide-react";
import { Link } from "react-router";

export default function MyMemes() {
  const { user, loginWithGoogle } = useAuth();
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "memes"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMemes(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const deleteMeme = async (meme) => {
    if (!confirm("Supprimer ce mème ?")) return;

    try {
      // Delete from Storage
      const imageRef = ref(storage, `memes/${user.uid}/${meme.imageUrl.split("%2F").pop().split("?")[0]}`);
      try {
        await deleteObject(imageRef);
      } catch {
        // Image may already be deleted
      }
      // Delete from Firestore
      await deleteDoc(doc(db, "memes", meme.id));
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  };

  const downloadMeme = (meme) => {
    const link = document.createElement("a");
    link.href = meme.imageUrl;
    link.download = "meme.png";
    link.target = "_blank";
    link.click();
  };

  const shareMeme = async (meme) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon mème",
          text: [meme.topText, meme.bottomText].filter(Boolean).join(" - "),
          url: meme.imageUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(meme.imageUrl);
      alert("Lien copié dans le presse-papiers !");
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-6 pt-20">
        <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
          Connectez-vous pour voir vos mèmes
        </h2>
        <Button onClick={loginWithGoogle} size="lg">
          Connexion Google
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-heading)]">
          Mes Mèmes
        </h1>
        <Link to="/editor">
          <Button className="gap-2">
            + Créer un mème
          </Button>
        </Link>
      </div>

      {memes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-12 text-muted-foreground">
          <ImageOff className="h-16 w-16" />
          <p className="text-lg">Aucun mème pour l'instant</p>
          <Link to="/editor">
            <Button>Créer mon premier mème</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {memes.map((meme) => (
            <Card key={meme.id} className="overflow-hidden group">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full cursor-pointer">
                    <img
                      src={meme.imageUrl}
                      alt={meme.topText || "Mème"}
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl p-2">
                  <img
                    src={meme.imageUrl}
                    alt={meme.topText || "Mème"}
                    className="w-full rounded"
                  />
                </DialogContent>
              </Dialog>
              <CardContent className="flex items-center justify-between p-3">
                <span className="truncate text-sm text-muted-foreground">
                  {meme.topText || meme.bottomText || "Sans texte"}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => downloadMeme(meme)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => shareMeme(meme)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMeme(meme)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
