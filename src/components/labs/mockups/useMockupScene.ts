"use client";
import * as React from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/store/project";
import { prepareSceneAssets, type PreparedScene } from "@/lib/mockups/render";

/**
 * Rasterised logos + loaded brand fonts for the mockup renderer.
 * Re-prepared whenever the Genome revision or the SVG assets change.
 */
export function useMockupScene(): { prepared: PreparedScene | null; loading: boolean } {
  const genomeId = useProject((s) => s.genome?.id ?? "");
  const rev = useProject((s) => s.rev);
  const assetSig = useProject((s) => s.assets.filter((a) => a.kind === "svg").map((a) => a.id).join(","));
  const key = `${genomeId}:${rev}:${assetSig}`;
  const [state, setState] = React.useState<{ key: string; prepared: PreparedScene } | null>(null);

  React.useEffect(() => {
    const { genome, assets } = useProject.getState();
    if (!genome) return;
    let alive = true;
    prepareSceneAssets(genome, assets)
      .then((prepared) => {
        if (alive) setState({ key, prepared });
      })
      .catch((e: unknown) => {
        if (alive) toast.error(e instanceof Error ? e.message : "Could not prepare the mockup scene");
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return { prepared: state?.prepared ?? null, loading: !state || state.key !== key };
}
