import React, { useState, useRef, useEffect, useCallback } from "react";

import {
  DRAW_PALETTE,
  FRIEND_NAMES,
  AGENT_WRAP,
} from "../lib/constants.js";
import { clamp, cl, moodOf } from "../lib/mood.js";
import { rng } from "../lib/random.js";
import { genCreature } from "../lib/creature.js";
import { loadSaved, saveThrottled } from "../lib/storage.js";
import { HeartIcon } from "./HeartIcon.jsx";

/* ----------------------------------------------------------------------------
   Cozy pixel-art Tamagotchi companion
   - Draw your own 32x32 pixel creature, name it, bring it to life
   - It lives on a warm screen, bobs, reacts, and chats back (Claude API)
   - Feed / play / nap / love care actions with floating-heart bursts
   - "The meadow": a therapeutic field where your creature wanders among
     other little pixel friends
   Faithful recreation of the Claude Design handoff "Companion.dc.html".
---------------------------------------------------------------------------- */

export default function Companion() {
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("draw"); // draw | live | paradise
  const [name, setName] = useState("");
  const [drawing, setDrawing] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);

  const [color, setColor] = useState("#4A4038");
  const [size, setSize] = useState(2);
  const [tool, setTool] = useState("brush");

  const [fullness, setFullness] = useState(80);
  const [happiness, setHappiness] = useState(80);
  const [energy, setEnergy] = useState(80);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const [particles, setParticles] = useState([]);
  const [pop, setPop] = useState(false);
  const [bubble, setBubble] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [hover, setHover] = useState(null);
  const [agents, setAgents] = useState([]);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const toolRef = useRef({ color, size, tool });
  const screenRef = useRef(screen);
  const stateRef = useRef({});
  const simRef = useRef({});
  const nodesRef = useRef({});
  const fieldRef = useRef(null);
  const meadowRef = useRef(null);
  const motesRef = useRef(null);
  const popT = useRef(null);
  const bubT = useRef(null);

  useEffect(() => { toolRef.current = { color, size, tool }; }, [color, size, tool]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => {
    stateRef.current = { name, drawing, fullness, happiness, energy, messages };
  }, [name, drawing, fullness, happiness, energy, messages]);

  // Google fonts (graceful fallback to system rounded if blocked)
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);

  // Load saved pet once
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadSaved();
      if (alive && saved && saved.drawing) {
        const dt = Math.max(0, (Date.now() - (saved.t || Date.now())) / 1000);
        const dec = Math.min(40, dt / 45);
        setName(saved.name || "");
        setDrawing(saved.drawing);
        setHasDrawn(true);
        setFullness(cl((saved.fullness != null ? saved.fullness : 80) - dec, 12));
        setEnergy(cl((saved.energy != null ? saved.energy : 80) - dec * 0.7, 12));
        setHappiness(cl((saved.happiness != null ? saved.happiness : 80) - dec * 0.6, 14));
        setMessages(saved.messages || []);
        setScreen("live");
      }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const persist = useCallback(() => {
    const s = stateRef.current;
    if (!s.drawing) return;
    saveThrottled({
      drawing: s.drawing, name: s.name,
      fullness: s.fullness, happiness: s.happiness, energy: s.energy,
      messages: (s.messages || []).slice(-30), t: Date.now(),
    });
  }, []);

  // Stat decay / restore tick
  useEffect(() => {
    const id = setInterval(() => {
      const sc = screenRef.current;
      if (sc === "live") {
        setFullness((f) => clamp(f - 0.6));
        setEnergy((e) => clamp(e - 0.4));
        setHappiness((h) => {
          const s = stateRef.current;
          return clamp(h - 0.35 + (s.fullness > 60 && s.energy > 50 ? 0.35 : 0));
        });
        persist();
      } else if (sc === "paradise") {
        setHappiness((h) => clamp(h + 0.8));
        setEnergy((e) => clamp(e + 0.4));
        persist();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [persist]);

  // ---------- drawing ----------
  useEffect(() => {
    if (!loaded || screen !== "draw") return;
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctxRef.current = ctx;
    const G = el.width;
    let painting = false, lcx = 0, lcy = 0;

    const paint = (cxp, cyp) => {
      const { color: col, size: b, tool: tl } = toolRef.current;
      const off = Math.floor((b - 1) / 2);
      if (tl === "eraser") ctx.clearRect(cxp - off, cyp - off, b, b);
      else { ctx.fillStyle = col; ctx.fillRect(cxp - off, cyp - off, b, b); }
    };
    const cell = (e) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.floor(((e.clientX - r.left) / r.width) * G),
        y: Math.floor(((e.clientY - r.top) / r.height) * G),
      };
    };
    const line = (x0, y0, x1, y1) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      if (steps === 0) { paint(x0, y0); return; }
      for (let i = 0; i <= steps; i++)
        paint(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps));
    };
    const start = (e) => {
      e.preventDefault(); painting = true;
      const c = cell(e); lcx = c.x; lcy = c.y; paint(c.x, c.y);
      setHasDrawn(true);
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const move = (e) => {
      if (!painting) return; e.preventDefault();
      const c = cell(e); line(lcx, lcy, c.x, c.y); lcx = c.x; lcy = c.y;
    };
    const end = () => { painting = false; };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointerleave", end);
    };
  }, [screen, loaded]);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c && ctxRef.current) ctxRef.current.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };

  const create = () => {
    if (!(hasDrawn && name.trim()) || !canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const nm = name.trim();
    setDrawing(url); setName(nm); setScreen("live");
    setMessages([{ role: "pet", text: "hi, i'm " + nm + ", lovely to meet you! ♡" }]);
    setTimeout(persist, 0);
  };

  // ---------- reactions ----------
  const react = () => {
    setPop(true);
    clearTimeout(popT.current);
    popT.current = setTimeout(() => setPop(false), 260);
  };
  const say = (t) => {
    setBubble(t); setShowBubble(true);
    clearTimeout(bubT.current);
    bubT.current = setTimeout(() => setShowBubble(false), 2200);
  };
  const burst = (kind) => {
    const cols = kind === "food" ? ["#C2876B", "#D9B26A"] : ["#C98B86", "#C2876B"];
    const add = [];
    for (let i = 0; i < 5; i++)
      add.push({
        id: Date.now() + "_" + i + "_" + Math.random(),
        left: 26 + Math.random() * 48 + "%",
        color: cols[i % cols.length],
      });
    setParticles((p) => [...p, ...add]);
    const ids = add.map((a) => a.id);
    setTimeout(() => setParticles((p) => p.filter((x) => ids.indexOf(x.id) < 0)), 960);
  };

  const feed = () => {
    react(); say("mmm, yum"); burst("food");
    setFullness((f) => clamp(f + 22)); setHappiness((h) => clamp(h + 4));
    setTimeout(persist, 0);
  };
  const play = () => {
    if (energy < 12) { say("too sleepy to play…"); return; }
    react(); say("wheee!"); burst("heart");
    setHappiness((h) => clamp(h + 20));
    setEnergy((e) => clamp(e - 13));
    setFullness((f) => clamp(f - 4));
    setTimeout(persist, 0);
  };
  const nap = () => {
    say("zzz…");
    setEnergy((e) => clamp(e + 26)); setHappiness((h) => clamp(h + 2));
    setTimeout(persist, 0);
  };
  const petPet = () => {
    react(); say("♡"); burst("heart");
    setHappiness((h) => clamp(h + 6));
    setTimeout(persist, 0);
  };
  const startOver = () => {
    setScreen("draw"); setName(""); setDrawing(""); setHasDrawn(false);
    setColor("#4A4038"); setSize(2); setTool("brush");
    setFullness(80); setHappiness(80); setEnergy(80);
    setMessages([]); setInput(""); setThinking(false);
    setParticles([]); setShowBubble(false); setBubble("");
  };

  // ---------- meadow ----------
  const buildFriends = () => {
    const n = 11 + Math.floor(Math.random() * 4);
    const arr = [];
    for (let i = 0; i < n; i++)
      arr.push({
        id: "f" + i, name: FRIEND_NAMES[i % FRIEND_NAMES.length],
        src: genCreature(1000 + i * 97 + i * i), isYou: false,
        bob: (2.2 + (i % 5) * 0.22).toFixed(2) + "s",
      });
    return arr;
  };
  const enterParadise = () => {
    if (!drawing) return;
    const friends = buildFriends();
    const you = { id: "you", name: name || "you", src: drawing, isYou: true, bob: "2.5s" };
    const all = [...friends, you];
    const sim = {};
    all.forEach((a) => {
      const x = 8 + Math.random() * 84, y = 52 + Math.random() * 38;
      sim[a.id] = { x, y, tx: x, ty: y, wait: Math.random() * 2.5, flip: 1, spd: 3.5 + Math.random() * 3.5 };
    });
    simRef.current = sim;
    nodesRef.current = {};
    setAgents(all);
    setScreen("paradise");
  };
  const leaveParadise = () => {
    clearInterval(fieldRef.current);
    setScreen("live");
    setTimeout(persist, 0);
  };

  // wandering simulation
  useEffect(() => {
    if (screen !== "paradise" || !agents.length) return;
    const collect = () => {
      nodesRef.current = {};
      const root = meadowRef.current;
      if (!root) return;
      root.querySelectorAll("[data-agent]").forEach((nde) => {
        nodesRef.current[nde.getAttribute("data-agent")] = nde;
      });
    };
    const placeOne = (id) => {
      const a = simRef.current[id], node = nodesRef.current[id];
      if (!a || !node) return;
      const scale = 0.5 + ((a.y - 52) / 38) * 0.72;
      node.style.left = a.x + "%";
      node.style.top = a.y + "%";
      node.style.transform = "translate(-50%,-100%) scale(" + scale * a.flip + "," + scale + ")";
      node.style.zIndex = Math.round(a.y * 10);
    };
    collect();
    Object.keys(simRef.current).forEach(placeOne);
    let last = performance.now();
    fieldRef.current = setInterval(() => {
      if (screenRef.current !== "paradise") { clearInterval(fieldRef.current); return; }
      if (Object.keys(nodesRef.current).length === 0) {
        collect(); Object.keys(simRef.current).forEach(placeOne);
      }
      const now = performance.now();
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      Object.keys(sim).forEach((id) => {
        const a = sim[id];
        if (a.wait > 0) { a.wait -= dt; }
        else {
          const dx = a.tx - a.x, dy = a.ty - a.y;
          const d = Math.hypot(dx, dy);
          if (d < 0.7) {
            a.tx = 8 + Math.random() * 84; a.ty = 52 + Math.random() * 38;
            a.wait = 1.2 + Math.random() * 3.5;
          } else {
            const sp = a.spd * dt;
            a.x += (dx / d) * sp; a.y += (dy / d) * sp;
            if (Math.abs(dx) > 0.05) a.flip = dx < 0 ? -1 : 1;
          }
        }
        placeOne(id);
      });
    }, 33);
    return () => clearInterval(fieldRef.current);
  }, [screen, agents]);

  // floating motes (generated once)
  if (!motesRef.current) {
    const mr = rng(7);
    motesRef.current = [];
    for (let i = 0; i < 16; i++)
      motesRef.current.push({
        key: "m" + i,
        style: {
          position: "absolute", left: 4 + mr() * 92 + "%", top: 55 + mr() * 40 + "%",
          width: "4px", height: "4px", borderRadius: "50%",
          background: "rgba(255,248,222,.9)", boxShadow: "0 0 4px rgba(255,244,206,.8)",
          pointerEvents: "none",
          animation: "tg-mote " + (7 + mr() * 7).toFixed(1) + "s ease-in infinite",
          animationDelay: "-" + (mr() * 9).toFixed(1) + "s",
        },
      });
  }

  // ---------- chat ----------
  async function getReply(text, msgs) {
    const s = stateRef.current;
    const m = moodOf(s);
    const persona =
      "You are " + s.name + ", a small cozy companion creature (a tamagotchi-like pet) that the human drew themselves. " +
      "You are affectionate, playful, a little silly, and warm. You are NOT an AI assistant — you're their little pet friend. " +
      "Reply in 1-2 short, casual, lowercase sentences, no markdown, at most one heart or cute symbol. " +
      "Right now you feel " + m.label + " (fullness " + Math.round(s.fullness) + "/100, joy " + Math.round(s.happiness) + "/100, energy " + Math.round(s.energy) + "/100); let that gently color your tone " +
      "(sleepy = drowsy, hungry = mention wanting a snack, blue = need cheering). ";
    const hist = msgs.slice(-7).map((x) => (x.role === "me" ? "Human" : s.name) + ": " + x.text).join("\n");
    const prompt = persona + "\n\nRecent chat:\n" + hist + "\n\nReply as " + s.name + " (just the words, no name prefix):";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      let r = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      r = r.replace(/^["']+|["']+$/g, "");
      r = r.replace(new RegExp("^" + s.name + "\\s*:\\s*", "i"), "").trim();
      if (r) return r;
    } catch (e) { /* fall through to canned line */ }
    const fb = [
      "mmm i was just daydreaming about snacks ♡", "tell me more, i'm all ears",
      "i missed you, you know", "*nuzzles closer*",
      "that makes me really happy", "ooh, what else?",
    ];
    return fb[Math.floor(Math.random() * fb.length)];
  }
  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const msgs = [...messages, { role: "me", text }];
    setMessages(msgs); setInput(""); setThinking(true);
    const reply = await getReply(text, msgs);
    setMessages((prev) => [...prev, { role: "pet", text: reply }]);
    setThinking(false);
    setHappiness((h) => clamp(h + 3));
    setTimeout(persist, 0);
  };

  // ---------- derived ----------
  const s = { fullness, happiness, energy };
  const m = moodOf(s);
  const lastPet = [...messages].reverse().find((mm) => mm.role === "pet");
  let bubbleText = showBubble ? bubble : (lastPet ? lastPet.text : ("hi! i'm " + (name || "your friend") + ", lovely to meet you! ♡"));
  if (thinking) bubbleText = "· · ·";
  const canCreate = !!(hasDrawn && name.trim());

  const careBtns = [
    { key: "love", color: "#C98B86", tip: "give love to your tamagotchi", onClick: petPet,
      icon: <HeartIcon width="24" height="24" /> },
    { key: "feed", color: "#C2876B", tip: "feed your tamagotchi", onClick: feed,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="M5 12a7 7 0 0 0 14 0" /><path d="M9 8c0-2 1-3.5 3-3.5S15 6 15 8" /></svg> },
    { key: "play", color: "#93A285", tip: "play with your tamagotchi", onClick: play,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17" /><path d="M3.5 12h17" /></svg> },
    { key: "nap", color: "#8FA3B0", tip: "let your tamagotchi nap", onClick: nap,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg> },
  ];

  const KEYFRAMES = `
    @keyframes tg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
    @keyframes tg-float{0%{opacity:0;transform:translateY(0) scale(.5)}18%{opacity:1}100%{opacity:0;transform:translateY(-74px) scale(1.05)}}
    @keyframes tg-fade{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
    @keyframes tg-cloud{from{transform:translateX(-130%)}to{transform:translateX(560%)}}
    @keyframes tg-mote{0%{transform:translateY(0) translateX(0);opacity:0}18%{opacity:.6}100%{transform:translateY(-130px) translateX(16px);opacity:0}}
    @keyframes tg-appear{from{opacity:0}to{opacity:1}}
    .tg-care:hover{transform:translateY(-4px)!important}
    .tg-icon-btn:hover{background:#fff!important;color:#7A6A58!important}
    .tg-meadow-btn:hover{transform:translateY(-2px)}
    .tg-home:hover{background:#fff!important}
  `;

  const font = "'Nunito', ui-rounded, system-ui, sans-serif";
  const display = "'Baloo 2', ui-rounded, system-ui, sans-serif";

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "18px", fontFamily: font,
      background: "radial-gradient(125% 85% at 50% 0%, #F4EBDA 0%, #E8DBC4 60%, #E0D1B6 100%)",
    }}>
      <style>{KEYFRAMES}</style>
      <div style={{
        display: "flex", flexDirection: "column", width: "100%", maxWidth: "440px",
        height: "calc(100vh - 36px)", maxHeight: "856px", minHeight: "560px",
        background: "#FBF7EE", borderRadius: "30px", overflow: "hidden",
        border: "1px solid #EFE4D2",
        boxShadow: "0 28px 64px -22px rgba(74,64,56,.4), 0 1px 0 #fff inset",
      }}>

        {/* ---------------- DRAW ---------------- */}
        {loaded && screen === "draw" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ padding: "24px 22px 6px", textAlign: "center" }}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: "24px", color: "#4A4038", lineHeight: 1.1 }}>draw your friend</div>
              <div style={{ fontSize: "13px", color: "#9B8E7E", marginTop: "4px", fontWeight: 600 }}>tap &amp; drag to paint pixels &mdash; keep it blocky &#9825;</div>
            </div>
            <div style={{ margin: "10px 22px 0", borderRadius: "18px", overflow: "hidden", background: "#FBF7EE", boxShadow: "inset 0 0 0 1.5px #EBDEC9, inset 0 3px 12px rgba(74,64,56,.05)", position: "relative", aspectRatio: "1/1" }}>
              <canvas ref={canvasRef} width={32} height={32} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair", imageRendering: "pixelated" }} />
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(74,64,56,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(74,64,56,.055) 1px, transparent 1px)", backgroundSize: "calc(100%/32) calc(100%/32)" }} />
            </div>
            <div style={{ padding: "16px 22px 4px", display: "flex", flexDirection: "column", gap: "13px" }}>
              <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", justifyContent: "center" }}>
                {DRAW_PALETTE.map((hex) => {
                  const active = tool === "brush" && color === hex;
                  return (
                    <button key={hex} onClick={() => { setColor(hex); setTool("brush"); }} style={{
                      width: "30px", height: "30px", borderRadius: "50%", background: hex, border: "none",
                      cursor: "pointer", padding: 0,
                      boxShadow: active ? "0 0 0 3px #FBF7EE, 0 0 0 5px " + hex
                        : (hex === "#F1E7D2" ? "inset 0 0 0 1px #DCCBB0" : "inset 0 0 0 1px rgba(74,64,56,.08)"),
                    }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "9px", justifyContent: "center", alignItems: "center" }}>
                {[1, 2, 3].map((px) => {
                  const active = tool === "brush" && size === px;
                  const d = px * 4 + 4;
                  return (
                    <button key={px} onClick={() => { setSize(px); setTool("brush"); }} style={{
                      width: "40px", height: "34px", borderRadius: "11px", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: active ? "#EFE2CC" : "#F4ECDD",
                      boxShadow: active ? "inset 0 0 0 2px #C2876B" : "none",
                    }}>
                      <span style={{ width: d + "px", height: d + "px", borderRadius: "2px", background: "#6B5E50" }} />
                    </button>
                  );
                })}
                <div style={{ width: "1px", height: "26px", background: "#EADDC8", margin: "0 3px" }} />
                <button onClick={() => setTool("eraser")} style={{
                  border: "none", borderRadius: "11px", padding: "9px 13px", fontWeight: 700, fontSize: "12.5px",
                  cursor: "pointer", color: "#7A6A58",
                  background: tool === "eraser" ? "#EFE2CC" : "#F4ECDD",
                  boxShadow: tool === "eraser" ? "inset 0 0 0 2px #C2876B" : "none",
                }}>erase</button>
                <button onClick={clearCanvas} style={{ border: "none", background: "#F4ECDD", color: "#9B8E7E", borderRadius: "11px", padding: "9px 13px", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>clear</button>
              </div>
            </div>
            <div style={{ marginTop: "auto", padding: "14px 22px 22px", display: "flex", flexDirection: "column", gap: "11px" }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name your friend" maxLength={18}
                style={{ border: "none", background: "#FFFDF8", borderRadius: "15px", padding: "13px 16px", fontSize: "15px", fontWeight: 600, color: "#4A4038", outline: "none", boxShadow: "inset 0 0 0 1.5px #EADDC8", textAlign: "center", fontFamily: font }} />
              <button onClick={create} disabled={!canCreate} style={{
                border: "none", borderRadius: "16px", padding: "15px", fontWeight: 800, fontSize: "15px",
                fontFamily: display, letterSpacing: ".01em", cursor: canCreate ? "pointer" : "default",
                transition: "all .15s", background: canCreate ? "#C2876B" : "#E8DDC9",
                color: canCreate ? "#FBF5EC" : "#BDAE97", boxShadow: canCreate ? "0 3px 0 #A66E54" : "none",
              }}>bring it to life</button>
            </div>
          </div>
        )}

        {/* ---------------- LIVE ---------------- */}
        {loaded && screen === "live" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative", background: "linear-gradient(180deg,#F4E8D3 0%,#ECDBBE 58%,#E3D1B1 100%)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(58% 38% at 50% 14%, rgba(255,252,244,.75), transparent 72%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 20px 4px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontFamily: display, fontWeight: 700, fontSize: "20px", color: "#4A4038", lineHeight: 1 }}>{name}</span>
                <span style={{ fontSize: "11px", color: "#A89A88", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>your companion</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <button className="tg-icon-btn" onClick={startOver} title="draw a new friend" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", border: "none", borderRadius: "50%", background: "rgba(255,250,242,.7)", color: "#9B8E7E", cursor: "pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4.5V9h4.5" /></svg>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(255,250,242,.7)", borderRadius: "999px", padding: "7px 13px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: m.color }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#6B5E50" }}>{m.label}</span>
                </div>
              </div>
            </div>

            <div style={{ position: "relative", display: "flex", gap: "18px", padding: "10px 22px 2px", justifyContent: "center" }}>
              {[
                { c: "#C2876B", pct: Math.round(fullness) },
                { c: "#C98B86", pct: Math.round(happiness) },
                { c: "#93A285", pct: Math.round(energy) },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: b.c }} />
                  <div style={{ width: "46px", height: "7px", borderRadius: "99px", background: "rgba(74,64,56,.1)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: b.pct + "%", background: b.c, borderRadius: "99px", transition: "width .4s ease" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
              {particles.map((p) => (
                <div key={p.id} style={{ position: "absolute", left: p.left, top: "38%", color: p.color, pointerEvents: "none", zIndex: 4, animation: "tg-float .9s ease-out forwards" }}>
                  <HeartIcon width="18" height="18" />
                </div>
              ))}

              <div style={{ position: "relative", maxWidth: "280px", marginBottom: "14px" }}>
                <div style={{ background: "#fff", color: "#4A4038", fontWeight: 600, fontSize: "14px", lineHeight: 1.42, padding: "11px 16px", borderRadius: "18px", boxShadow: "0 8px 22px rgba(74,64,56,.16)", textAlign: "center", textWrap: "pretty" }}>{bubbleText}</div>
                <div style={{ position: "absolute", left: "50%", bottom: "-6px", width: "15px", height: "15px", background: "#fff", transform: "translateX(-50%) rotate(45deg)", borderRadius: "3px" }} />
              </div>

              <div onClick={petPet} style={{ cursor: "pointer", userSelect: "none" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ animation: "tg-bob 2.6s ease-in-out infinite" }}>
                    <img src={drawing} alt="your creature" draggable={false} style={{ width: "172px", height: "172px", objectFit: "contain", display: "block", imageRendering: "pixelated", transform: pop ? "scale(1.1) rotate(-2deg)" : "scale(1)", transition: "transform .26s cubic-bezier(.34,1.56,.64,1)", filter: "drop-shadow(0 12px 9px rgba(74,64,56,.22))", pointerEvents: "none" }} />
                  </div>
                  <div style={{ position: "absolute", left: "50%", bottom: "-14px", transform: "translateX(-50%)", width: "118px", height: "20px", borderRadius: "50%", background: "rgba(120,98,70,.28)", filter: "blur(7px)" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", marginTop: "30px" }}>
                {careBtns.map((b) => (
                  <div key={b.key} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                    {hover === b.key && (
                      <div style={{ position: "absolute", bottom: "62px", left: "50%", transform: "translateX(-50%)", background: "#4A4038", color: "#FBF5EC", fontWeight: 700, fontSize: "11.5px", padding: "6px 11px", borderRadius: "10px", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(74,64,56,.25)", pointerEvents: "none", animation: "tg-fade .18s ease" }}>{b.tip}</div>
                    )}
                    <button className="tg-care" onMouseEnter={() => setHover(b.key)} onMouseLeave={() => setHover(null)} onClick={b.onClick}
                      style={{ width: "54px", height: "54px", border: "none", borderRadius: "50%", background: "#fff", color: b.color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 5px 14px rgba(74,64,56,.16)", transition: "transform .14s" }}>
                      {b.icon}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", padding: "2px 16px 0" }}>
              <button className="tg-meadow-btn" onClick={enterParadise} style={{ display: "flex", alignItems: "center", gap: "8px", border: "none", background: "linear-gradient(180deg,#EAF0DC,#DCE7C8)", color: "#5E6E4E", fontWeight: 800, fontSize: "13px", letterSpacing: ".01em", padding: "10px 20px", borderRadius: "999px", cursor: "pointer", boxShadow: "0 4px 14px rgba(110,120,80,.22), 0 1px 0 #fff inset", transition: "transform .15s" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c0-5 0-8 0-8" /><path d="M12 13c-1-3-3.5-4-6-4 0 3 2 5 6 5z" /><path d="M12 11c1-3 3.5-4.5 6-4.5 0 3.5-2.5 5.5-6 5.5z" /></svg>
                take {name} to the meadow
              </button>
            </div>
            <div style={{ position: "relative", display: "flex", gap: "9px", padding: "12px 16px 16px", background: "rgba(247,240,225,.72)", borderTop: "1px solid rgba(239,228,210,.8)", marginTop: "8px" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} placeholder={"say something to " + (name || "your friend") + "…"}
                style={{ flex: 1, border: "none", background: "#fff", borderRadius: "15px", padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: "#4A4038", outline: "none", boxShadow: "inset 0 0 0 1.5px #EADDC8", fontFamily: font }} />
              <button onClick={send} style={{ border: "none", background: "#C2876B", color: "#FBF5EC", borderRadius: "15px", width: "48px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 0 #A66E54" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ---------------- PARADISE / MEADOW ---------------- */}
        {loaded && screen === "paradise" && (
          <div ref={meadowRef} style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", animation: "tg-appear .6s ease", background: "linear-gradient(180deg,#BCD9D4 0%,#CFE3D0 30%,#E6E6C8 52%,#F3E6C4 70%,#EAD7AE 100%)" }}>
            <div style={{ position: "absolute", left: "50%", top: "13%", transform: "translateX(-50%)", width: "170px", height: "170px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,246,220,.95), rgba(255,238,200,0) 68%)", pointerEvents: "none" }} />

            <div style={{ position: "absolute", top: "15%", left: 0, width: "72px", height: "22px", background: "#fff", borderRadius: "99px", opacity: .62, boxShadow: "20px 7px 0 -3px #fff, -17px 7px 0 -5px #fff", animation: "tg-cloud 78s linear infinite" }} />
            <div style={{ position: "absolute", top: "24%", left: 0, width: "54px", height: "17px", background: "#fff", borderRadius: "99px", opacity: .5, boxShadow: "15px 5px 0 -2px #fff, -13px 5px 0 -4px #fff", animation: "tg-cloud 104s linear infinite", animationDelay: "-40s" }} />
            <div style={{ position: "absolute", top: "9%", left: 0, width: "46px", height: "15px", background: "#fff", borderRadius: "99px", opacity: .45, boxShadow: "12px 4px 0 -2px #fff, -11px 4px 0 -3px #fff", animation: "tg-cloud 132s linear infinite", animationDelay: "-90s" }} />

            <div style={{ position: "absolute", left: "-12%", right: "-12%", top: "46%", height: "60%", background: "#B6C79A", borderRadius: "50% 50% 0 0 / 38% 38% 0 0" }} />
            <div style={{ position: "absolute", left: "-18%", right: "-2%", top: "53%", height: "60%", background: "#A6BA86", borderRadius: "50% 50% 0 0 / 40% 40% 0 0" }} />
            <div style={{ position: "absolute", left: "-4%", right: "-20%", top: "58%", height: "60%", background: "#94AB74", borderRadius: "50% 50% 0 0 / 42% 42% 0 0" }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "linear-gradient(180deg,#8FA86E,#7E9760)" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: "64%", height: "6px", background: "linear-gradient(180deg,rgba(255,250,225,.5),transparent)" }} />

            {motesRef.current.map((o) => <div key={o.key} style={o.style} />)}

            <div style={{ position: "absolute", inset: 0 }}>
              {agents.map((a) => (
                <div key={a.id} data-agent={a.id} style={AGENT_WRAP}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: "50%", top: "-14px", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: "9.5px", fontWeight: 800, letterSpacing: ".02em", padding: "2px 7px", borderRadius: "99px", background: a.isYou ? "#C2876B" : "rgba(255,253,247,.85)", color: a.isYou ? "#FBF5EC" : "#6E6356", boxShadow: "0 2px 5px rgba(74,64,56,.14)" }}>{a.name}</div>
                    <div style={{ animation: "tg-bob " + a.bob + " ease-in-out infinite" }}>
                      <img src={a.src} draggable={false} width="62" height="62" style={{ display: "block", imageRendering: "pixelated", filter: "drop-shadow(0 5px 4px rgba(74,64,56,.25))" }} />
                    </div>
                    <div style={{ position: "absolute", left: "50%", bottom: "-3px", transform: "translateX(-50%)", width: "38px", height: "8px", borderRadius: "50%", background: "rgba(74,64,56,.16)", filter: "blur(3px)" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 70px rgba(120,110,70,.18)", pointerEvents: "none" }} />

            <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px", zIndex: 20 }}>
              <button className="tg-home" onClick={leaveParadise} style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "rgba(255,253,247,.82)", color: "#5E6E4E", fontWeight: 800, fontSize: "12.5px", padding: "9px 14px 9px 11px", borderRadius: "999px", cursor: "pointer", boxShadow: "0 4px 12px rgba(74,64,56,.16)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 6l-6 6 6 6" /></svg>
                home
              </button>
              <div style={{ textAlign: "right", background: "rgba(255,253,247,.78)", borderRadius: "14px", padding: "7px 13px" }}>
                <div style={{ fontFamily: display, fontWeight: 700, fontSize: "14px", color: "#4A4038", lineHeight: 1 }}>the meadow</div>
                <div style={{ fontSize: "10.5px", color: "#6E7A58", fontWeight: 700, marginTop: "2px" }}>{agents.length} friends wandering</div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- LOADING ---------------- */}
        {!loaded && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#A89A88", fontWeight: 700, fontSize: "14px" }}>
            waking up your friend&hellip;
          </div>
        )}

      </div>
    </div>
  );
}
