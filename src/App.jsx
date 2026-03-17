import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

const T = {
  ru: {
    appTitle: "Artifact Studio",
    settings: "⚙ Настройки", chat: "Чат", provider: "Провайдер", model: "Модель",
    ollamaUrl: "Ollama URL", updateModels: "Обновить список моделей",
    checkConnection: "Проверить подключение",
    statusIdle: "Не проверено", statusChecking: "Проверка...",
    statusOk: "Подключено", statusError: "Ошибка подключения",
    proxyNote: "API-ключ читается из ANTHROPIC_API_KEY в .env — Vite proxy подставляет автоматически.",
    loadingModels: "загрузка...",
    placeholder1: '"Flowchart процесса CI/CD"',
    placeholder2: '"Sequence diagram JWT авторизации"',
    placeholder3: '"HTML слайд для презентации"',
    placeholder4: '"State diagram заказа в магазине"',
    inputPlaceholder: "Сообщение... (Enter — отправить)",
    artifact: "Артефакт", generating: "генерация...",
    preview: "Превью", code: "Код",
    copy: "⎘ Копировать", copied: "✓ Скопировано",
    export: "⬇ Экспорт", downloadSvg: "Скачать SVG", downloadPng: "Скачать PNG",
    downloadHtml: "Скачать HTML", downloadMd: "Скачать MD",
    downloadRtf: "Скачать RTF", downloadSrc: "Скачать исходник",
    artifactEmpty: "Артефакт появится здесь",
    mermaidError: "Ошибка рендера Mermaid:\n", mermaidLoad: "Не удалось загрузить Mermaid",
    svgNotFound: "SVG не найден", pngError: "Не удалось конвертировать SVG в PNG.\nПопробуйте экспорт в SVG.",
    sending: "...", send: "→",
    attachTooltip: "Прикрепить файлы", attachLimit: "Максимум 5 файлов",
    fileTooBig: "Файл слишком большой (макс 10MB)",
    sessions: "Чаты", newChat: "+ Новый чат",
    patched: "патч применён", saveVersion: "💾 Сохранить версию",
    changes: "изменение", changes2: "изменения",
    fullscreen: "Полный экран", exitFullscreen: "Выйти",
  },
  en: {
    appTitle: "Artifact Studio",
    settings: "⚙ Settings", chat: "Chat", provider: "Provider", model: "Model",
    ollamaUrl: "Ollama URL", updateModels: "Refresh model list",
    checkConnection: "Check connection",
    statusIdle: "Not checked", statusChecking: "Checking...",
    statusOk: "Connected", statusError: "Connection error",
    proxyNote: "API key is read from ANTHROPIC_API_KEY in .env — injected by Vite proxy automatically.",
    loadingModels: "loading...",
    placeholder1: '"Flowchart of CI/CD process"',
    placeholder2: '"Sequence diagram of JWT auth"',
    placeholder3: '"HTML slide for a presentation"',
    placeholder4: '"State diagram of a shop order"',
    inputPlaceholder: "Message... (Enter to send)",
    artifact: "Artifact", generating: "generating...",
    preview: "Preview", code: "Code",
    copy: "⎘ Copy", copied: "✓ Copied",
    export: "⬇ Export", downloadSvg: "Download SVG", downloadPng: "Download PNG",
    downloadHtml: "Download HTML", downloadMd: "Download MD",
    downloadRtf: "Download RTF", downloadSrc: "Download source",
    artifactEmpty: "Artifact will appear here",
    mermaidError: "Mermaid render error:\n", mermaidLoad: "Failed to load Mermaid",
    svgNotFound: "SVG not found", pngError: "Failed to convert SVG to PNG.\nTry exporting as SVG.",
    sending: "...", send: "→",
    attachTooltip: "Attach files", attachLimit: "Maximum 5 files",
    fileTooBig: "File too large (max 10MB)",
    sessions: "Chats", newChat: "+ New chat",
    patched: "patch applied", saveVersion: "💾 Save version",
    changes: "change", changes2: "changes",
    fullscreen: "Полный экран", exitFullscreen: "Выйти",
  },
};

// ─── Patch system ─────────────────────────────────────────────────────────────

function parsePatches(text) {
  const patches = [];
  const re = /<patch>\s*<old>([\s\S]*?)<\/old>\s*<new>([\s\S]*?)<\/new>\s*<\/patch>/gi;
  let m;
  while ((m = re.exec(text)) !== null)
    patches.push({ old: m[1], new: m[2] });
  return patches;
}

