import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────

const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514",   label: "Claude Opus 4" },
  { id: "claude-haiku-4-5-20251001",label: "Claude Haiku 4.5" },
];

const SYSTEM_PROMPT = `You are a helpful assistant that creates artifacts.

CRITICAL RULE: Whenever you produce a diagram, code, HTML, or document — you MUST wrap it in an artifact tag. Never put code in markdown fences. Always use the artifact tag.

Artifact format (use EXACTLY this):
<artifact type="TYPE" title="TITLE">
CONTENT
</artifact>

Types:
- mermaid → ANY diagram: flowchart, sequence, class, state, ER, gantt. Content = raw mermaid syntax only, no backticks.
- html → interactive apps, slides, visual layouts. Content = complete self-contained HTML.
- markdown → documents, reports.
- svg → raw SVG graphics.

NEVER use triple backticks. ALWAYS use <artifact> tags.
Outside the artifact, write 1-2 sentences of explanation only.`;

// ─── API helpers ──────────────────────────────────────────────────────────────

const CLAUDE_BASE = "/api/anthropic";

async function* streamClaude(model, messages) {
  const res = await fetch(`${CLAUDE_BASE}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM_PROMPT, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const d = JSON.parse(line.slice(5)); if (d.delta?.text) yield d.delta.text; } catch {}
    }
  }
}

async function* streamOllama(base, model, messages) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages] }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.trim()) continue;
      try { const d = JSON.parse(line); if (d.message?.content) yield d.message.content; } catch {}
    }
  }
}

// ─── Artifact parsing ─────────────────────────────────────────────────────────

function parseArtifact(text) {
  const m = text.match(/<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/i);
  if (m) return { type: m[1], title: m[2] || "Artifact", content: m[3].trim() };
  const mm = text.match(/```mermaid\s*\n([\s\S]*?)```/i);
  if (mm) return { type: "mermaid", title: "Diagram", content: mm[1].trim() };
  const mh = text.match(/```html\s*\n([\s\S]*?)```/i);
  if (mh) return { type: "html", title: "HTML", content: mh[1].trim() };
  const mk = text.match(/```[^\n]*\n((?:flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap)[\s\S]*?)```/i);
  if (mk) return { type: "mermaid", title: "Diagram", content: mk[1].trim() };
  return null;
}

function stripArtifact(text) {
  return text.replace(/<artifact[\s\S]*?<\/artifact>/gi, "").replace(/```[\s\S]*?```/g, "").trim();
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadText(filename, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  a.download = filename;
  a.click();
}

function downloadSVGString(svgString, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml" }));
  a.download = filename;
  a.click();
}

async function downloadPNG(svgString, filename) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;top:-9999px;left:-9999px;visibility:hidden;";
  wrap.innerHTML = svgString;
  document.body.appendChild(wrap);
  const svgEl = wrap.querySelector("svg") || wrap.firstElementChild;
  if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") {
    document.body.removeChild(wrap);
    alert("SVG не найден");
    return;
  }
  const vb = svgEl.getAttribute("viewBox");
  let w = parseFloat(svgEl.getAttribute("width")) || 0;
  let h = parseFloat(svgEl.getAttribute("height")) || 0;
  if (vb) {
    const p = vb.trim().split(/[\s,]+/);
    if (!w) w = parseFloat(p[2]) || 0;
    if (!h) h = parseFloat(p[3]) || 0;
  }
  w = Math.round(w) || 1200;
  h = Math.round(h) || 800;
  svgEl.setAttribute("width", w);
  svgEl.setAttribute("height", h);
  svgEl.querySelectorAll("*").forEach(el => {
    if (el.style && el.style.fontFamily) el.style.fontFamily = "Arial, sans-serif";
    if (el.getAttribute("font-family")) el.setAttribute("font-family", "Arial, sans-serif");
  });
  const clean = new XMLSerializer().serializeToString(svgEl);
  document.body.removeChild(wrap);
  const scale = 2;
  const encoded = btoa(unescape(encodeURIComponent(clean)));
  const dataUri = `data:image/svg+xml;base64,${encoded}`;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };
  img.onerror = () => alert("Не удалось конвертировать SVG в PNG.\nПопробуйте экспорт в SVG.");
  img.src = dataUri;
}

// ─── Mermaid renderer ─────────────────────────────────────────────────────────

const zoomBtnStyle = {
  width: 26, height: 26, border: "1px solid var(--border2)", borderRadius: 5,
  background: "var(--bg2)", color: "var(--text)", cursor: "pointer",
  fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
};

function MermaidView({ code, onSvgReady }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (!ref.current || !code) return;
    setErr(null);
    ref.current.innerHTML = "";

    const renderId = "mg" + Date.now() + Math.random().toString(36).slice(2);

    // Объявляем cleanCode здесь — до любых вызовов
    const cleanCode = code
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/^\s*```[a-z]*\s*/i, "").replace(/\s*```\s*$/i, "")
      .trim();

    // doRender принимает код явным параметром — не через замыкание
    const doRender = (c) => {
      try {
        const dark = matchMedia("(prefers-color-scheme: dark)").matches;
        window.mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "loose",
          sequence: { useMaxWidth: false },
        });
        window.mermaid.render(renderId, c)
          .then(({ svg }) => {
            if (!ref.current) return;
            ref.current.innerHTML = svg;
            const el = ref.current.querySelector("svg");
            if (el) {
              el.style.maxWidth = "none";
              el.style.height = "auto";
              el.style.display = "block";
              onSvgReady?.(new XMLSerializer().serializeToString(el));
            }
          })
          .catch(e => setErr(String(e)));
      } catch (e) { setErr(String(e)); }
    };

    if (window.mermaid && window.mermaid.VERSION && window.mermaid.VERSION.startsWith("11")) {
      doRender(cleanCode);
      return;
    }

    // Загружаем mermaid@11, сбрасываем старую версию
    delete window.mermaid;
    document.querySelectorAll('script[src*="mermaid"]').forEach(s => s.remove());
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js?v=" + Date.now();
    script.onload = () => doRender(cleanCode);
    script.onerror = () => setErr("Не удалось загрузить Mermaid");
    document.head.appendChild(script);
  }, [code]);

  const onWheel = e => {
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(0.2, z - e.deltaY * 0.001)));
  };
  const onMouseDown = e => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = e => {
    if (!dragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my });
  };
  const onMouseUp = () => { dragging.current = false; };

  if (err) return (
    <pre style={{ padding: 16, color: "#c0392b", fontSize: 12, whiteSpace: "pre-wrap", userSelect: "text", cursor: "text" }}>
      {"Ошибка рендера Mermaid:\n"}{err}
    </pre>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} style={zoomBtnStyle}>+</button>
        <span style={{ fontSize: 11, color: "var(--text2)", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} style={zoomBtnStyle}>−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={zoomBtnStyle} title="Сбросить">⊙</button>
      </div>
      <div
        style={{ width: "100%", height: "100%", overflow: "hidden", cursor: dragging.current ? "grabbing" : "grab" }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <div ref={ref} style={{ transformOrigin: "0 0", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, padding: 24, display: "inline-block" }} />
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="btn-secondary btn-sm">{copied ? "✓ Скопировано" : "⎘ Копировать"}</button>
  );
}

// ─── Artifact Preview ─────────────────────────────────────────────────────────

function ArtifactPreview({ artifact, viewMode, streaming, onSvgReady }) {
  if (!artifact) return (
    <div className="artifact-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" />
      </svg>
      <span>Артефакт появится здесь</span>
    </div>
  );

  if (viewMode === "code") return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
        <CopyButton text={artifact.content} />
      </div>
      <pre className="code-view">
        <code className={artifact.type === "html" ? "language-html" : artifact.type === "svg" ? "language-xml" : "language-plaintext"}>
          {artifact.content}
        </code>
        {streaming && <span className="blink-cursor">▌</span>}
      </pre>
    </div>
  );

  if (streaming) return (
    <div className="artifact-empty"><span className="spin">⟳</span> Генерация...</div>
  );

  if (artifact.type === "mermaid") return (
    <div style={{ width: "100%", height: "100%" }}>
      <MermaidView code={artifact.content} onSvgReady={onSvgReady} />
    </div>
  );
  if (artifact.type === "html") return (
    <iframe srcDoc={artifact.content} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} sandbox="allow-scripts allow-same-origin" />
  );
  if (artifact.type === "svg") return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }} dangerouslySetInnerHTML={{ __html: artifact.content }} />
  );
  return <div className="markdown-view">{artifact.content}</div>;
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ cfg, setCfg, status, onTest }) {
  const [ollamaModels, setOllamaModels] = useState([]);
  const [loadingM, setLoadingM] = useState(false);

  const fetchModels = async (base) => {
    setLoadingM(true);
    try {
      const r = await fetch(`${base}/api/tags`);
      const d = await r.json();
      const names = (d.models || []).map(m => m.name);
      setOllamaModels(names);
      if (names.length > 0 && !names.includes(cfg.ollamaModel)) {
        setCfg(c => ({ ...c, ollamaModel: names[0] }));
      }
    } catch { setOllamaModels([]); }
    setLoadingM(false);
  };

  useEffect(() => {
    if (cfg.provider === "ollama") fetchModels(cfg.ollamaBase);
  }, [cfg.provider, cfg.ollamaBase]);

  return (
    <div className="settings-panel">
      <div className="field">
        <label>Провайдер</label>
        <div className="toggle-group">
          {["claude", "ollama"].map(p => (
            <button key={p} className={`toggle-btn ${cfg.provider === p ? "active" : ""}`}
              onClick={() => setCfg(c => ({ ...c, provider: p }))}>
              {p === "claude" ? "☁ Claude API" : "⚡ Ollama"}
            </button>
          ))}
        </div>
      </div>
      {cfg.provider === "claude" && <>
        <div className="field">
          <label>Модель</label>
          <select value={cfg.claudeModel} onChange={e => setCfg(c => ({ ...c, claudeModel: e.target.value }))}>
            {CLAUDE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="info-box">
          API-ключ читается из <code>ANTHROPIC_API_KEY</code> в <code>.env</code> — Vite proxy подставляет его автоматически.
        </div>
      </>}
      {cfg.provider === "ollama" && <>
        <div className="field">
          <label>Ollama URL</label>
          <input value={cfg.ollamaBase} placeholder="http://localhost:11434"
            onChange={e => setCfg(c => ({ ...c, ollamaBase: e.target.value }))} />
        </div>
        <div className="field">
          <label>Модель {loadingM && <span className="muted">(загрузка...)</span>}</label>
          {ollamaModels.length > 0
            ? <select value={cfg.ollamaModel} onChange={e => setCfg(c => ({ ...c, ollamaModel: e.target.value }))}>
                {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            : <input value={cfg.ollamaModel} placeholder="llama3.2"
                onChange={e => setCfg(c => ({ ...c, ollamaModel: e.target.value }))} />
          }
        </div>
        <button className="btn-secondary" onClick={() => fetchModels(cfg.ollamaBase)}>Обновить список моделей</button>
      </>}
      <button className="btn-secondary" onClick={onTest}>Проверить подключение</button>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle:     { cls: "status-idle",     text: "Не проверено" },
    checking: { cls: "status-checking", text: "Проверка..." },
    ok:       { cls: "status-ok",       text: "Подключено" },
    error:    { cls: "status-error",    text: "Ошибка подключения" },
  };
  const { cls, text } = map[status] || map.idle;
  return <div className={`status-badge ${cls}`}><span className="status-dot" />{text}</div>;
}

// ─── Resizer hook ─────────────────────────────────────────────────────────────

function useResizer(initPct = 42) {
  const [pct, setPct] = useState(initPct);
  const dragging = useRef(false);
  const containerRef = useRef(null);
  const onMouseDown = useCallback(e => {
    e.preventDefault();
    dragging.current = true;
    const onMove = ev => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPct(Math.min(75, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  }, []);
  return { pct, containerRef, onMouseDown };
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`bubble-wrap ${isUser ? "user" : "assistant"}`}>
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
        {msg.text || <span className="muted italic">...</span>}
      </div>
    </div>
  );
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({ artifact, svgString }) {
  const [open, setOpen] = useState(false);
  if (!artifact) return null;
  const title = artifact.title.replace(/\s+/g, "_");
  const actions = [];
  if ((artifact.type === "mermaid" || artifact.type === "svg") && svgString) {
    actions.push({ label: "Скачать SVG", fn: () => downloadSVGString(svgString, `${title}.svg`) });
    actions.push({ label: "Скачать PNG", fn: () => downloadPNG(svgString, `${title}.png`) });
  }
  if (artifact.type === "html") actions.push({ label: "Скачать HTML", fn: () => downloadText(`${title}.html`, artifact.content) });
  if (artifact.type === "markdown") actions.push({ label: "Скачать MD", fn: () => downloadText(`${title}.md`, artifact.content) });
  actions.push({ label: "Скачать исходник", fn: () => downloadText(`${title}.txt`, artifact.content) });
  return (
    <div style={{ position: "relative" }}>
      <button className="btn-secondary btn-sm" onClick={() => setOpen(o => !o)}>⬇ Экспорт</button>
      {open && (
        <div className="export-menu" onMouseLeave={() => setOpen(false)}>
          {actions.map(a => (
            <button key={a.label} className="export-item" onClick={() => { a.fn(); setOpen(false); }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [cfg, setCfg] = useState({
    provider: "ollama",
    claudeModel: "claude-sonnet-4-20250514",
    ollamaBase: "http://localhost:11434",
    ollamaModel: "llama3.2",
  });
  const [status, setStatus] = useState("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [artifact, setArtifact] = useState(null);
  const [streamingArtifact, setStreamingArtifact] = useState(null);
  const [viewMode, setViewMode] = useState("preview");
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [svgString, setSvgString] = useState(null);
  const bottomRef = useRef(null);
  const { pct, containerRef, onMouseDown } = useResizer(42);

  useEffect(() => {
    if (window.hljs) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-light.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js";
    script.onload = () => {
      window.hljs.configure({ ignoreUnescapedHTML: true });
      document.querySelectorAll("pre code").forEach(el => window.hljs.highlightElement(el));
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (viewMode === "code" && window.hljs) {
      setTimeout(() => document.querySelectorAll("pre code").forEach(el => window.hljs.highlightElement(el)), 50);
    }
  }, [viewMode, artifact]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const testConnection = async () => {
    setStatus("checking");
    try {
      if (cfg.provider === "claude") {
        const r = await fetch(`${CLAUDE_BASE}/v1/models`, { headers: { "Content-Type": "application/json" } });
        setStatus(r.ok ? "ok" : "error");
      } else {
        const r = await fetch(`${cfg.ollamaBase}/api/tags`);
        setStatus(r.ok ? "ok" : "error");
      }
    } catch { setStatus("error"); }
  };

  const sendMessage = useCallback(async () => {
    const txt = input.trim();
    if (!txt || loading) return;
    setInput("");
    const userMsg = { role: "user", text: txt };
    const asstMsg = { role: "assistant", text: "" };
    setMessages(prev => [...prev, userMsg, asstMsg]);
    setLoading(true);
    setStreamingArtifact(null);
    const histMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
    let full = "";

    const update = chunk => {
      full += chunk;
      const artOpen = full.indexOf("<artifact");
      const artClose = full.indexOf("</artifact>");
      if (artOpen !== -1) {
        const headerEnd = full.indexOf(">", artOpen);
        if (headerEnd !== -1) {
          const header = full.slice(artOpen, headerEnd + 1);
          const tm = header.match(/type="([^"]+)"/);
          const titm = header.match(/title="([^"]*)"/);
          const partContent = artClose !== -1 ? full.slice(headerEnd + 1, artClose).trim() : full.slice(headerEnd + 1).trim();
          setStreamingArtifact({ type: tm?.[1] || "mermaid", title: titm?.[1] || "Artifact", content: partContent });
          setViewMode("code");
        }
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: full.slice(0, artOpen).trim() }; return n; });
      } else {
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: full.trim() }; return n; });
      }
    };

    try {
      const stream = cfg.provider === "claude"
        ? streamClaude(cfg.claudeModel, histMsgs)
        : streamOllama(cfg.ollamaBase, cfg.ollamaModel, histMsgs);
      for await (const chunk of stream) update(chunk);
    } catch (e) {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: "Ошибка: " + e.message }; return n; });
    }

    const finalArt = parseArtifact(full);
    if (finalArt) {
      setArtifact(finalArt);
      setStreamingArtifact(null);
      setHistory(h => { const nh = [...h, finalArt]; setHistIdx(nh.length - 1); return nh; });
      setSvgString(null);
      setViewMode("preview");
    } else {
      setStreamingArtifact(null);
    }
    setLoading(false);
  }, [input, loading, messages, cfg]);

  const handleKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const goHist = dir => {
    const ni = histIdx + dir;
    if (ni < 0 || ni >= history.length) return;
    setHistIdx(ni); setArtifact(history[ni]); setViewMode("preview");
  };

  const displayArtifact = streamingArtifact || artifact;
  const isStreaming = !!streamingArtifact;
  const provLabel = cfg.provider === "claude"
    ? (CLAUDE_MODELS.find(m => m.id === cfg.claudeModel)?.label || cfg.claudeModel)
    : cfg.ollamaModel;

  return (
    <div ref={containerRef} className="app-root">
      <div className="chat-panel" style={{ width: `${pct}%` }}>
        <div className="panel-header">
          <div>
            <div className="app-title">Artifact Studio</div>
            <div className="app-subtitle">
              <span className={`dot dot-${status === "ok" ? "ok" : status === "error" ? "error" : "idle"}`} />
              {provLabel}
            </div>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => setShowSettings(s => !s)}>
            {showSettings ? "Чат" : "⚙ Настройки"}
          </button>
        </div>
        {showSettings
          ? <SettingsPanel cfg={cfg} setCfg={setCfg} status={status} onTest={testConnection} />
          : <>
              <div className="messages">
                {messages.length === 0 && (
                  <div className="placeholder">
                    <div className="placeholder-icon">✦</div>
                    "Flowchart процесса CI/CD"<br />
                    "Sequence diagram JWT авторизации"<br />
                    "HTML слайд для презентации"<br />
                    "State diagram заказа в магазине"
                  </div>
                )}
                {messages.map((m, i) => <Bubble key={i} msg={m} />)}
                <div ref={bottomRef} />
              </div>
              <div className="input-row">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                  rows={1} placeholder="Сообщение... (Enter — отправить)" className="chat-input"
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()}
                  className={`send-btn ${loading || !input.trim() ? "disabled" : ""}`}>
                  {loading ? "..." : "→"}
                </button>
              </div>
            </>
        }
      </div>

      <div className="resizer" onMouseDown={onMouseDown} />

      <div className="artifact-panel">
        <div className="panel-header">
          <span className="artifact-title">
            {displayArtifact ? `${displayArtifact.title} · ${displayArtifact.type}` : "Артефакт"}
            {isStreaming && <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>генерация...</span>}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {history.length > 1 && (
              <div className="version-nav">
                <button onClick={() => goHist(-1)} disabled={histIdx <= 0} className="ver-btn">←</button>
                <span>v{histIdx + 1}/{history.length}</span>
                <button onClick={() => goHist(1)} disabled={histIdx >= history.length - 1} className="ver-btn">→</button>
              </div>
            )}
            <ExportMenu artifact={artifact} svgString={svgString} />
            {displayArtifact && ["preview", "code"].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`tab-btn ${viewMode === m ? "active" : ""}`}>
                {m === "preview" ? "Превью" : "Код"}
              </button>
            ))}
          </div>
        </div>
        <div className="artifact-content">
          <ArtifactPreview
            artifact={displayArtifact}
            viewMode={viewMode}
            streaming={isStreaming}
            onSvgReady={str => setSvgString(str)}
          />
        </div>
      </div>
    </div>
  );
}