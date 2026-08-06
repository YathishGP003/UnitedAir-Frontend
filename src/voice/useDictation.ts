import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionLike;

export function useDictation(onText: (text: string) => void) {
  const Recognition = (
    window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    }
  ).SpeechRecognition ?? (
    window as typeof window & { webkitSpeechRecognition?: RecognitionConstructor }
  ).webkitSpeechRecognition;
  const supported = Boolean(Recognition);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Recognition || listening) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index++) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      if (transcript.trim()) onText(transcript.trim());
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed"
        ? "Microphone permission is blocked by this browser."
        : "Dictation stopped unexpectedly.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  }, [Recognition, listening, onText]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, listening, start, stop, error };
}
