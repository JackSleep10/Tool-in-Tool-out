import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Shared QR scanner hook that:
 * - keeps callbacks fresh via refs (no stale closures across data refreshes)
 * - stops and clears the camera stream on close or component unmount
 * - handles cancellation if the user closes/unmounts before camera startup finishes
 */
export function useQrScanner({ elementId, onScan, onError }) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  onScanRef.current = onScan;
  onErrorRef.current = onError;

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(() => {
    setIsScanning(true);
  }, []);

  useEffect(() => {
    if (!isScanning) return undefined;

    let cancelled = false;
    let instance = null;
    let handled = false;

    const cleanupInstance = (target) => {
      if (!target) return;
      const stopPromise = target.isScanning ? target.stop() : Promise.resolve();
      stopPromise
        .then(() => {
          try {
            target.clear();
          } catch (_) {
            // ignore clear error after unmount
          }
        })
        .catch(() => {
          // ignore stop error when camera failed or was already stopped
        });
    };

    const timer = setTimeout(() => {
      if (cancelled) return;
      const container = document.getElementById(elementId);
      if (!container) return;

      instance = new Html5Qrcode(elementId);
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (cancelled || handled) return;
            if (!decodedText || !decodedText.trim()) return;
            handled = true;
            if (onScanRef.current) {
              onScanRef.current(decodedText.trim(), () => setIsScanning(false));
            }
          },
          () => {}
        )
        .then(() => {
          if (cancelled) {
            cleanupInstance(instance);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setIsScanning(false);
            if (onErrorRef.current) {
              onErrorRef.current(err);
            }
          }
        });
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const target = scannerRef.current || instance;
      scannerRef.current = null;
      cleanupInstance(target);
    };
  }, [isScanning, elementId]);

  return { isScanning, startScanning, stopScanning };
}
