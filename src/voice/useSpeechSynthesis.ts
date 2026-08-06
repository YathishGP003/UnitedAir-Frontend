import { useCallback, useEffect, useState } from "react";
import { cleanSpeechText } from "./speechText";

const VOICE_KEY = "unitedair.voice";
const RATE_KEY = "unitedair.speech-rate";

export function useSpeechSynthesis() {
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (id: string, markdown: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanSpeechText(markdown));
      const preferred = localStorage.getItem(VOICE_KEY);
      utterance.voice = voices.find((voice) => voice.voiceURI === preferred) ?? null;
      utterance.rate = Number(localStorage.getItem(RATE_KEY) ?? "1") || 1;
      utterance.onend = () => {
        setSpeakingId(null);
        setPaused(false);
      };
      utterance.onerror = utterance.onend;
      setSpeakingId(id);
      setPaused(false);
      window.speechSynthesis.speak(utterance);
    },
    [supported, voices],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  return { supported, speakingId, paused, speak, pause, resume, stop, voices };
}
