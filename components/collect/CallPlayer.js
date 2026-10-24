"use client";
import { useEffect, useState } from "react";
import { btn } from "./client";

// Reads an automatic call's script aloud with the browser's own voice (Hindi or Indian English when the device has one).
// The demo makes no phone call; this lets the owner, or a judge, hear exactly what the customer would hear.
export default function CallPlayer({ text, lang, labels }) {
  const [state, setState] = useState("idle"); // idle | playing | unsupported
  useEffect(() => {
    if (!("speechSynthesis" in window)) setState("unsupported");
    return () => window.speechSynthesis?.cancel();
  }, []);

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const want = lang === "hi" ? "hi-IN" : "en-IN";
    const voices = synth.getVoices();
    u.lang = want;
    u.voice = voices.find((v) => v.lang === want) ?? voices.find((v) => v.lang.startsWith(lang)) ?? null;
    u.rate = 0.95;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    setState("playing");
    synth.speak(u);
  }

  if (state === "unsupported") return <p className="text-sm text-ink-muted">{labels.unsupported}</p>;
  return state === "playing" ? (
    <button type="button" className={btn("secondary")} onClick={() => { window.speechSynthesis.cancel(); setState("idle"); }}>
      {labels.stop}
    </button>
  ) : (
    <button type="button" className={btn("primary")} onClick={play}>
      {labels.play}
    </button>
  );
}
