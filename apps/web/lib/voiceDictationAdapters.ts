"use client";

import { WebSpeechDictationAdapter } from "@assistant-ui/react";
import type { DictationAdapter } from "@assistant-ui/react";
import { correctMedicalTerms } from "@/lib/medicalTermsCorrection";

/**
 * Native assistant-ui dictation adapters, used with ComposerPrimitive.Dictate
 * / StopDictation / DictationTranscript (see components/assistant-ui/thread.tsx).
 * These replace the old floating custom VoiceInputButton components — text
 * now lands directly in the composer via the runtime's `adapters.dictation`,
 * the same mechanism ChatKit's setComposerValue achieved manually.
 */

/**
 * Wraps assistant-ui's built-in WebSpeechDictationAdapter (browser
 * SpeechRecognition) and runs final transcripts through the existing medical
 * term correction dictionary before they land in the composer.
 */
export function createWebSpeechDictationAdapter(): DictationAdapter | undefined {
  if (!WebSpeechDictationAdapter.isSupported()) return undefined;

  const inner = new WebSpeechDictationAdapter({ interimResults: true });

  return {
    listen: () => {
      const session = inner.listen();
      return {
        ...session,
        onSpeech: (callback) =>
          session.onSpeech((result) => {
            if (result.isFinal === false) {
              callback(result);
              return;
            }
            callback({ ...result, transcript: correctMedicalTerms(result.transcript) });
          }),
      };
    },
  };
}

/**
 * Custom DictationAdapter backed by the existing /api/whisper endpoint
 * (OpenAI Whisper). Records audio via MediaRecorder while the session is
 * active, then transcribes the full clip once stopped — there is no interim
 * preview, so input stays disabled until the final text lands.
 */
export class WhisperDictationAdapter implements DictationAdapter {
  disableInputDuringDictation = true;

  listen(): DictationAdapter.Session {
    const startCallbacks = new Set<() => void>();
    const endCallbacks = new Set<(result: DictationAdapter.Result) => void>();
    const speechCallbacks = new Set<(result: DictationAdapter.Result) => void>();

    const chunks: BlobPart[] = [];
    let mediaRecorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const session: DictationAdapter.Session = {
      status: { type: "starting" },

      stop: async () => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") return;
        mediaRecorder.stop();
        await new Promise<void>((resolve) => {
          const check = () => {
            if (session.status.type === "ended") resolve();
            else setTimeout(check, 50);
          };
          check();
        });
      },

      cancel: () => {
        cancelled = true;
        mediaRecorder?.stop();
        stream?.getTracks().forEach((t) => t.stop());
        session.status = { type: "ended", reason: "cancelled" };
      },

      onSpeechStart: (callback) => {
        startCallbacks.add(callback);
        return () => startCallbacks.delete(callback);
      },
      onSpeechEnd: (callback) => {
        endCallbacks.add(callback);
        return () => endCallbacks.delete(callback);
      },
      onSpeech: (callback) => {
        speechCallbacks.add(callback);
        return () => speechCallbacks.delete(callback);
      },
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = mediaStream;
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (cancelled) return;

          try {
            const audioBlob = new Blob(chunks, { type: "audio/webm" });
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            const response = await fetch("/api/whisper", { method: "POST", body: formData });
            const data = await response.json();
            const text: string = data?.success && data.text ? correctMedicalTerms(data.text) : "";
            if (text) {
              const result: DictationAdapter.Result = { transcript: text, isFinal: true };
              speechCallbacks.forEach((cb) => cb(result));
              endCallbacks.forEach((cb) => cb(result));
            }
          } catch (err) {
            console.error("[WhisperDictationAdapter] transcription failed:", err);
          } finally {
            session.status = { type: "ended", reason: "stopped" };
          }
        };

        mediaRecorder.start();
        session.status = { type: "running" };
        startCallbacks.forEach((cb) => cb());
      })
      .catch((err) => {
        console.error("[WhisperDictationAdapter] microphone access failed:", err);
        session.status = { type: "ended", reason: "error" };
      });

    return session;
  }
}
