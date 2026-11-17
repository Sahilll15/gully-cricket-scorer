import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useShareJob } from "@/lib/share";
import { FullCard, SmallCard } from "./ScorecardImages";
import { MatchPoster, WinnerPoster } from "./Posters";

/** Renders the requested scorecard or poster offscreen at 360pt wide, captures it at 1080px wide and opens the share sheet. */
export function ShareHost() {
  const job = useShareJob((s) => s.job);
  const ref = useRef<ComponentRef<typeof View> | null>(null);
  const [h, setH] = useState(0);
  useEffect(() => { if (!job) setH(0); }, [job]);
  useEffect(() => {
    if (!job || !h) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let ok = false;
      try {
        const uri = await captureRef(ref as never, { format: "png", quality: 1, width: 1080, height: Math.round((1080 * h) / 360), result: "tmpfile" });
        if (!cancelled) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: job.kind === "match" || job.kind === "winner" ? "Send poster" : "Send scorecard" });
        ok = true;
      } catch { /* cancelled or capture failed */ }
      useShareJob.setState({ job: null });
      job.done(ok);
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [job, h]);
  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: -10000, top: 0 }}>
      <View ref={ref} collapsable={false} onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ width: 360, backgroundColor: job.kind === "match" || job.kind === "winner" ? "#0b0d0c" : "#050507" }}>
        {job.kind === "full" ? <FullCard m={job.m} /> : job.kind === "match" ? <MatchPoster m={job.m} /> : job.kind === "winner" ? <WinnerPoster m={job.m} /> : <SmallCard m={job.m} />}
      </View>
    </View>
  );
}
