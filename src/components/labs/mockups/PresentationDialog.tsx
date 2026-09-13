"use client";
import * as React from "react";
import { toast } from "sonner";
import { Download, ImagePlus } from "lucide-react";
import { Button, Dialog, Spinner } from "@/components/ui";
import { useProject } from "@/lib/store/project";
import { canvasToBlob } from "@/lib/raster";
import { downloadBlob, slugify } from "@/lib/utils";
import { featuredTemplates, type MockupScene } from "@/lib/mockups/templates";
import { renderBoard } from "@/lib/mockups/render";

export function PresentationDialog({ open, onClose, scene }: { open: boolean; onClose: () => void; scene: MockupScene | null }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const addAsset = useProject((s) => s.addAsset);
  const templates = React.useMemo(() => featuredTemplates(6), []);
  const [busy, setBusy] = React.useState<"export" | "save" | null>(null);
  const [painted, setPainted] = React.useState(false);

  React.useEffect(() => {
    if (!open || !scene) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raf = requestAnimationFrame(() => {
      try {
        const board = renderBoard(templates, scene, { scale: 1 });
        canvas.width = board.width;
        canvas.height = board.height;
        canvas.getContext("2d")!.drawImage(board, 0, 0);
        setPainted(true);
      } catch (e) {
        console.error("Presentation board failed", e);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, scene, templates]);

  const boardBlob = async () => {
    if (!scene) throw new Error("Scene not ready");
    const board = renderBoard(templates, scene, { scale: 2 });
    return { blob: await canvasToBlob(board, "image/png"), width: board.width, height: board.height };
  };

  const exportPng = async () => {
    setBusy("export");
    try {
      const { blob } = await boardBlob();
      downloadBlob(blob, `${slugify(scene?.text.name ?? "brand")}-presentation-board.png`);
      toast.success("Board PNG downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const saveBoard = async () => {
    setBusy("save");
    try {
      const { blob, width, height } = await boardBlob();
      await addAsset({ kind: "image", name: `Presentation board — ${scene?.text.name ?? "mockups"}`, mime: "image/png", blob, width, height, stage: "mockups", tags: ["mockup", "board"] });
      toast.success("Board saved to assets");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save asset");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} wide title="Presentation board" description="The six key applications on one board, ready for a client deck." className="max-w-6xl">
      <div className="relative inset overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-auto" aria-label="Presentation board preview" />
        {(!scene || !painted) && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-fg-muted">
            <Spinner /> Composing board…
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="text-xs text-fg-muted">{templates.map((t) => t.name).join(" · ")}</div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={saveBoard} disabled={!scene || !!busy} loading={busy === "save"}>
            <ImagePlus className="h-4 w-4" /> Save to assets
          </Button>
          <Button size="sm" onClick={exportPng} disabled={!scene || !!busy} loading={busy === "export"}>
            <Download className="h-4 w-4" /> Export board PNG
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