function fuzzyReplace(code, oldStr, newStr) {
  if (code.includes(oldStr)) return code.replace(oldStr, newStr);
  const codeLines = code.split("\n");
  const oldLines = oldStr.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (!oldLines.length) return code;
  for (let i = 0; i <= codeLines.length - oldLines.length; i++) {
    const match = oldLines.every((ol, j) => codeLines[i + j].trim() === ol);
    if (match) {
      const indent = codeLines[i].match(/^(\s*)/)[1];
      const newLines = newStr.split("\n").map((l, idx) => idx === 0 ? indent + l.trim() : l);
      return [...codeLines.slice(0, i), ...newLines, ...codeLines.slice(i + oldLines.length)].join("\n");
    }
  }
  const normalize = s => s.replace(/\s+/g, " ").trim();
  if (normalize(code).includes(normalize(oldStr))) {
    return code.replace(
      new RegExp(oldStr.trim().split("\n").map(l => l.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*\\n\\s*")),
      newStr
    );
  }
  return null;
}

function applyPatches(code, patches) {
  let result = code, applied = 0;
  for (const p of patches) {
    const patched = fuzzyReplace(result, p.old, p.new);
    if (patched !== null) { result = patched; applied++; }
  }
  return { result, applied };
}

// ─── RTF export ───────────────────────────────────────────────────────────────

function escapeRtf(str) {
  return str.replace(/\\/g,"\\\\").replace(/\{/g,"\\{").replace(/\}/g,"\\}")
    .replace(/[^\x00-\x7F]/g, c => { const code=c.charCodeAt(0); return code>32767?`\\u${code-65536}?`:`\\u${code}?`; });
}
function inlineRtf(text) {
  let s=escapeRtf(text);
  s=s.replace(/\*\*(.+?)\*\*/g,"{\\b $1}").replace(/__(.+?)__/g,"{\\b $1}");
  s=s.replace(/\*(.+?)\*/g,"{\\i $1}").replace(/_(.+?)_/g,"{\\i $1}");
  s=s.replace(/`(.+?)`/g,"{\\f1\\fs20 $1}").replace(/\[(.+?)\]\(.+?\)/g,"$1");
  return s;
}
function mdToRtf(md) {
  const lines=md.split("\n"), rtfLines=[]; let inList=false;
  for (const raw of lines) {
    const line=raw.trimEnd();
    if(/^### /.test(line)){if(inList){rtfLines.push("\\pard");inList=false;}rtfLines.push(`\\pard\\sb200\\sa100\\b\\fs28 ${escapeRtf(line.slice(4))}\\b0\\fs24\\par`);continue;}
    if(/^## /.test(line)) {if(inList){rtfLines.push("\\pard");inList=false;}rtfLines.push(`\\pard\\sb240\\sa120\\b\\fs32 ${escapeRtf(line.slice(3))}\\b0\\fs24\\par`);continue;}
    if(/^# /.test(line))  {if(inList){rtfLines.push("\\pard");inList=false;}rtfLines.push(`\\pard\\sb300\\sa150\\b\\fs40 ${escapeRtf(line.slice(2))}\\b0\\fs24\\par`);continue;}
    if(/^[\*\-] /.test(line)){inList=true;rtfLines.push(`\\pard\\li360\\fi-360\\bullet\\tab ${inlineRtf(line.slice(2))}\\par`);continue;}
    if(/^\d+\. /.test(line)){inList=true;const num=line.match(/^(\d+)/)[1];rtfLines.push(`\\pard\\li360\\fi-360 ${num}.\\tab ${inlineRtf(line.replace(/^\d+\. /,""))}\\par`);continue;}
    if(/^---+$/.test(line.trim())){if(inList){rtfLines.push("\\pard");inList=false;}rtfLines.push("\\pard\\brdrb\\brdrs\\brdrw10\\brdrsp20\\par");continue;}
    if(!line.trim()){inList=false;rtfLines.push("\\pard\\par");continue;}
    if(/^```/.test(line)){if(inList){rtfLines.push("\\pard");inList=false;}rtfLines.push("\\pard\\f1\\fs20\\highlight2 ");continue;}
    if(inList){rtfLines.push("\\pard");inList=false;}
    rtfLines.push(`\\pard\\sa120 ${inlineRtf(line)}\\par`);
  }
  return rtfLines.join("\n");
}
function htmlTableToRtf(tableHtml) {
  const rowMatches=tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)||[];
  if(!rowMatches.length)return "";
  const rows=rowMatches.map(row=>{const cells=[];const cellRe=/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;let cm;while((cm=cellRe.exec(row))!==null){const isHeader=/<th/i.test(cm[0]);const text=cm[1].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").trim();cells.push({text,isHeader});}return cells;});
  if(!rows.length||!rows[0].length)return "";
  const colCount=Math.max(...rows.map(r=>r.length));const colWidth=Math.floor(9360/colCount);let rtf="";
  for(const row of rows){rtf+="\\trowd\\trgaph108\\trrh280\n";for(let c=0;c<colCount;c++)rtf+=`\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10\\cellx${colWidth*(c+1)}\n`;for(let c=0;c<colCount;c++){const cell=row[c]||{text:"",isHeader:false};rtf+=cell.isHeader?`\\intbl\\b ${escapeRtf(cell.text)}\\b0\\cell\n`:`\\intbl ${escapeRtf(cell.text)}\\cell\n`;}rtf+="\\row\n";}
  return rtf+"\\pard\n";
}
function htmlToRtf(html) {
  let result="";const parts=html.split(/(<table[\s\S]*?<\/table>)/gi);
  for(const part of parts){if(/^<table/i.test(part)){result+=htmlTableToRtf(part);continue;}let text=part.replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi,"\n# $1\n").replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi,"\n## $1\n").replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi,"\n### $1\n").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,"\n- $1").replace(/<br\s*\/?>/gi,"\n").replace(/<p[^>]*>([\s\S]*?)<\/p>/gi,"\n$1\n").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&quot;/g,'"');result+=mdToRtf(text);}
  return result;
}
function buildRtf(artifact) {
  const hdr=`{\\rtf1\\ansi\\ansicpg1252\\deff0\n{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fmodern\\fcharset0 Courier New;}}\n{\\colortbl;\\red0\\green0\\blue0;\\red240\\green240\\blue240;}\n\\widowctrl\\hyphauto\n\\f0\\fs24\n`;
  let body="";
  switch(artifact.type){case "markdown":body=mdToRtf(artifact.content);break;case "html":body=htmlToRtf(artifact.content);break;default:body=`\\pard\\b\\fs28 ${escapeRtf(artifact.title)}\\b0\\par\n`+artifact.content.split("\n").map(l=>`\\pard\\f1\\fs18 ${escapeRtf(l)}\\par`).join("\n");}
  return hdr+body+"\n}";
}
function downloadRTF(artifact) {
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([buildRtf(artifact)],{type:"application/rtf"}));a.download=artifact.title.replace(/\s+/g,"_")+".rtf";a.click();
}

// ─── Session storage ──────────────────────────────────────────────────────────

const SESSIONS_KEY="as_sessions";
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function loadSessions(){try{return JSON.parse(localStorage.getItem(SESSIONS_KEY)||"[]");}catch{return[];}}
function saveSession(s){const ss=loadSessions();const i=ss.findIndex(x=>x.id===s.id);if(i>=0)ss[i]=s;else ss.unshift(s);localStorage.setItem(SESSIONS_KEY,JSON.stringify(ss));}
function deleteSession(id){localStorage.setItem(SESSIONS_KEY,JSON.stringify(loadSessions().filter(s=>s.id!==id)));}
function sessionTitle(msgs){return(msgs.find(m=>m.role==="user")?.text||"").slice(0,40)||"New chat";}
function exportSessions(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(loadSessions(),null,2)],{type:"application/json"}));a.download=`artifact-studio-sessions-${new Date().toISOString().slice(0,10)}.json`;a.click();}
function importSessions(file,onDone){const r=new FileReader();r.onload=e=>{try{const imp=JSON.parse(e.target.result);if(!Array.isArray(imp))throw 0;const ex=loadSessions();localStorage.setItem(SESSIONS_KEY,JSON.stringify([...imp,...ex.filter(s=>!imp.find(i=>i.id===s.id))]));onDone();}catch{alert("Invalid session file");}};r.readAsText(file);}

// ─── Sessions sidebar ─────────────────────────────────────────────────────────

function SessionsSidebar({currentId,onSelect,onNew,onDelete,t,lang}){
  const importRef=useRef(null);const[,forceUpdate]=useState(0);const sessions=loadSessions();
  const handleDelete=(e,id)=>{e.stopPropagation();if(window.confirm(lang==="ru"?"Удалить этот чат?":"Delete this chat?")){deleteSession(id);onDelete(id);forceUpdate(n=>n+1);}};
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",display:"flex",gap:6}}>
        <button className="btn-secondary btn-sm" onClick={onNew} style={{flex:1}}>{lang==="ru"?"+ Новый чат":"+ New chat"}</button>
        <button className="btn-secondary btn-sm" onClick={exportSessions} title={lang==="ru"?"Экспорт":"Export"}>⬇</button>
        <button className="btn-secondary btn-sm" onClick={()=>importRef.current?.click()} title={lang==="ru"?"Импорт":"Import"}>⬆</button>
        <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importSessions(e.target.files[0],()=>{forceUpdate(n=>n+1);onNew();});e.target.value="";}}}/>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {sessions.length===0&&<div style={{padding:16,fontSize:12,color:"var(--text2)",textAlign:"center",opacity:.6}}>{lang==="ru"?"Нет сохранённых чатов":"No saved chats"}</div>}
        {sessions.map(s=>(
          <div key={s.id} onClick={()=>onSelect(s)} style={{padding:"9px 12px",cursor:"pointer",fontSize:12,lineHeight:1.4,borderBottom:"1px solid var(--border)",background:s.id===currentId?"var(--bg2)":"transparent",display:"flex",alignItems:"center",gap:6}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg2)"} onMouseLeave={e=>e.currentTarget.style.background=s.id===currentId?"var(--bg2)":"transparent"}>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontWeight:s.id===currentId?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)"}}>{s.title}</div>
              <div style={{color:"var(--text2)",fontSize:11,marginTop:2}}>{new Date(s.updatedAt).toLocaleDateString(lang==="ru"?"ru-RU":"en-US")}{" · "}{s.messages.length} {lang==="ru"?"сообщ.":"msgs"}</div>
            </div>
            <button onClick={e=>handleDelete(e,s.id)} style={{border:"none",background:"none",cursor:"pointer",color:"var(--text2)",fontSize:14,padding:"0 2px",flexShrink:0,opacity:.5}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity=".5"}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── File attachments ─────────────────────────────────────────────────────────

const MAX_FILES=5,MAX_SIZE=10*1024*1024;
async function readFile(file,t){
  if(file.size>MAX_SIZE){alert(t.fileTooBig+`: ${file.name}`);return null;}
  return new Promise(resolve=>{const r=new FileReader();if(file.type.startsWith("image/"))r.onload=e=>resolve({type:"image",name:file.name,base64:e.target.result,mime:file.type});else r.onload=e=>resolve({type:"text",name:file.name,content:e.target.result});file.type.startsWith("image/")?r.readAsDataURL(file):r.readAsText(file);});
}
function AttachmentPreview({attachments,onRemove}){
  if(!attachments.length)return null;
  return(<div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"6px 14px 0"}}>{attachments.map((a,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:4,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 6px",fontSize:12,maxWidth:160}}>{a.type==="image"?<img src={a.base64} alt={a.name} style={{width:24,height:24,objectFit:"cover",borderRadius:3}}/>:<span style={{fontSize:14}}>📄</span>}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)",maxWidth:90}}>{a.name}</span><button onClick={()=>onRemove(i)} style={{border:"none",background:"none",cursor:"pointer",color:"var(--text2)",fontSize:14,padding:0,lineHeight:1,flexShrink:0}}>×</button></div>))}</div>);
}
function buildContent(txt,atts){if(!atts.length)return txt;const parts=[];atts.forEach(a=>{if(a.type==="image")parts.push({type:"image",source:{type:"base64",media_type:a.mime,data:a.base64.split(",")[1]}});else parts.push({type:"text",text:`[File: ${a.name}]\n${a.content}`});});parts.push({type:"text",text:txt});return parts;}
function buildOllamaMessage(txt,atts){const images=atts.filter(a=>a.type==="image").map(a=>a.base64.split(",")[1]);const textParts=atts.filter(a=>a.type==="text").map(a=>`[File: ${a.name}]\n${a.content}`);const fullText=[...textParts,txt].join("\n\n");return images.length?{role:"user",content:fullText,images}:{role:"user",content:fullText};}

// ─── Config ───────────────────────────────────────────────────────────────────

const CLAUDE_MODELS=[
  {id:"claude-sonnet-4-20250514",label:"Claude Sonnet 4"},
  {id:"claude-opus-4-20250514",label:"Claude Opus 4"},
  {id:"claude-haiku-4-5-20251001",label:"Claude Haiku 4.5"},
];

const SYSTEM_PROMPT=`You are a helpful assistant that creates artifacts.

CRITICAL RULE: Whenever you produce a diagram, code, HTML, or document — you MUST wrap it in an artifact tag. Never put code in markdown fences. Always use the artifact tag.

Artifact format:
<artifact type="TYPE" title="TITLE">
CONTENT
</artifact>

Types:
- mermaid → ANY diagram: flowchart, sequence, class, state, ER, gantt, timeline. Raw mermaid syntax only, no backticks. In sequenceDiagram: "Note over" max 2 participants. In timeline: "period : event". In flowchart: every arrow must have a target node id, no quoted strings as node ids, no double quotes in edge labels, subgraph IDs must use only Latin letters/underscores, no parentheses () in subgraph or node labels.
- html → interactive apps, slides, visual layouts. Complete self-contained HTML.
- markdown → documents, reports.
- svg → raw SVG graphics.

EDITING AN EXISTING ARTIFACT:
When the user asks to edit/fix/change/add/remove something — return ONLY patch blocks.
CRITICAL: Change ONLY what the user explicitly asked. Do NOT improve, reformat, or fix anything else.
One change = one patch block. Return as few patches as possible.

Use this exact format for each change:
<patch>
<old>exact text to replace (copy verbatim from artifact)</old>
<new>replacement text</new>
</patch>

Example — if artifact content has "# Hello World" and user says "change title to Goodbye":
<patch>
<old># Hello World</old>
<new># Goodbye</new>
</patch>

IMPORTANT: <old> must contain text that exists verbatim in the artifact CONTENT. Never use artifact wrapper attributes like title="..." in patches.

Use full <artifact> ONLY when: creating a new artifact, or user explicitly asks to rewrite everything.
NEVER use triple backticks. ALWAYS use <artifact> or <patch> tags.
Outside the tags, write 1 sentence only.`;

// ─── API helpers ──────────────────────────────────────────────────────────────

const CLAUDE_BASE="/api/anthropic";
async function* streamClaude(model,messages){
  const res=await fetch(`${CLAUDE_BASE}/v1/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,max_tokens:4096,system:SYSTEM_PROMPT,messages,stream:true})});
  if(!res.ok)throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const reader=res.body.getReader();const dec=new TextDecoder();
  while(true){const{done,value}=await reader.read();if(done)break;for(const line of dec.decode(value).split("\n")){if(!line.startsWith("data:"))continue;try{const d=JSON.parse(line.slice(5));if(d.delta?.text)yield d.delta.text;}catch{}}}
}
async function* streamOllama(base,model,messages){
  const res=await fetch(`${base}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,stream:true,messages:[{role:"system",content:SYSTEM_PROMPT},...messages]})});
  if(!res.ok)throw new Error(`Ollama error ${res.status}`);
  const reader=res.body.getReader();const dec=new TextDecoder();
  while(true){const{done,value}=await reader.read();if(done)break;for(const line of dec.decode(value).split("\n")){if(!line.trim())continue;try{const d=JSON.parse(line);if(d.message?.content)yield d.message.content;}catch{}}}
}

// ─── Artifact parsing ─────────────────────────────────────────────────────────

function parseArtifact(text){
  const m=text.match(/<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/i);
  if(m)return{type:m[1],title:m[2]||"Artifact",content:m[3].trim()};
  const mm=text.match(/```mermaid\s*\n([\s\S]*?)```/i);if(mm)return{type:"mermaid",title:"Diagram",content:mm[1].trim()};
  const mh=text.match(/```html\s*\n([\s\S]*?)```/i);if(mh)return{type:"html",title:"HTML",content:mh[1].trim()};
  const mk=text.match(/```[^\n]*\n((?:flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline)[\s\S]*?)```/i);if(mk)return{type:"mermaid",title:"Diagram",content:mk[1].trim()};
  return null;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadText(filename,content){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:"text/plain"}));a.download=filename;a.click();}
function downloadSVGString(s,f){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([s],{type:"image/svg+xml"}));a.download=f;a.click();}
async function downloadPNG(svgString,filename,t){
  const wrap=document.createElement("div");wrap.style.cssText="position:fixed;top:-9999px;left:-9999px;visibility:hidden;";wrap.innerHTML=svgString;document.body.appendChild(wrap);
  const svgEl=wrap.querySelector("svg")||wrap.firstElementChild;
  if(!svgEl||svgEl.tagName.toLowerCase()!=="svg"){document.body.removeChild(wrap);alert(t.svgNotFound);return;}
  const vb=svgEl.getAttribute("viewBox");let w=parseFloat(svgEl.getAttribute("width"))||0,h=parseFloat(svgEl.getAttribute("height"))||0;
  if(vb){const p=vb.trim().split(/[\s,]+/);if(!w)w=parseFloat(p[2])||0;if(!h)h=parseFloat(p[3])||0;}
  w=Math.round(w)||1200;h=Math.round(h)||800;svgEl.setAttribute("width",w);svgEl.setAttribute("height",h);
  svgEl.querySelectorAll("*").forEach(el=>{if(el.style?.fontFamily)el.style.fontFamily="Arial, sans-serif";if(el.getAttribute("font-family"))el.setAttribute("font-family","Arial, sans-serif");});
  const clean=new XMLSerializer().serializeToString(svgEl);document.body.removeChild(wrap);
  const img=new Image();
  img.onload=()=>{const c=document.createElement("canvas");c.width=w*2;c.height=h*2;const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);ctx.scale(2,2);ctx.drawImage(img,0,0,w,h);const a=document.createElement("a");a.href=c.toDataURL("image/png");a.download=filename;a.click();};
  img.onerror=()=>alert(t.pngError);
  img.src=`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clean)))}`;
}

// ─── Zoom button style ────────────────────────────────────────────────────────

const zoomBtnStyle={width:26,height:26,border:"1px solid var(--border2)",borderRadius:5,background:"var(--bg2)",color:"var(--text)",cursor:"pointer",fontSize:16,lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center"};

// ─── HTML viewer ──────────────────────────────────────────────────────────────

function HtmlView({content}){
  const[zoom,setZoom]=useState(1);
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{position:"absolute",top:10,right:10,zIndex:10,display:"flex",gap:4,alignItems:"center"}}>
        <button onClick={()=>setZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))} style={zoomBtnStyle}>+</button>
        <span style={{fontSize:11,color:"var(--text2)",minWidth:38,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)))} style={zoomBtnStyle}>−</button>
        <button onClick={()=>setZoom(1)} style={zoomBtnStyle}>⊙</button>
      </div>
      <div style={{flex:1,overflow:"auto",background:"#f0f0f0"}}>
        <div style={{transformOrigin:"top left",transform:`scale(${zoom})`,width:`${100/zoom}%`,minHeight:`${100/zoom}%`}}>
          <iframe srcDoc={content} style={{width:"100%",height:`${100/zoom}vh`,border:"none",background:"#fff",display:"block"}} sandbox="allow-scripts allow-same-origin"/>
        </div>
      </div>
    </div>
  );
}

// ─── Mermaid renderer ─────────────────────────────────────────────────────────

function MermaidView({code,onSvgReady,t}){
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0, y:0});
  const dragging = useRef(false);
  const dragStart = useRef({mx:0, my:0, px:0, py:0});
  const wheelContainerRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({x:0, y:0});

  useEffect(()=>{
    setZoom(1); setPan({x:0,y:0}); zoomRef.current=1; panRef.current={x:0,y:0};
    if(!ref.current||!code)return;
    setErr(null); ref.current.innerHTML="";
    const renderId="mg"+Date.now()+Math.random().toString(36).slice(2);
    const cleanCode=(()=>{
      let c=code.replace(/<br\s*\/?>/gi," ").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/^\s*```[a-z]*\s*/i,"").replace(/\s*```\s*$/i,"")
        .replace(/Note\s+over\s+(\w+)(?:,\w+){2,}/gi,m=>{const p=m.replace(/Note\s+over\s+/i,"").split(",");return `Note over ${p[0]},${p[p.length-1]}`;})
        .replace(/-->\|"([^"]+)"\|/g,"-->|$1|").replace(/^.*-->\|[^|]*\]\s*$/gm,"")
        .replace(/^\s*"[^"]+"\s*-+[->]+.*$/gm,"")
        .replace(/^(\s*subgraph\s+\w+\s*\[)([^\]]*)\]/gm,(m,pre,lbl)=>pre+lbl.replace(/[()]/g,"")+"]")
        .replace(/^(\s*subgraph\s+)([^\s\[]+)/gm,(m,pre,id)=>pre+id.replace(/[^\w]/g,"_"));
      if(/^\s*timeline/i.test(c))c=c.replace(/^(\s+)(.+?)\s*:\s*(\d{1,2}:\d{2})\s*$/gm,"$1$3 : $2");
      return c.trim();
    })();
    const doRender=c=>{
      try{
        const dark=matchMedia("(prefers-color-scheme: dark)").matches;
        window.mermaid.initialize({startOnLoad:false,theme:dark?"dark":"default",securityLevel:"loose",sequence:{useMaxWidth:false},flowchart:{useMaxWidth:false}});
        window.mermaid.render(renderId,c).then(({svg})=>{
          if(!ref.current)return;
          ref.current.innerHTML=svg;
          const el=ref.current.querySelector("svg");if(!el)return;
          const vb=el.getAttribute("viewBox");let nW=0,nH=0;
          if(vb){const p=vb.trim().split(/[\s,]+/);nW=parseFloat(p[2])||0;nH=parseFloat(p[3])||0;}
          el.removeAttribute("width");el.removeAttribute("height");
          el.style.maxWidth="none";el.style.display="block";el.style.margin="0";
          if(nW>0)el.style.width=nW+"px";if(nH>0)el.style.height=nH+"px";
          ref.current.dataset.naturalW=nW||800;
          onSvgReady?.(new XMLSerializer().serializeToString(el));
        }).catch(e=>setErr(String(e)));
      }catch(e){setErr(String(e));}
    };
    if(window.mermaid&&window.mermaid.VERSION?.startsWith("11")){doRender(cleanCode);return;}
    delete window.mermaid;
    document.querySelectorAll('script[src*="mermaid"]').forEach(s=>s.remove());
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js?v="+Date.now();
    script.onload=()=>doRender(cleanCode);script.onerror=()=>setErr(t.mermaidLoad);
    document.head.appendChild(script);
  },[code]);

  // Нативный wheel — {passive:false} чтобы preventDefault работал
  useEffect(()=>{
    const el=wheelContainerRef.current;
    if(!el)return;
    const handler=e=>{
      e.preventDefault();
      const oldZoom=zoomRef.current;
      const newZoom=Math.min(10,Math.max(0.1,oldZoom*(1-e.deltaY*0.001)));
      if(Math.abs(newZoom-oldZoom)<0.0001)return;
      const rect=el.getBoundingClientRect();
      const mouseX=e.clientX-rect.left;
      const mouseY=e.clientY-rect.top;
      const curPan=panRef.current;
      const contentX=(mouseX-curPan.x)/oldZoom;
      const contentY=(mouseY-curPan.y)/oldZoom;
      const newPan={x:mouseX-contentX*newZoom, y:mouseY-contentY*newZoom};
      zoomRef.current=newZoom;
      panRef.current=newPan;
      setZoom(newZoom);
      setPan(newPan);
    };
    el.addEventListener("wheel",handler,{passive:false});
    return()=>el.removeEventListener("wheel",handler);
  });

  const onMouseDown=e=>{dragging.current=true;dragStart.current={mx:e.clientX,my:e.clientY,px:panRef.current.x,py:panRef.current.y};};
  const onMouseMove=e=>{if(!dragging.current)return;const newPan={x:dragStart.current.px+e.clientX-dragStart.current.mx,y:dragStart.current.py+e.clientY-dragStart.current.my};panRef.current=newPan;setPan(newPan);};
  const onMouseUp=()=>{dragging.current=false;};

  if(err)return<pre style={{padding:16,color:"#c0392b",fontSize:12,whiteSpace:"pre-wrap",userSelect:"text",cursor:"text"}}>{t.mermaidError}{err}</pre>;

  return(
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden"}}>
      <div style={{position:"absolute",top:10,right:10,zIndex:10,display:"flex",gap:4,alignItems:"center"}}>
        <button onClick={()=>{zoomRef.current=zoom+0.2<=10?zoom+0.2:10;setZoom(zoomRef.current);}} style={zoomBtnStyle}>+</button>
        <span style={{fontSize:11,color:"var(--text2)",minWidth:38,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
        <button onClick={()=>{zoomRef.current=zoom-0.2>=0.1?zoom-0.2:0.1;setZoom(zoomRef.current);}} style={zoomBtnStyle}>−</button>
        <button onClick={()=>{zoomRef.current=1;panRef.current={x:0,y:0};setZoom(1);setPan({x:0,y:0});}} style={zoomBtnStyle} title="Reset">⊙</button>
        <button onClick={()=>{
          if(wheelContainerRef.current){
            const cW=wheelContainerRef.current.clientWidth;
            const nW=parseFloat(ref.current?.dataset.naturalW)||800;
            const nZ=cW/nW;
            zoomRef.current=nZ;panRef.current={x:0,y:0};
            setZoom(nZ);setPan({x:0,y:0});
          }
        }} style={{...zoomBtnStyle,fontSize:12,width:32}} title="Fit width">⇔</button>
      </div>
      <div ref={wheelContainerRef} style={{width:"100%",height:"100%",overflow:"hidden",cursor:dragging.current?"grabbing":"grab"}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <div ref={ref} style={{transformOrigin:"0 0",transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,padding:"24px",display:"inline-block"}}/>
      </div>
    </div>
  );
}
// ─── Markdown renderer ────────────────────────────────────────────────────────

function inlineMarkdown(text){
  const parts=[];const re=/(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;let last=0,m;
  while((m=re.exec(text))!==null){if(m.index>last)parts.push(text.slice(last,m.index));if(m[0].startsWith("**"))parts.push(<strong key={m.index}>{m[2]}</strong>);else if(m[0].startsWith("*"))parts.push(<em key={m.index}>{m[3]}</em>);else parts.push(<code key={m.index} style={{background:"var(--bg3)",borderRadius:3,padding:"0 4px",fontSize:"0.9em",fontFamily:"var(--mono)"}}>{m[4]}</code>);last=m.index+m[0].length;}
  if(last<text.length)parts.push(text.slice(last));
  return parts.length===1&&typeof parts[0]==="string"?parts[0]:parts;
}
function renderMarkdown(text){
  if(!text)return null;
  const lines=text.split("\n");const elements=[];let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(/^### (.+)/.test(line)){elements.push(<div key={i} style={{fontWeight:500,fontSize:13,marginTop:8,marginBottom:2}}>{line.slice(4)}</div>);i++;continue;}
    if(/^## (.+)/.test(line)){elements.push(<div key={i} style={{fontWeight:500,fontSize:14,marginTop:10,marginBottom:2}}>{line.slice(3)}</div>);i++;continue;}
    if(/^# (.+)/.test(line)){elements.push(<div key={i} style={{fontWeight:500,fontSize:15,marginTop:12,marginBottom:4}}>{line.slice(2)}</div>);i++;continue;}
    if(/^\d+\. (.+)/.test(line)){const items=[];while(i<lines.length&&/^\d+\. (.+)/.test(lines[i])){const m=lines[i].match(/^(\d+)\. (.+)/);items.push(<li key={i} style={{marginBottom:2}}>{inlineMarkdown(m[2])}</li>);i++;}elements.push(<ol key={`ol-${i}`} style={{margin:"4px 0",paddingLeft:20}}>{items}</ol>);continue;}
    if(/^[\*\-] (.+)/.test(line)){const items=[];while(i<lines.length&&/^[\*\-] (.+)/.test(lines[i])){const m=lines[i].match(/^[\*\-] (.+)/);items.push(<li key={i} style={{marginBottom:2}}>{inlineMarkdown(m[1])}</li>);i++;}elements.push(<ul key={`ul-${i}`} style={{margin:"4px 0",paddingLeft:20}}>{items}</ul>);continue;}
    if(/^```/.test(line)){const cl=[];i++;while(i<lines.length&&!/^```/.test(lines[i])){cl.push(lines[i]);i++;}elements.push(<pre key={i} style={{background:"var(--bg3)",borderRadius:4,padding:"6px 10px",fontSize:11,fontFamily:"var(--mono)",overflowX:"auto",margin:"4px 0",whiteSpace:"pre-wrap"}}>{cl.join("\n")}</pre>);i++;continue;}
    if(/^---+$/.test(line.trim())){elements.push(<hr key={i} style={{border:"none",borderTop:"1px solid var(--border)",margin:"6px 0"}}/>);i++;continue;}
    if(!line.trim()){elements.push(<div key={i} style={{height:4}}/>);i++;continue;}
    elements.push(<div key={i} style={{marginBottom:2}}>{inlineMarkdown(line)}</div>);i++;
  }
  return elements;
}

// ─── Components ───────────────────────────────────────────────────────────────

function CopyButton({text,t}){
  const[copied,setCopied]=useState(false);
  const copy=async()=>{try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}setCopied(true);setTimeout(()=>setCopied(false),1800);};
  return<button onClick={copy} className="btn-secondary btn-sm">{copied?t.copied:t.copy}</button>;
}

function ArtifactPreview({artifact,viewMode,streaming,onSvgReady,t,onCodeEdit}){
  if(!artifact)return(<div className="artifact-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg><span>{t.artifactEmpty}</span></div>);
  if(viewMode==="code")return(
    <div style={{position:"relative",height:"100%",display:"flex",flexDirection:"column"}}>
      <div style={{position:"absolute",top:10,right:10,zIndex:10,display:"flex",gap:6}}>
        <CopyButton text={artifact.content} t={t}/>
        <button className="btn-secondary btn-sm" onClick={()=>onCodeEdit(artifact.content)} style={{fontSize:11}}>{t.saveVersion}</button>
      </div>
      <textarea className="code-view" value={artifact.content} onChange={e=>onCodeEdit(e.target.value,false)} spellCheck={false}
        style={{resize:"none",outline:"none",border:"none",fontFamily:"var(--mono)",fontSize:12,lineHeight:1.6,padding:16,flex:1,background:"var(--bg2)",color:"var(--text)",userSelect:"text",cursor:"text",overflowY:"auto"}}/>
    </div>
  );
  if(streaming)return<div className="artifact-empty"><span className="spin">⟳</span> {t.generating}</div>;
  if(artifact.type==="mermaid")return<div style={{width:"100%",height:"100%"}}><MermaidView code={artifact.content} onSvgReady={onSvgReady} t={t}/></div>;
  if(artifact.type==="html")return<HtmlView content={artifact.content}/>;
  if(artifact.type==="svg")return<div style={{padding:16,overflowY:"auto",height:"100%"}} dangerouslySetInnerHTML={{__html:artifact.content}}/>;
  return<div className="markdown-view">{artifact.content}</div>;
}

function StatusBadge({status,t}){
  const map={idle:{cls:"status-idle",text:t.statusIdle},checking:{cls:"status-checking",text:t.statusChecking},ok:{cls:"status-ok",text:t.statusOk},error:{cls:"status-error",text:t.statusError}};
  const{cls,text}=map[status]||map.idle;
  return<div className={`status-badge ${cls}`}><span className="status-dot"/>{text}</div>;
}

function SettingsPanel({cfg,setCfg,status,onTest,t}){
  const[ollamaModels,setOllamaModels]=useState([]);const[loadingM,setLoadingM]=useState(false);
  const fetchModels=async base=>{setLoadingM(true);try{const r=await fetch(`${base}/api/tags`);const d=await r.json();const names=(d.models||[]).map(m=>m.name);setOllamaModels(names);if(names.length>0&&!names.includes(cfg.ollamaModel))setCfg(c=>({...c,ollamaModel:names[0]}));}catch{setOllamaModels([]);}setLoadingM(false);};
  useEffect(()=>{if(cfg.provider==="ollama")fetchModels(cfg.ollamaBase);},[cfg.provider,cfg.ollamaBase]);
  return(
    <div className="settings-panel">
      <div className="field"><label>{t.provider}</label><div className="toggle-group">{["claude","ollama"].map(p=>(<button key={p} className={`toggle-btn ${cfg.provider===p?"active":""}`} onClick={()=>setCfg(c=>({...c,provider:p}))}>{p==="claude"?"☁ Claude API":"⚡ Ollama"}</button>))}</div></div>
      {cfg.provider==="claude"&&<><div className="field"><label>{t.model}</label><select value={cfg.claudeModel} onChange={e=>setCfg(c=>({...c,claudeModel:e.target.value}))}>{CLAUDE_MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></div><div className="info-box">{t.proxyNote}</div></>}
      {cfg.provider==="ollama"&&<><div className="field"><label>{t.ollamaUrl}</label><input value={cfg.ollamaBase} placeholder="http://localhost:11434" onChange={e=>setCfg(c=>({...c,ollamaBase:e.target.value}))}/></div><div className="field"><label>{t.model} {loadingM&&<span className="muted">({t.loadingModels})</span>}</label>{ollamaModels.length>0?<select value={cfg.ollamaModel} onChange={e=>setCfg(c=>({...c,ollamaModel:e.target.value}))}>{ollamaModels.map(m=><option key={m} value={m}>{m}</option>)}</select>:<input value={cfg.ollamaModel} placeholder="llama3.2" onChange={e=>setCfg(c=>({...c,ollamaModel:e.target.value}))}/>}</div><button className="btn-secondary" onClick={()=>fetchModels(cfg.ollamaBase)}>{t.updateModels}</button></>}
      <button className="btn-secondary" onClick={onTest}>{t.checkConnection}</button>
      <StatusBadge status={status} t={t}/>
    </div>
  );
}

function useResizer(initPct=42){
  const[pct,setPct]=useState(initPct);const dragging=useRef(false);const containerRef=useRef(null);
  const onMouseDown=useCallback(e=>{e.preventDefault();dragging.current=true;const onMove=ev=>{if(!dragging.current||!containerRef.current)return;const rect=containerRef.current.getBoundingClientRect();setPct(Math.min(75,Math.max(20,((ev.clientX-rect.left)/rect.width)*100)));};const onUp=()=>{dragging.current=false;};window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp,{once:true});},[]);
  return{pct,containerRef,onMouseDown};
}

function Bubble({msg,lang}){
  const isUser=msg.role==="user";
  const[patchOpen,setPatchOpen]=useState(false);
  const patches=msg.patches||[];
  const hasPatches=patches.length>0;
  const patchLabel = patches.length===1
    ? (lang==="ru" ? "изменение" : "change")
    : (lang==="ru" ? "изменения" : "changes");
  return(
    <div className={`bubble-wrap ${isUser?"user":"assistant"}`}>
      <div className={`bubble ${isUser?"bubble-user":"bubble-assistant"}`} style={{textAlign:"left"}}>
        {isUser?(msg.text||<span className="muted italic">...</span>):(msg.text?renderMarkdown(msg.text):<span className="muted italic">...</span>)}
        {hasPatches&&(
          <div style={{marginTop:8}}>
            <button onClick={()=>setPatchOpen(o=>!o)} style={{border:"none",background:"var(--bg3)",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",color:"var(--text2)",display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:10}}>{patchOpen?"▾":"▸"}</span>
              {patches.length} {patchLabel}
            </button>
            {patchOpen&&(
              <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:6}}>
                {patches.map((p,i)=>(
                  <div key={i} style={{fontSize:11,fontFamily:"var(--mono)",borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
                    <div style={{background:"#FCEBEB",color:"#A32D2D",padding:"4px 8px",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
                      {p.old.split("\n").map((l,j)=><div key={j}>− {l}</div>)}
                    </div>
                    <div style={{background:"#EAF3DE",color:"#3B6D11",padding:"4px 8px",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
                      {p.new.split("\n").map((l,j)=><div key={j}>+ {l}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExportMenu({artifact,svgString,t}){
  const[open,setOpen]=useState(false);if(!artifact)return null;
  const title=artifact.title.replace(/\s+/g,"_");const actions=[];
  if((artifact.type==="mermaid"||artifact.type==="svg")&&svgString){actions.push({label:t.downloadSvg,fn:()=>downloadSVGString(svgString,`${title}.svg`)});actions.push({label:t.downloadPng,fn:()=>downloadPNG(svgString,`${title}.png`,t)});}
  if(artifact.type==="html")actions.push({label:t.downloadHtml,fn:()=>downloadText(`${title}.html`,artifact.content)});
  if(artifact.type==="markdown")actions.push({label:t.downloadMd,fn:()=>downloadText(`${title}.md`,artifact.content)});
  actions.push({label:t.downloadRtf,fn:()=>downloadRTF(artifact)});
  actions.push({label:t.downloadSrc,fn:()=>downloadText(`${title}.txt`,artifact.content)});
  return(<div style={{position:"relative"}}><button className="btn-secondary btn-sm" onClick={()=>setOpen(o=>!o)}>{t.export}</button>{open&&(<div className="export-menu" onMouseLeave={()=>setOpen(false)}>{actions.map(a=><button key={a.label} className="export-item" onClick={()=>{a.fn();setOpen(false);}}>{a.label}</button>)}</div>)}</div>);
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App(){
  const[lang,setLang]=useState(()=>localStorage.getItem("as_lang")||"ru");
  const t=T[lang];
  const toggleLang=()=>{const next=lang==="ru"?"en":"ru";setLang(next);localStorage.setItem("as_lang",next);};

  const[cfg,setCfg]=useState(()=>{try{const s=JSON.parse(localStorage.getItem("as_cfg")||"{}");return{provider:s.provider||"ollama",claudeModel:s.claudeModel||"claude-sonnet-4-20250514",ollamaBase:s.ollamaBase||"http://localhost:11434",ollamaModel:s.ollamaModel||"llama3.2"};}catch{return{provider:"ollama",claudeModel:"claude-sonnet-4-20250514",ollamaBase:"http://localhost:11434",ollamaModel:"llama3.2"};}});
  useEffect(()=>{localStorage.setItem("as_cfg",JSON.stringify(cfg));},[cfg]);

  const[status,setStatus]=useState("idle");
  const[showSettings,setShowSettings]=useState(false);
  const[showSessions,setShowSessions]=useState(false);
  const[sessionId,setSessionId]=useState(()=>genId());
  const[messages,setMessages]=useState([]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[artifact,setArtifact]=useState(null);
  const[streamingArtifact,setStreamingArtifact]=useState(null);
  const[viewMode,setViewMode]=useState("preview");
  const[history,setHistory]=useState([]);
  const[histIdx,setHistIdx]=useState(-1);
  const[toast,setToast]=useState(null);
  const[historyMeta,setHistoryMeta]=useState([]);
  const[svgString,setSvgString]=useState(null);
  const[attachments,setAttachments]=useState([]);
  const[fullscreen,setFullscreen]=useState(false);
  const fileInputRef=useRef(null);
  const bottomRef=useRef(null);
  const{pct,containerRef,onMouseDown}=useResizer(42);

  useEffect(()=>{if(!messages.length)return;saveSession({id:sessionId,title:sessionTitle(messages),messages,artifactHistory:history,currentArtifact:artifact,updatedAt:Date.now()});},[messages,history,artifact]);

  const showToast=useCallback(text=>{setToast(text);setTimeout(()=>setToast(null),3000);},[]);

  const startNewChat=()=>{setSessionId(genId());setMessages([]);setArtifact(null);setStreamingArtifact(null);setHistory([]);setHistIdx(-1);setSvgString(null);setAttachments([]);setViewMode("preview");setShowSessions(false);setShowSettings(false);setHistoryMeta([]);setToast(null);};
  const loadSessionData=s=>{setSessionId(s.id);setMessages(s.messages||[]);setHistory(s.artifactHistory||[]);setArtifact(s.currentArtifact||null);setHistIdx((s.artifactHistory||[]).length-1);setSvgString(null);setViewMode("preview");setShowSessions(false);setHistoryMeta((s.artifactHistory||[]).map(()=>({type:"new"})));setToast(null);};

  useEffect(()=>{
    const onKey = e => { if(e.key==="Escape" && fullscreen) setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[fullscreen]);

  useEffect(()=>{if(window.hljs)return;const link=document.createElement("link");link.rel="stylesheet";link.href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-light.min.css";document.head.appendChild(link);const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js";script.onload=()=>{window.hljs.configure({ignoreUnescapedHTML:true});document.querySelectorAll("pre code").forEach(el=>window.hljs.highlightElement(el));};document.head.appendChild(script);},[]);
  useEffect(()=>{if(viewMode==="code"&&window.hljs)setTimeout(()=>document.querySelectorAll("pre code").forEach(el=>window.hljs.highlightElement(el)),50);},[viewMode,artifact]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const handleFiles=async files=>{const rem=MAX_FILES-attachments.length;if(rem<=0){alert(t.attachLimit);return;}const res=await Promise.all(Array.from(files).slice(0,rem).map(f=>readFile(f,t)));setAttachments(prev=>[...prev,...res.filter(Boolean)]);};
  const handleDrop=useCallback(e=>{e.preventDefault();if(e.dataTransfer.files.length)handleFiles(e.dataTransfer.files);},[attachments,t]);
  const testConnection=async()=>{setStatus("checking");try{if(cfg.provider==="claude"){const r=await fetch(`${CLAUDE_BASE}/v1/models`,{headers:{"Content-Type":"application/json"}});setStatus(r.ok?"ok":"error");}else{const r=await fetch(`${cfg.ollamaBase}/api/tags`);setStatus(r.ok?"ok":"error");}}catch{setStatus("error");}};

  const sendMessage=useCallback(async()=>{
    const txt=input.trim();if(!txt||loading)return;
    setInput("");
    const userMsg={role:"user",text:txt};
    const asstMsg={role:"assistant",text:""};
    setMessages(prev=>[...prev,userMsg,asstMsg]);
    setLoading(true);setStreamingArtifact(null);
    const currentAttachments=[...attachments];setAttachments([]);
    const currentArt=artifact;
    const histMsgs=[...messages,userMsg].map((m,i)=>{
      const isLast=i===messages.length;
      let content=m.text;
      if(isLast&&currentArt)content=`${content}\n\n[Current artifact — type: ${currentArt.type}, title: "${currentArt.title}"]\nCONTENT:\n${currentArt.content}\n\nTo edit this artifact return <patch> blocks where <old> and <new> contain fragments from CONTENT above. Do NOT reference the artifact wrapper tags. If creating new or large changes return full <artifact>.`;
      if(isLast&&currentAttachments.length){if(cfg.provider==="ollama")return buildOllamaMessage(content,currentAttachments);return{role:"user",content:buildContent(content,currentAttachments)};}
      return{role:m.role,content};
    });
    let full="";
    const update=chunk=>{
      full+=chunk;
      const artOpen=full.indexOf("<artifact");const artClose=full.indexOf("</artifact>");const patchOpen=full.indexOf("<patch>");
      if(artOpen!==-1){
        const headerEnd=full.indexOf(">",artOpen);
        if(headerEnd!==-1){const header=full.slice(artOpen,headerEnd+1);const tm=header.match(/type="([^"]+)"/);const titm=header.match(/title="([^"]*)"/);const partContent=artClose!==-1?full.slice(headerEnd+1,artClose).trim():full.slice(headerEnd+1).trim();setStreamingArtifact({type:tm?.[1]||"mermaid",title:titm?.[1]||"Artifact",content:partContent});setViewMode("code");}
        setMessages(prev=>{const n=[...prev];n[n.length-1]={role:"assistant",text:full.slice(0,artOpen).trim()};return n;});
      }else if(patchOpen!==-1){
        setMessages(prev=>{const n=[...prev];n[n.length-1]={role:"assistant",text:full.slice(0,patchOpen).trim()};return n;});
      }else{
        setMessages(prev=>{const n=[...prev];n[n.length-1]={role:"assistant",text:full.trim()};return n;});
      }
    };
    try{
      const stream=cfg.provider==="claude"?streamClaude(cfg.claudeModel,histMsgs):streamOllama(cfg.ollamaBase,cfg.ollamaModel,histMsgs);
      for await(const chunk of stream)update(chunk);
    }catch(e){
      setMessages(prev=>{const n=[...prev];n[n.length-1]={role:"assistant",text:"Error: "+e.message};return n;});
    }

    // ── Финализация ──
    const patches=parsePatches(full);
    console.log("FULL RESPONSE:", full.slice(-500));
    console.log("PATCHES:", JSON.stringify(patches, null, 2));
    if(currentArt) console.log("ARTIFACT:", currentArt.content.slice(0, 300));
    if(full.includes("<patch>")&&patches.length===0)console.warn("Patch tag found but parsing failed. Raw:",full);

    if(patches.length>0&&currentArt){
      const{result,applied}=applyPatches(currentArt.content,patches);
      if(applied>0){
        const patched={...currentArt,content:result};
        setArtifact(patched);setStreamingArtifact(null);
        setHistory(h=>{const nh=[...h,patched];setHistIdx(nh.length-1);return nh;});
        setHistoryMeta(hm=>[...hm,{type:"patch",count:applied}]);
        setSvgString(null);setViewMode("preview");
        showToast(`✓ ${applied} ${applied===1?t.changes:t.changes2}`);
        // Сохраняем патчи в сообщение для отображения
        setMessages(prev=>{const n=[...prev];n[n.length-1]={...n[n.length-1],patches:patches.slice(0,applied)};return n;});
      }else{
        console.warn("Patch not applied, trying full replacement.");
        const fullArt=parseArtifact(full);
        if(fullArt){setArtifact(fullArt);setStreamingArtifact(null);setHistory(h=>{const nh=[...h,fullArt];setHistIdx(nh.length-1);return nh;});setHistoryMeta(hm=>[...hm,{type:"new"}]);setSvgString(null);setViewMode("preview");}
        else setStreamingArtifact(null);
      }
    }else{
      const finalArt=parseArtifact(full);
      if(finalArt){setArtifact(finalArt);setStreamingArtifact(null);setHistory(h=>{const nh=[...h,finalArt];setHistIdx(nh.length-1);return nh;});setHistoryMeta(hm=>[...hm,{type:"new"}]);setSvgString(null);setViewMode("preview");}
      else setStreamingArtifact(null);
    }
    setLoading(false);
  },[input,loading,messages,cfg,attachments,artifact,t,showToast,lang]);

  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}};
  const handleCodeEdit=useCallback((newContent,saveAsVersion=true)=>{
    if(!artifact)return;
    const updated={...artifact,content:newContent};
    setArtifact(updated);
    if(saveAsVersion){setHistory(h=>{const nh=[...h,updated];setHistIdx(nh.length-1);return nh;});setHistoryMeta(hm=>[...hm,{type:"patch",count:0}]);setSvgString(null);}
  },[artifact]);
  const goHist=dir=>{const ni=histIdx+dir;if(ni<0||ni>=history.length)return;setHistIdx(ni);setArtifact(history[ni]);setViewMode("preview");};

  const displayArtifact=streamingArtifact||artifact;
  const isStreaming=!!streamingArtifact;
  const provLabel=cfg.provider==="claude"?(CLAUDE_MODELS.find(m=>m.id===cfg.claudeModel)?.label||cfg.claudeModel):cfg.ollamaModel;

  return(
    <div ref={containerRef} className="app-root">
      <div className="chat-panel" style={{width:`${pct}%`,display:"flex",flexDirection:"column"}}>
        <div className="panel-header">
          <div>
            <div className="app-title">{t.appTitle}</div>
            <div className="app-subtitle"><span className={`dot dot-${status==="ok"?"ok":status==="error"?"error":"idle"}`}/>{provLabel}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="btn-secondary btn-sm" onClick={toggleLang} style={{fontWeight:600,minWidth:34}}>{lang==="ru"?"EN":"RU"}</button>
            <button className="btn-secondary btn-sm" onClick={()=>{setShowSessions(s=>!s);setShowSettings(false);}} style={{background:showSessions?"var(--bg3)":undefined}}>☰</button>
            <button className="btn-secondary btn-sm" onClick={()=>{setShowSettings(s=>!s);setShowSessions(false);}}>{showSettings?t.chat:t.settings}</button>
          </div>
        </div>
        {showSessions
          ?<SessionsSidebar currentId={sessionId} onSelect={loadSessionData} onNew={startNewChat} onDelete={id=>{if(id===sessionId)startNewChat();}} t={t} lang={lang}/>
          :showSettings
            ?<SettingsPanel cfg={cfg} setCfg={setCfg} status={status} onTest={testConnection} t={t}/>
            :<>
              <div className="messages" onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
                {messages.length===0&&(<div className="placeholder"><div className="placeholder-icon">✦</div>{t.placeholder1}<br/>{t.placeholder2}<br/>{t.placeholder3}<br/>{t.placeholder4}</div>)}
                {messages.map((m,i)=><Bubble key={i} msg={m} lang={lang}/>)}
                <div ref={bottomRef}/>
              </div>
              <AttachmentPreview attachments={attachments} onRemove={i=>setAttachments(a=>a.filter((_,j)=>j!==i))}/>
              <div className="input-row">
                <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.xml,.yaml,.yml" style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
                <button className="btn-secondary btn-sm" title={t.attachTooltip} onClick={()=>fileInputRef.current?.click()} style={{flexShrink:0,fontSize:18,padding:"0 8px",height:36}}>📎</button>
                <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} rows={1}
                  placeholder={artifact?(lang==="ru"?`Сообщение... или "исправь ${artifact.title}"`:`Message... or "fix ${artifact.title}"`):t.inputPlaceholder}
                  className="chat-input" onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}/>
                <button onClick={sendMessage} disabled={loading||!input.trim()} className={`send-btn ${loading||!input.trim()?"disabled":""}`}>{loading?t.sending:t.send}</button>
              </div>
            </>
        }
      </div>

      <div className="resizer" onMouseDown={onMouseDown}/>

      <div className="artifact-panel" style={fullscreen ? {
        position:"fixed", top:0, left:0, width:"100vw", height:"100vh",
        zIndex:1000, background:"var(--bg)", display:"flex", flexDirection:"column"
      } : {}}>
        <div className="panel-header">
          <span className="artifact-title">
            {displayArtifact?`${displayArtifact.title} · ${displayArtifact.type}`:t.artifact}
            {isStreaming&&<span className="muted" style={{marginLeft:8,fontSize:11}}>{t.generating}</span>}
          </span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {history.length>1&&(
              <div className="version-nav">
                <button onClick={()=>goHist(-1)} disabled={histIdx<=0} className="ver-btn">←</button>
                <span style={{display:"flex",alignItems:"center",gap:4}}>
                  v{histIdx+1}/{history.length}
                  {historyMeta[histIdx]&&(
                    <span style={{fontSize:10,padding:"1px 5px",borderRadius:4,fontWeight:500,background:historyMeta[histIdx].type==="patch"?"#EAF3DE":"#E6F1FB",color:historyMeta[histIdx].type==="patch"?"#3B6D11":"#185FA5"}}>
                      {historyMeta[histIdx].type==="patch"?`✏ ${historyMeta[histIdx].count}`:"✦ new"}
                    </span>
                  )}
                </span>
                <button onClick={()=>goHist(1)} disabled={histIdx>=history.length-1} className="ver-btn">→</button>
              </div>
            )}
            <ExportMenu artifact={artifact} svgString={svgString} t={t}/>
            {displayArtifact&&["preview","code"].map(m=>(<button key={m} onClick={()=>setViewMode(m)} className={`tab-btn ${viewMode===m?"active":""}`}>{m==="preview"?t.preview:t.code}</button>))}
            <button
              className="btn-secondary btn-sm"
              onClick={()=>setFullscreen(f=>!f)}
              title={fullscreen ? t.exitFullscreen : t.fullscreen}
              style={{fontSize:14, padding:"0 8px"}}
            >
              {fullscreen ? "✕" : "⛶"}
            </button>
          </div>
        </div>
        <div className="artifact-content" style={{position:"relative"}}>
          {toast&&(
            <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#3B6D11",color:"#fff",padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:500,zIndex:100,pointerEvents:"none",animation:"fadeInUp 0.2s ease",boxShadow:"0 2px 12px rgba(0,0,0,0.15)"}}>
              {toast}
            </div>
          )}
          <ArtifactPreview artifact={displayArtifact} viewMode={viewMode} streaming={isStreaming} onSvgReady={str=>setSvgString(str)} t={t} onCodeEdit={handleCodeEdit}/>
        </div>
      </div>
    </div>
  );
}