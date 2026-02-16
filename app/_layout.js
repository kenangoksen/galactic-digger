import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import { loadAssetsAsync } from "../utils/assetLoader";

export default function Layout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Sistem Başlatılıyor...");

  useEffect(() => {
    async function prepare() {
      try {
        // Start Loading
        const startTime = Date.now();

        // 1. Motorlar Isınıyor (Initial Phase)
        setStatus("Warming up engines...");
        await new Promise(resolve => setTimeout(resolve, 800)); // Min wait for first stage

        // 2. Load Assets with Progress
        await loadAssetsAsync((p) => {
            // Map asset progress (0-1) to UI progress (0.1 - 0.9)
            // Leave 0-0.1 for start and 0.9-1.0 for finalization
            const uiProgress = 0.1 + (p * 0.8);
            setProgress(uiProgress);

            // Dynamic Text based on progress
            if (uiProgress < 0.4) {
                setStatus("Warming up engines...");
            } else if (uiProgress < 0.7) {
                setStatus("Discovering planets...");
            } else {
                setStatus("Preparing miners...");
            }
        });

        // Ensure minimum time (2500ms total)
        const elapsed = Date.now() - startTime;
        const minTime = 2500;
        if (elapsed < minTime) {
            await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
        }

        // Finalize
        setProgress(1.0);
        setStatus("Ready for Launch!");
        await new Promise(resolve => setTimeout(resolve, 600)); // Show 100% briefly

      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return <LoadingScreen progress={progress} status={status} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
