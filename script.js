"use strict";

const OWNER = "CLEMENS MÖLLER";
const PROMPT_ROOT = "C:\\Users\\Guest";
const START_DIR = "/home";
const THEMES = ["dark","light","matrix"];
const ASCII_BANNER = String.raw`
                                                                            
   (    (                                (  \               (   (             
   )\\   )\\   (     )      (              )\\))(          (  )\\  )\\   (    
 (((_) ((_) ))\\   (      ))\\  (     (   ((_)()\\   (    ))\\((_)((_) ))\\   
 )\\___  _  /((_)  )\\  / /((_) )\\ )  )\\  (_()((_)  )\\  /((_)_   _  /((_)
((/ __|| |(_))  _((_)) (_))  _(_/( ((_) |  \/  | (((_))// | | | |(_))   ((_) 
 | (__ | |/ -_)| '  \()/ -_)| ' \))(_-< | |\/| |/ _ \/ -_)| | | |/ -_) | '_| 
  \___||_|\___||_|_|_| \___||_||_| /__/ |_|  |_|\___/\___||_| |_|\___| |_|  
`;


(function bootTheme(){ applyTheme(localStorage.getItem("theme") || "dark"); })();

/* ------- Virtual FS ------- */
const fs = (() => {

  const WIDTH = 60;
  const padLine = (left, right = "") => {
    const gap = Math.max(1, WIDTH - left.length - right.length);
    return left + " ".repeat(gap) + right;
  };

  const data = {
    "/": { type: "dir", children: ["home"] },
    "/home": { type: "dir", children: ["about.txt","projects","contact.txt","skills.txt"] },
    "/home/projects": { type: "dir", children: ["not_yet_added.py"] },
    "/home/about.txt": {
      type: "file",
      content: [
        "I am a 24-year-old Information Systems student.",
        "",
        "I love:",
        " - Martial arts",
        " - Pumping iron",
        " - Trading & investing (public and private markets)",
        " - Writing software",
        " - Playing poker",
        " - Reading (my favorite of all time: 'Fooled by Randomness' by Taleb)",
        " - Learning Languages"
      ].join("\n")
    },
    "/home/contact.txt": { 
      type: "file", 
      content: 
      [
        "Contact me here:",
        "",
        " LinkedIn: linkedin.com/in/clemens-möller-8176641a6",
        " E-Mail: info@clemensmoeller.de",
      ].join("\n")
    },
    "/home/cv.txt": {
      type: "file",
      content: [
        "EDUCATION",
        "-".repeat(WIDTH),
        "University of Osnabrück",
        padLine("  Master, Information Systems", "2025-2027"),
        padLine("  Bachelor, Information Systems", "2021-2025"),
        "",
        "University of Pécs Medical School",
        padLine("  Medicine", "2020-2021"),
        "",
        "EXPERIENCE",
        "-".repeat(WIDTH),
        padLine("PwC, Düsseldorf", "Aug-Oct 2025"),
        "  Intern, Deals, Transaction Analytics",
        "",
        "  - Yet to come",
        "",
        padLine("NOZ-Digital, Osnabrück", "Oct 2024-Apr 2025"),
        "  Working Student, Data Engineering",
        "",
        "  - Integration and processing of large, heterogeneous data sets from different sources",
        "  - Participation in the development of an application in the field of generative AI",
        "  - Development of high-performance data models and scalable data architectures"
      ].join("\n")
    },
    "/home/skills.txt": { 
      type: "file",       
      content: 
      [
        "Programming",
        "-".repeat(WIDTH),
        "  - Python, JS, HTML, CSS",
        "",
        "Data",
        "-".repeat(WIDTH),
        "  - SQL, DBT, MySQL / MariaDB, Big Query, Looker Studio",
        "",
        "Languages",
        "-".repeat(WIDTH),
        "  - German, English (Fluent), French (B1), Mandarin (Hsk 2)",
        "",
        "Software",
        "-".repeat(WIDTH),
        "  - Photoshop, Davinci Resolve, GitHub, MS Office Suite",
      ].join("\n")
    },
    "/home/projects/terminal-portfolio.txt": { type: "file", content: "This terminal portfolio. Features: history, themes, virtual file system." },
    "/home/projects/data-viz-lab.txt": { type: "file", content: "Interactive visualizations with Canvas and Web Workers." }
  };

  let onDocClick, onGhostInput, onGhostKeydown, outResizeObs;
  function syncTitlebarPadding(){
    const titlebar = document.querySelector(".titlebar");
    if (!titlebar) return;
    const sbw = out.offsetWidth - out.clientWidth; // vertical scrollbar width
    titlebar.style.paddingRight = `${16 + sbw}px`;
    titlebar.style.paddingLeft = `16px`;
}



  const exists = p => !!data[p];
  const isDir = p => exists(p) && data[p].type === "dir";
  const isFile = p => exists(p) && data[p].type === "file";
  const children = p => isDir(p) ? data[p].children.slice() : [];
  const read = p => isFile(p) ? data[p].content : null;

  function resolve(cwd, input){
    if (!input || input === ".") return cwd;
    if (input === "/") return "/";
    if (input.startsWith("/")) return normalize(input);
    const parts = (cwd + "/" + input).split("/");
    const stack = [];
    for (const part of parts){
      if (!part || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return "/" + stack.join("/");
  }
  function normalize(p){
    const parts = p.split("/"); const stack = [];
    for (const seg of parts){
      if (!seg || seg === ".") continue;
      if (seg === "..") stack.pop();
      else stack.push(seg);
    }
    return "/" + stack.join("/");
  }
  return { exists, isDir, isFile, children, read, resolve, normalize };
})();

/* ------- Terminal ------- */
const term = (() => {
  const out = document.getElementById("output");
  const ghost = document.getElementById("ghost");

  let cwd = START_DIR;
  let history = [];
  let hIndex = -1;
  let activeLine = null;
  let matrixAnim = null;
  

  let onDocClick, onGhostInput, onGhostKeydown, outResizeObs;

  function closeWindow(){
    stopBannerAnimation();
    stopMatrixRain();
    unbindInput();
    const win = document.querySelector(".window");
    if (win) win.classList.add("closed");
    showPostClose();
  }


  function showPostClose(){
  const host = document.querySelector(".desktop");
  const panel = document.createElement("section");
  panel.className = "post-close";
  panel.innerHTML = `
    <div class="inner">
      <div class="line1">Well...</div>
      <div class="line2">Now What?</div>
      <div class="actions" role="group" aria-label="Choices">
        
        <button class="btn btn-blue" data-action="reopen">Go back to the Terminal</button>
      </div>
    </div>
  `;

  // <button class="btn btn-red" data-action="create-life">Create Life</button>
  host.appendChild(panel);

  panel.querySelector('[data-action="reopen"]').addEventListener("click", () => {
    panel.remove();
    reopenTerminal();
  });

  panel.querySelector('[data-action="create-life"]').addEventListener("click", () => {
    const l2 = panel.querySelector(".line2");
    l2.textContent = "…maybe another time.";
  });
  }

  function resetState(){
  cwd = START_DIR;
  history = [];
  hIndex = -1;
  activeLine = null;
  }

  function printWelcome(){
    write("Macrohard Mindows [Version 10.0.26100.4652]");
    write("(c) Macrohard Corporation. All rights reserved.");
    write("");
    write("Tip: Type 'help' to get started.");
    write("");
  }

  function reopenTerminal(){
    const win = document.querySelector(".window");
    if (!win) return;
    win.classList.remove("closed","minimized","maximized");

    stopBannerAnimation();
    stopMatrixRain();
    unbindInput();
    cwd = START_DIR;
    history = [];
    hIndex = -1;
    activeLine = null;
    clear();

    applyTheme("matrix");
    bindInput();
    matrixAnim = startMatrixRain();
    bannerAnim = startBannerAnimation();

    write("Macrohard Mindows [Version 10.0.69005.6420]");
    write("(c) Macrohard Corporation. All rights reserved.");
    write("");
    write("Tip: Type 'help' to get started.");
    write("");
    newInputLine();
    syncTitlebarPadding();
    ghost.focus();
  }



function startMatrixRain(){
  if (document.querySelector(".matrix-canvas")) return { stop: stopMatrixRain };
  const canvas = document.createElement("canvas");
  canvas.className = "matrix-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const CHARS = "0123456789";
  const COLOR = "#00ff6a";
  let fontSize = 14, cols = 0, drops = [], raf = 0;

  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    fontSize = Math.max(12, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    cols = Math.ceil(w / fontSize);
    drops = Array.from({ length: cols }, () => (Math.random() * -20) | 0);
  }

  function tick(){
    const w = window.innerWidth, h = window.innerHeight;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLOR;
    ctx.font = `${fontSize}px ${getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace"}`;
    ctx.textBaseline = "top";
    for (let i = 0; i < cols; i++){
      const x = i * fontSize, y = drops[i] * fontSize;
      const ch = CHARS[(Math.random() * CHARS.length) | 0];
      ctx.fillText(ch, x, y);
      if (y > h && Math.random() > 0.975) drops[i] = 0; else drops[i] += 1;
    }
    raf = requestAnimationFrame(tick);
  }

  function onResize(){ resize(); }
  resize();
  window.addEventListener("resize", onResize);
  raf = requestAnimationFrame(tick);

  return {
    stop(){
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.remove();
    }
  };
}

  function stopMatrixRain(){
    if (matrixAnim){ matrixAnim.stop(); matrixAnim = null; }
  }



  
  function syncTitlebarPadding(){
    const titlebar = document.querySelector(".titlebar");
    if (!titlebar) return;
    const sbw = out.offsetWidth - out.clientWidth;
    titlebar.style.paddingLeft = "16px";
    titlebar.style.paddingRight = `${16 + sbw}px`;
  }

  const toWinPath = unix =>
    unix === "/" ? "C:\\" :
    unix === "/home" ? PROMPT_ROOT :
    unix.startsWith("/home/") ? PROMPT_ROOT + "\\" + unix.slice(6).replace(/\//g,"\\") :
    "C:\\" + unix.replace(/\//g,"\\");

  const promptText = () => `${toWinPath(cwd)}>`;
  const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  function forceScroll(){ requestAnimationFrame(() => requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; })); }

  function write(html){
    const div = document.createElement("div");
    div.className = "line";
    div.innerHTML = html;
    out.appendChild(div);
    forceScroll();
  }
  function writeBlock(text){
    const pre = document.createElement("pre");
    pre.className = "block";
    pre.textContent = text;
    out.appendChild(pre);
    forceScroll();
  }
  function clear(){ out.innerHTML = ""; forceScroll(); }

  function tokenize(s){
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g; const parts = []; let m;
    while ((m = re.exec(s))) parts.push(m[1] ?? m[2] ?? m[3]);
    return parts;
  }

  function newInputLine(){
    const prev = out.querySelector(".input-line");
    if (prev) prev.classList.remove("input-line");
    const line = document.createElement("div");
    line.className = "line input-line";
    line.innerHTML = `<span class="prompt">${escapeHtml(promptText())} </span><span class="typed" id="typed"></span><span class="caret">|</span>`;
    out.appendChild(line);
    activeLine = line;
    ghost.value = "";
    ghost.focus();
    forceScroll();
  }

  function setTyped(text){
    const t = activeLine?.querySelector("#typed");
    if (t){ t.textContent = text; forceScroll(); }
  }

  function submit(){
    const value = ghost.value.trim();
    if (!activeLine) return;
    activeLine.innerHTML = `${escapeHtml(promptText())} ${escapeHtml(value)}`;
    if (value){
      history.push(value);
      hIndex = history.length;
      run(value);
    }
    newInputLine();
  }

  function historyUp(){
    if (!history.length) return;
    if (hIndex > 0) hIndex -= 1;
    ghost.value = history[hIndex] || "";
    setTyped(ghost.value);
  }
  function historyDown(){
    if (!history.length) return;
    if (hIndex < history.length - 1){
      hIndex += 1; ghost.value = history[hIndex];
    } else { hIndex = history.length; ghost.value = ""; }
    setTyped(ghost.value);
  }

  let bannerAnim = null;

  const commands = {
    help(){ writeBlock([
      "Commands:",
      "  help                Show this help",
      "  dir [path]          List directory",
      "  cd [path]           Change directory",
      "  type <file>         Show file",
      "  cls                 Clear screen",
      "  banner [stop]       Animated ASCII banner (1 update/sec)",
      "  echo ...            Print text",
      "  whoami              Show owner",
      "  theme [name]        Switch theme (dark|light|matrix)",
      "  history             Command history"
    ].join("\n")); },

    dir(args){
      const target = fs.resolve(cwd, args[0] || ".");
      if (!fs.exists(target)){ write(`<span class="danger">Path not found:</span> ${escapeHtml(target)}`); return; }
      if (fs.isFile(target)){ write(target.split("/").pop()); return; }
      const items = fs.children(target);
      if (!items.length){ write("<span class='muted'>(empty)</span>"); return; }
      const dirs = items.filter(n => fs.isDir(fs.resolve(target,n))).map(n => n + "\\");
      const files = items.filter(n => fs.isFile(fs.resolve(target,n)));
      writeBlock([...dirs, ...files].join("\n"));
    },

    cd(args){
      const p = args[0];
      const target = fs.resolve(cwd, p || "/home");
      if (!fs.exists(target)){ write(`<span class="danger">The system cannot find the path specified:</span> ${escapeHtml(p || "")}`); return; }
      if (!fs.isDir(target)){ write(`<span class="danger">Not a directory:</span> ${escapeHtml(p)}`); return; }
      cwd = target;
    },

    type(args){
      if (!args[0]){ write("<span class='danger'>Usage:</span> type &lt;file&gt;"); return; }
      const path = fs.resolve(cwd, args[0]);
      if (!fs.exists(path)){ write(`<span class="danger">File not found:</span> ${escapeHtml(args[0])}`); return; }
      if (!fs.isFile(path)){ write(`<span class="danger">Not a file:</span> ${escapeHtml(args[0])}`); return; }
      writeBlock(fs.read(path));
    },

    cls(){ clear(); if (bannerAnim) stopBannerAnimation(); },

    banner(args){
      const action = (args[0] || "").toLowerCase();
      if (action === "stop"){ stopBannerAnimation(); write("Banner animation stopped."); return; }
      stopBannerAnimation();
      bannerAnim = startBannerAnimation();
    },

    echo(args){ write(args.join(" ")); },
    whoami(){ write(OWNER); },

    theme(args){
      const next = (args[0] || "").toLowerCase();
      const set = name => {
        applyTheme(name);
        if (name === "matrix"){
          stopMatrixRain();
          matrixAnim = startMatrixRain();
        } else {
          stopMatrixRain();
        }
        write(`Theme: ${name}`);
      };

      if (!next){
        const current = localStorage.getItem("theme") || "dark";
        const chosen = THEMES[(THEMES.indexOf(current)+1)%THEMES.length];
        set(chosen);
      } else if (THEMES.includes(next)){
        set(next);
      } else {
        write(`<span class="danger">Unknown theme:</span> ${escapeHtml(next)} (dark|light|matrix)`);
      }
    },


    history(){
      if (!history.length){ write("<span class='muted'>(empty)</span>"); return; }
      writeBlock(history.map((h,i)=>`${String(i+1).padStart(2," ")}  ${h}`).join("\n"));
    }
  };

  function startBannerAnimation(){
    const pre = document.createElement("pre");
    pre.className = "banner-anim";
    out.appendChild(pre);

    const rawLines = ASCII_BANNER.replace(/\s+$/,"").split("\n");
    const width = Math.max(...rawLines.map(l => l.length));
    const padded = rawLines.map(l => l.padEnd(width, " "));

    const STATIC_KEEP = 2;
    const dynCount = Math.max(0, padded.length - STATIC_KEEP);
    let current = padded.slice(0, dynCount).map(row => row.split(""));
    const staticTail = padded.slice(dynCount).map(escapeHtml);

    const FLIP_MAP = { "/":"\\", "\\":"/", "(":")", ")":"(", "_":"_" };
    const FLAME_CHARS = new Set(Object.keys(FLIP_MAP));
    const SWAP_PROB = 0.18;
    const RED_TOP_FRAC = 0.45;
    const ORANGE_TOP_FRAC = 0.20;
    const FLICKER_PROB = 0.12;

    const SPAWN_MIN_ROW = Math.min(3, Math.max(0, dynCount - 1));
    const SPAWN_PROB = Math.min(0.05, 10 / width);
    let particles = [];

    function heatForRow(y){
      const h = Math.max(1, dynCount - 1);
      const pctFromTop = 1 - (y / h);
      let lvl;
      if (pctFromTop >= RED_TOP_FRAC) lvl = 2;
      else if (pctFromTop >= ORANGE_TOP_FRAC) lvl = 1;
      else lvl = 0;
      if (Math.random() < FLICKER_PROB && lvl < 2) lvl += 1;
      return lvl;
    }

    function render(){
      for (let y = 0; y < current.length; y++){
        const row = current[y];
        for (let x = 0; x < row.length; x++){
          const ch = row[x];
          if (FLIP_MAP[ch] && Math.random() < SWAP_PROB) row[x] = FLIP_MAP[ch];
        }
      }

      const next = [];
      for (const p of particles){
        const ny = p.y - 1;
        if (ny >= 0) next.push({ x:p.x, y:ny, age:(p.age||0)+1 });
      }
      particles = next;

      if (dynCount){
        for (let x = 0; x < width; x++){
          if (Math.random() < SPAWN_PROB){
            const y = Math.max(SPAWN_MIN_ROW, 0);
            if (y < dynCount && current[y][x] === " ") particles.push({ x, y, age:0 });
          }
        }
      }

      const renderRows = current.map((row, y) => row.map(ch => {
        if (FLAME_CHARS.has(ch)){
          const lvl = heatForRow(y);
          return `<span class="flame heat${lvl}">${escapeHtml(ch)}</span>`;
        }
        return escapeHtml(ch);
      }));

      for (const p of particles){
        if (p.y >= 0 && p.y < renderRows.length && p.x >= 0 && p.x < width && current[p.y][p.x] === " "){
          const lvl = Math.random() < 0.5 ? 1 : 2;
          renderRows[p.y][p.x] = `<span class="flame heat${lvl}">*</span>`;
        }
      }

      const dynamicHtml = renderRows.map(r => r.join(""));
      pre.innerHTML = [...dynamicHtml, ...staticTail].join("\n");
    }

    render();
    const timer = setInterval(render, 300);

    return { el: pre, stop: () => { clearInterval(timer); if (pre.isConnected) pre.remove(); } };
  }

  function stopBannerAnimation(){
    if (bannerAnim){ bannerAnim.stop(); bannerAnim = null; }
  }

  function run(line){
    const args = tokenize(line);
    const cmd = (args.shift() || "").toLowerCase();
    const fn = commands[cmd];
    if (!fn){
      write(`'${escapeHtml(cmd)}' is not recognized as an internal or external command, operable program or batch file.`);
      return;
    }
    fn(args);
  }

  function bindInput(){
    onDocClick = () => ghost.focus();
    document.addEventListener("click", onDocClick);

    onGhostInput = () => setTyped(ghost.value);
    ghost.addEventListener("input", onGhostInput);

    onGhostKeydown = e => {
      if (e.key === "Enter"){ submit(); e.preventDefault(); return; }
      if (e.key === "ArrowUp"){ historyUp(); e.preventDefault(); return; }
      if (e.key === "ArrowDown"){ historyDown(); e.preventDefault(); return; }
      if (e.key === "c" && e.ctrlKey){ write(`${escapeHtml(promptText())} ^C`); ghost.value=""; setTyped(""); e.preventDefault(); return; }
      if (e.key === "Tab"){ e.preventDefault(); autocomplete(); return; }
    };
    ghost.addEventListener("keydown", onGhostKeydown);

    outResizeObs = new ResizeObserver(() => { forceScroll(); syncTitlebarPadding(); });
    outResizeObs.observe(out);
    window.addEventListener("resize", syncTitlebarPadding);
    syncTitlebarPadding();

  }

  function unbindInput(){
    if (onDocClick) document.removeEventListener("click", onDocClick);
    if (onGhostInput) ghost.removeEventListener("input", onGhostInput);
    if (onGhostKeydown) ghost.removeEventListener("keydown", onGhostKeydown);
    if (outResizeObs) outResizeObs.disconnect();
    window.removeEventListener("resize", syncTitlebarPadding);

  }

  function autocomplete(){
    const val = ghost.value;
    const parts = tokenize(val);
    if (!parts.length) return;
    const last = parts[parts.length-1] || "";
    const norm = last.replace(/\\+/g,"/");
    const baseDir = norm.includes("/") ? fs.resolve(cwd, norm.split("/").slice(0,-1).join("/") || ".") : cwd;
    const frag = (norm.split("/").pop() || "").toLowerCase();
    const list = fs.children(baseDir).filter(n => n.toLowerCase().startsWith(frag));
    if (!list.length) return;
    if (list.length === 1){
      const full = list[0];
      const isDir = fs.isDir(fs.resolve(baseDir, full));
      parts[parts.length-1] = (norm.includes("/") ? norm.split("/").slice(0,-1).join("/") + "/" : "") + full + (isDir ? "\\" : "");
      ghost.value = parts.join(" ");
      setTyped(ghost.value);
    } else {
      writeBlock(list.join("\n"));
      newInputLine();
      ghost.value = val;
      setTyped(val);
    }
  }

  function boot(){
    bindInput();

    const win = document.querySelector(".window");
    const btnMin  = win.querySelector('[data-action="minimize"]')    || win.querySelector('.caption-controls button:nth-child(1)');
    const btnSize = win.querySelector('[data-action="toggle-size"]') || win.querySelector('.caption-controls button:nth-child(2)');
    const btnClose= win.querySelector('[data-action="close"]')       || win.querySelector('.caption-controls button:nth-child(3)');

    if (btnMin)  btnMin.addEventListener("click", () => { win.classList.toggle("minimized"); syncTitlebarPadding(); });
    if (btnSize) btnSize.addEventListener("click", () => { win.classList.toggle("maximized"); syncTitlebarPadding(); });
    if (btnClose)btnClose.addEventListener("click", closeWindow);

    if (bannerAnim) stopBannerAnimation();
    bannerAnim = startBannerAnimation();

    write("Macrohard Mindows [Version 10.0.26100.4652]");
    write("(c) Macrohard Corporation. All rights reserved.");
    write("");
    write("Tip: Type 'help' to get started.");
    write("");
    newInputLine();
  }


  return { boot };
})();

/* ------- Theme helper ------- */
function applyTheme(name){
  localStorage.setItem("theme", name);
  if (name === "matrix"){
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.add("matrix");
  } else {
    document.documentElement.setAttribute("data-theme", name);
    document.body.classList.remove("matrix");
  }
}

/* ------- Start ------- */
window.addEventListener("DOMContentLoaded", () => term.boot());
