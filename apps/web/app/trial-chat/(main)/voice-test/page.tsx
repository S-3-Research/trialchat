"use client";

import { useState, useEffect } from "react";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { VoiceInputButtonWhisper } from "@/components/VoiceInputButtonWhisper";
import DevGate from "@/components/DevGate";

function VoiceTestPageInner() {
  const [webSpeechTranscript, setWebSpeechTranscript] = useState("");
  const [whisperTranscript, setWhisperTranscript] = useState("");
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [protocol, setProtocol] = useState("");
  const [hasSpeechAPI, setHasSpeechAPI] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsSecureContext(window.isSecureContext);
    setProtocol(window.location.protocol);
    setHasSpeechAPI('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setUserAgent(navigator.userAgent);
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    
    console.log('[VoiceTest] User Agent:', navigator.userAgent);
    console.log('[VoiceTest] Is Secure Context:', window.isSecureContext);
    console.log('[VoiceTest] SpeechRecognition available:', 'SpeechRecognition' in window);
    console.log('[VoiceTest] webkitSpeechRecognition available:', 'webkitSpeechRecognition' in window);
  }, []);

  const handleWebSpeechTranscript = (text: string) => {
    console.log("[VoiceTestPage] Web Speech API transcript:", text);
    setWebSpeechTranscript((prev) => prev + " " + text);
  };

  const handleWhisperTranscript = (text: string) => {
    console.log("[VoiceTestPage] Whisper API transcript:", text);
    setWhisperTranscript((prev) => prev + " " + text);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Voice Input Comparison: Web Speech API vs Whisper
        </h1>

        {/* Diagnostic Info */}
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
            🔍 Environment Check
          </h3>
          <ul className="text-xs text-yellow-800 dark:text-yellow-400 space-y-1 font-mono">
            <li>Protocol: {protocol || "loading..."}</li>
            <li>Secure Context: {isSecureContext ? "✅ Yes" : "❌ No"}</li>
            <li>Speech API Available: {hasSpeechAPI ? "✅ Yes" : "❌ No"}</li>
            <li>Device: {isMobile ? "📱 Mobile" : "💻 Desktop"}</li>
            <li>Hostname: {typeof window !== 'undefined' ? window.location.hostname : "loading..."}</li>
            <li className="break-all">User Agent: {userAgent || "loading..."}</li>
          </ul>
          {!isSecureContext && (
            <p className="mt-3 text-sm text-yellow-900 dark:text-yellow-300 font-semibold">
              ⚠️ Not a secure context! Voice input requires HTTPS on mobile.
            </p>
          )}
          {isMobile && !hasSpeechAPI && isSecureContext && (
            <p className="mt-3 text-sm text-red-900 dark:text-red-300 font-semibold">
              ❌ Web Speech API not available on this mobile browser/version!
              <br />Try using Chrome (Android) or Safari (iOS 14.5+).
            </p>
          )}
        </div>

        {/* Side by side comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Web Speech API */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <span className="text-2xl">🌐</span>
              Web Speech API
            </h2>
            <textarea
              value={webSpeechTranscript}
              onChange={(e) => setWebSpeechTranscript(e.target.value)}
              className="w-full h-32 p-4 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              placeholder="Real-time transcription..."
            />
            <div className="flex justify-center items-center h-24 relative mb-3">
              <VoiceInputButton onTranscript={handleWebSpeechTranscript} />
            </div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>✅ Real-time results</li>
              <li>✅ No API costs</li>
              <li>✅ Instant feedback</li>
              <li>⚠️ Browser dependent</li>
              <li>⚠️ Requires HTTPS</li>
            </ul>
            <button
              onClick={() => setWebSpeechTranscript("")}
              className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              Clear
            </button>
          </div>

          {/* Whisper API */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              OpenAI Whisper
            </h2>
            <textarea
              value={whisperTranscript}
              onChange={(e) => setWhisperTranscript(e.target.value)}
              className="w-full h-32 p-4 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              placeholder="Transcription after recording..."
            />
            <div className="flex justify-center items-center h-24 relative mb-3">
              <VoiceInputButtonWhisper onTranscript={handleWhisperTranscript} />
            </div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>✅ High accuracy</li>
              <li>✅ Works everywhere</li>
              <li>✅ No browser limits</li>
              <li>⚠️ API costs apply</li>
              <li>⚠️ Processing delay</li>
            </ul>
            <button
              onClick={() => setWhisperTranscript("")}
              className="mt-4 w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            📊 Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Feature</th>
                  <th className="text-center py-2 px-3 text-blue-600 dark:text-blue-400">Web Speech</th>
                  <th className="text-center py-2 px-3 text-purple-600 dark:text-purple-400">Whisper</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 px-3">Speed</td>
                  <td className="text-center">⚡ Real-time</td>
                  <td className="text-center">🕐 2-5 seconds</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 px-3">Accuracy</td>
                  <td className="text-center">Good</td>
                  <td className="text-center">Excellent</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 px-3">Cost</td>
                  <td className="text-center">Free</td>
                  <td className="text-center">$0.006/min</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 px-3">Browser Support</td>
                  <td className="text-center">Chrome, Safari</td>
                  <td className="text-center">All (via API)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Medical Terms</td>
                  <td className="text-center">Needs correction</td>
                  <td className="text-center">Better recognition</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            💡 Try both and compare the results! Check browser console for debug logs.
          </p>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            🛠️ Setup HTTPS for Mobile Testing
          </h3>
          <div className="text-xs text-blue-800 dark:text-blue-400 space-y-2">
            <p className="font-semibold">Option 1: Using ngrok (easiest)</p>
            <pre className="bg-blue-100 dark:bg-blue-950 p-2 rounded overflow-x-auto">
              brew install ngrok{'\n'}
              ngrok http 3000
            </pre>
            <p className="font-semibold mt-3">Option 2: Local HTTPS</p>
            <pre className="bg-blue-100 dark:bg-blue-950 p-2 rounded overflow-x-auto">
              npm install --save-dev mkcert{'\n'}
              npx mkcert create-ca{'\n'}
              npx mkcert create-cert
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VoiceTestPage() {
  return (
    <DevGate>
      <VoiceTestPageInner />
    </DevGate>
  );
}
