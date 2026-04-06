import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  Download,
  Share2,
  Save,
  ImagePlus,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";

let nextId = 1;

function createTextBlock(x, y) {
  return {
    id: nextId++,
    text: "",
    x,
    y,
    fontSize: 40,
    color: "#ffffff",
    uppercase: true,
  };
}

export default function Editor() {
  const { user, loginWithGoogle } = useAuth();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [image, setImage] = useState(null);
  const [textBlocks, setTextBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [canvasScale, setCanvasScale] = useState(1);

  const selectedBlock = textBlocks.find((b) => b.id === selectedId);

  // --- Drawing ---
  const drawMeme = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    for (const block of textBlocks) {
      if (!block.text) continue;
      const size = block.fontSize;
      ctx.font = `bold ${size}px Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, size / 10);
      ctx.strokeStyle = "black";
      ctx.fillStyle = block.color;

      const display = block.uppercase ? block.text.toUpperCase() : block.text;
      ctx.strokeText(display, block.x, block.y);
      ctx.fillText(display, block.x, block.y);

      // Selection indicator
      if (block.id === selectedId) {
        const metrics = ctx.measureText(display);
        const w = metrics.width + 16;
        const h = size + 12;
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#0055FF";
        ctx.lineWidth = 2;
        ctx.strokeRect(block.x - w / 2, block.y - h / 2, w, h);
        ctx.setLineDash([]);
      }
    }
  }, [image, textBlocks, selectedId]);

  useEffect(() => {
    drawMeme();
  }, [drawMeme]);

  // --- Update canvas scale for mouse mapping ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) setCanvasScale(canvas.width / rect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [image]);

  // --- Mouse → canvas coords ---
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * canvasScale,
      y: (e.clientY - rect.top) * canvasScale,
    };
  };

  const hitTest = (mx, my) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    for (let i = textBlocks.length - 1; i >= 0; i--) {
      const b = textBlocks[i];
      if (!b.text) continue;
      ctx.font = `bold ${b.fontSize}px Impact, sans-serif`;
      const display = b.uppercase ? b.text.toUpperCase() : b.text;
      const metrics = ctx.measureText(display);
      const w = metrics.width / 2 + 12;
      const h = b.fontSize / 2 + 10;
      if (
        mx >= b.x - w && mx <= b.x + w &&
        my >= b.y - h && my <= b.y + h
      ) {
        return b.id;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e) => {
    const { x, y } = getCanvasPos(e);
    const hit = hitTest(x, y);
    if (hit !== null) {
      setSelectedId(hit);
      const block = textBlocks.find((b) => b.id === hit);
      setDragging({ id: hit, offsetX: x - block.x, offsetY: y - block.y });
    } else {
      setSelectedId(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragging) return;
    const { x, y } = getCanvasPos(e);
    setTextBlocks((prev) =>
      prev.map((b) =>
        b.id === dragging.id
          ? { ...b, x: x - dragging.offsetX, y: y - dragging.offsetY }
          : b
      )
    );
  };

  const handleCanvasMouseUp = () => setDragging(null);

  // --- Touch support ---
  const handleCanvasTouchStart = (e) => {
    const touch = e.touches[0];
    handleCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
  };
  const handleCanvasTouchMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  };
  const handleCanvasTouchEnd = () => setDragging(null);

  // --- Text block CRUD ---
  const addTextBlock = () => {
    if (!image) return;
    const block = createTextBlock(image.width / 2, image.height / 2);
    setTextBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const updateBlock = (id, changes) => {
    setTextBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...changes } : b))
    );
  };

  const removeBlock = (id) => {
    setTextBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // --- Image upload ---
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      if (img.width > maxDim || img.height > maxDim) {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width * ratio;
        tempCanvas.height = img.height * ratio;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        const resizedImg = new Image();
        resizedImg.onload = () => {
          setImage(resizedImg);
          setTextBlocks([
            createTextBlock(tempCanvas.width / 2, 50),
            createTextBlock(tempCanvas.width / 2, tempCanvas.height - 50),
          ]);
          setSelectedId(null);
        };
        resizedImg.src = tempCanvas.toDataURL();
      } else {
        setImage(img);
        setTextBlocks([
          createTextBlock(img.width / 2, 50),
          createTextBlock(img.width / 2, img.height - 50),
        ]);
        setSelectedId(null);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // --- Actions ---
  const downloadMeme = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "meme.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  };

  const shareMeme = async () => {
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (navigator.share) {
        try {
          await navigator.share({
            files: [new File([blob], "meme.png", { type: "image/png" })],
            title: "Mon mème",
          });
        } catch {
          // cancelled
        }
      } else {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          alert("Mème copié dans le presse-papiers !");
        } catch {
          downloadMeme();
        }
      }
    }, "image/png");
  };

  const saveMeme = async () => {
    if (!user || !canvasRef.current) return;
    setSaving(true);

    // Remove selection indicator before saving
    const prevSelected = selectedId;
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(r));

    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL("image/jpeg", 0.7);

      const texts = textBlocks
        .map((b) => b.text)
        .filter(Boolean)
        .join(" — ");

      await addDoc(collection(db, "memes"), {
        userId: user.uid,
        imageData,
        topText: texts,
        bottomText: "",
        createdAt: serverTimestamp(),
      });

      navigate("/my-memes");
    } catch (err) {
      console.error("Erreur lors de la sauvegarde:", err);
      alert("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
      setSelectedId(prevSelected);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-6 pt-20">
        <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
          Connectez-vous pour créer des mèmes
        </h2>
        <Button onClick={loginWithGoogle} size="lg">
          Connexion Google
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      {/* Canvas preview */}
      <Card className="overflow-hidden">
        <CardContent className="flex items-center justify-center bg-muted/30 p-4 min-h-[400px]">
          {image ? (
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-md shadow cursor-grab active:cursor-grabbing"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
            />
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
            >
              <Upload className="h-12 w-12" />
              <span className="text-lg font-medium">
                Cliquez pour télécharger une image
              </span>
              <span className="text-sm">PNG, JPG, GIF — max 5 Mo</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold font-[family-name:var(--font-heading)]">
                Blocs de texte
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={addTextBlock}
                disabled={!image}
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>

            {image && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 self-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Changer l'image
              </Button>
            )}

            <Separator />

            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {textBlocks.map((block, i) => (
                <div
                  key={block.id}
                  onClick={() => setSelectedId(block.id)}
                  className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                    block.id === selectedId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <GripVertical className="h-3 w-3" />
                      Texte {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <Input
                    placeholder="Votre texte..."
                    value={block.text}
                    onChange={(e) =>
                      updateBlock(block.id, { text: e.target.value })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />

                  {block.id === selectedId && (
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs whitespace-nowrap">
                          Taille : {block.fontSize}px
                        </Label>
                        <input
                          type="range"
                          min="16"
                          max="100"
                          value={block.fontSize}
                          onChange={(e) =>
                            updateBlock(block.id, {
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="flex-1 accent-primary"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-xs">Couleur</Label>
                        <input
                          type="color"
                          value={block.color}
                          onChange={(e) =>
                            updateBlock(block.id, { color: e.target.value })
                          }
                          className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <label className="flex items-center gap-1 text-xs ml-auto">
                          <input
                            type="checkbox"
                            checked={block.uppercase}
                            onChange={(e) =>
                              updateBlock(block.id, {
                                uppercase: e.target.checked,
                              })
                            }
                          />
                          MAJUSCULES
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {textBlocks.length === 0 && image && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Cliquez «Ajouter» pour créer un bloc de texte
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h3 className="font-semibold font-[family-name:var(--font-heading)]">
              Actions
            </h3>
            <Button
              onClick={saveMeme}
              disabled={!image || saving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
            <Button
              variant="outline"
              onClick={downloadMeme}
              disabled={!image}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
            <Button
              variant="outline"
              onClick={shareMeme}
              disabled={!image}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Partager
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
