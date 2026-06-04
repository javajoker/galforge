/* GalForge — reference GVNF v1.0 runtime (vanilla JS, no build step).
 * Implements the runtime contract of docs/spec/script-standard.md:
 * the command loop (§8/§10), the two-character stage model with alternating
 * display (§6), transitions (§7), layered sprites & expression/outfit swaps
 * (§3.3/§5), item close-ups & CG (§8.9–§8.10), variables/branching (§9),
 * localization (§1.3/§4), voice (§3.4), and save/load (§11).
 *
 * Assets are optional: when an image/audio file is missing, the stage renders
 * a labelled placeholder so any project plays without art.
 */
(function () {
  "use strict";

  const VERBS = new Set(["say","narrate","bg","show","hide","move","cg","closeup","bgm","se",
    "shake","flash","wait","choice","set","if","label","jump","call","return","end"]);

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- deterministic placeholder color from a string ----
  function hashHue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function phGradient(id) { const h = hashHue(id); return `linear-gradient(135deg,hsl(${h} 45% 28%),hsl(${(h+40)%360} 40% 16%))`; }

  // =========================================================================
  // Expression evaluator (safe; grammar = script-standard §9.3)
  // =========================================================================
  function tokenize(src) {
    const re = /\s*(>=|<=|==|!=|&&|\|\||[()+\-*/%<>!,]|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*)/g;
    const out = []; let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
    return out;
  }
  const FUNCS = { min: Math.min, max: Math.max, abs: Math.abs };
  function evalExpr(src, vars) {
    const t = tokenize(src); let p = 0;
    const peek = () => t[p], next = () => t[p++];
    function parseOr() { let v = parseAnd(); while (peek() === "||") { next(); const r = parseAnd(); v = (truthy(v) || truthy(r)); } return v; }
    function parseAnd() { let v = parseCmp(); while (peek() === "&&") { next(); const r = parseCmp(); v = (truthy(v) && truthy(r)); } return v; }
    function parseCmp() {
      let v = parseAdd();
      if (["==","!=","<","<=",">",">="].includes(peek())) {
        const op = next(); const r = parseAdd();
        switch (op) { case "==": return v === r; case "!=": return v !== r;
          case "<": return v < r; case "<=": return v <= r; case ">": return v > r; case ">=": return v >= r; }
      }
      return v;
    }
    function parseAdd() { let v = parseMul(); while (peek() === "+" || peek() === "-") { const op = next(); const r = parseMul(); v = op === "+" ? v + r : v - r; } return v; }
    function parseMul() { let v = parseUnary(); while (["*","/","%"].includes(peek())) { const op = next(); const r = parseUnary(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; }
    function parseUnary() { if (peek() === "!") { next(); return !truthy(parseUnary()); } if (peek() === "-") { next(); return -parseUnary(); } return parseAtom(); }
    function parseAtom() {
      const tok = next();
      if (tok === "(") { const v = parseOr(); if (peek() === ")") next(); return v; }
      if (tok === undefined) return false;
      if (/^\d+\.\d+$/.test(tok) || /^\d+$/.test(tok)) return Number(tok);
      if (tok[0] === "'" || tok[0] === '"') return tok.slice(1, -1).replace(/\\(.)/g, "$1");
      if (tok === "true") return true; if (tok === "false") return false;
      if (peek() === "(") { // function call
        next(); const args = [];
        if (peek() !== ")") { args.push(parseOr()); while (peek() === ",") { next(); args.push(parseOr()); } }
        if (peek() === ")") next();
        if (tok === "has") return truthy(args[0]);
        return (FUNCS[tok] || (() => 0))(...args.map(Number));
      }
      return tok in vars ? vars[tok] : 0; // undeclared → 0 (lint warns)
    }
    function truthy(v) { return !(v === false || v === 0 || v === "" || v === undefined || v === null); }
    const r = parseOr();
    return r;
  }

  // =========================================================================
  // Engine
  // =========================================================================
  class Engine {
    constructor(root, dir) {
      this.root = root; this.dir = dir.replace(/\/$/, "");
      this.scenes = {}; this.chars = {}; this.locales = {};
      this.vars = {}; this.backlog = []; this.callStack = [];
      this.stage = { visible: [], last: null, active: null, bg: null, cg: null, closeup: null };
      this.audio = { bgm: null, bgmEl: null };
      this.auto = false; this.skip = false;
      this.bgLayers = []; this.bgFront = 0;
      this._advance = null; this._choice = null; this._revealDone = null; this._revealing = false;
    }

    // ---------- loading ----------
    async loadJSON(path) {
      const res = await fetch(`${this.dir}/${path}`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    }
    async getScene(id) { return this.scenes[id] || (this.scenes[id] = await this.loadJSON(`scenes/${id}.json`)); }
    async getChar(id) {
      if (!(id in this.chars)) { try { this.chars[id] = await this.loadJSON(`characters/${id}.json`); } catch { this.chars[id] = null; } }
      return this.chars[id];
    }
    async getLocale(code) { return this.locales[code] || (this.locales[code] = await this.loadJSON(`i18n/${code}.json`)); }

    // ---------- i18n ----------
    flatten(obj, pre = "", out = {}) {
      for (const k in obj) { const v = obj[k]; const key = pre + k;
        if (v && typeof v === "object") this.flatten(v, key + ".", out); else out[key] = v; }
      return out;
    }
    str(key) {
      const cur = this.localeStrings[this.locale] || {};
      const def = this.localeStrings[this.defaultLocale] || {};
      return (key in cur) ? cur[key] : (key in def) ? def[key] : `@${key}`;
    }
    text(v) {
      if (typeof v !== "string") return "";
      if (v.startsWith("@@")) v = v.slice(1);
      else if (v.startsWith("@")) v = this.str(v.slice(1));
      return v.replace(/\{([a-z0-9_]+)\}/gi, (_, n) => (n in this.vars ? this.vars[n] : `{${n}}`));
    }

    // ---------- variables ----------
    assign(map) {
      for (const k in map) {
        const val = map[k];
        if (typeof val === "string") {
          if (val[0] === "=") this.vars[k] = evalExpr(val.slice(1), this.vars);
          else if (/^[+-]\d/.test(val)) this.vars[k] = (Number(this.vars[k]) || 0) + Number(val);
          else this.vars[k] = val;
        } else this.vars[k] = val;
      }
    }
    cond(expr) { try { return !!evalExpr(expr, this.vars); } catch { return false; } }

    // ---------- boot ----------
    async boot() {
      try {
        $("gf-boot-msg").textContent = "Loading project…";
        this.game = await this.loadJSON("game.json");
        this.manifest = await this.loadJSON("resources/manifest.json");
        this.defaultLocale = this.game.locales.default;
        this.locale = this.defaultLocale;
        this.localeStrings = {};
        for (const code of this.game.locales.supported) {
          try { this.localeStrings[code] = this.flatten((await this.getLocale(code)).strings || {}); } catch {}
        }
        this.voicePattern = this.game.voicePattern || "{speaker}/{line}";
        this.emphasis = (this.game.stage && this.game.stage.emphasis) || { dim: 0.55 };
        this.defaultTransitions = this.game.transitions || {};
        this.buildBg();
        this.bindUI();
        document.title = this.text(this.game.title) + " — GalForge";
        this.start();
      } catch (e) {
        const m = $("gf-boot-msg"); m.classList.add("err");
        m.textContent = "Could not load project:\n" + e.message +
          "\n\nServe over HTTP (not file://):\n  python3 -m http.server\nthen open  http://localhost:8000/runtime/?game=../games/umbrella-share";
      }
    }

    async start() {
      this.vars = Object.assign({}, this.game.variables || {});
      this.backlog = []; this.callStack = [];
      this.stage = { visible: [], last: null, active: null, bg: null, cg: null, closeup: null };
      $("gf-sprites").innerHTML = ""; $("gf-ending").classList.add("hidden");
      $("gf-boot").classList.add("hidden");
      this.teardownAdhoc();
      await this.enterSceneById(this.game.entry, null);
      this.run();
    }

    // ---------- frame stack (supports nested if-branches) ----------
    enterScene(sceneId, index, frames) {
      this.sceneId = sceneId;
      if (frames) { this.frames = frames; return; }
      this.frames = [{ cmds: this.scenePromise(sceneId), i: index || 0, origin: null }];
    }
    scenePromise(id) { return this.scenes[id] ? this.scenes[id].script : null; }

    async ensureScene(id) { const s = await this.getScene(id); return s.script; }

    labelIndex(script, label) {
      for (let i = 0; i < script.length; i++) if (script[i] && script[i].label === label && !("to" in script[i])) return i;
      return 0;
    }

    async jump(target) {
      const [scenePart, label] = String(target).split("#");
      const sid = scenePart || this.sceneId;
      await this.enterSceneById(sid, label);
    }

    // Enter a scene by id: a normal scene sets the frame stack; an adhoc scene
    // (§14) hands control to its module and transfers via the chosen exit.
    async enterSceneById(sid, label) {
      const scene = await this.getScene(sid);
      this.sceneId = sid;
      if (scene && scene.adhoc) { await this.runAdhoc(scene); return; }
      const script = scene.script;
      const idx = label ? this.labelIndex(script, label) + 1 : 0;
      this.frames = [{ cmds: script, i: idx, origin: null }];
    }

    // =====================================================================
    // Adhoc scenes (§14) — developer-supplied module with custom presentation
    // =====================================================================
    adhocURL(p) {
      try { return new URL(`${this.dir}/${p}`, document.baseURI).href; }
      catch { return `${this.dir}/${p}`; }
    }
    adhocContext(root, signal, a) {
      return {
        root,
        params: JSON.parse(JSON.stringify(a.params || {})),
        vars: Object.assign({}, this.vars),
        locale: this.locale,
        defaultLocale: this.defaultLocale,
        t: (k) => this.text(String(k).startsWith("@") ? k : "@" + k),
        asset: (group, id) => this.assetPath(group, id),
        screen: Object.assign({}, this.game.screen || {}),
        signal,
      };
    }
    resolveAdhocExit(a, result) {
      const exits = a.exits || [];
      const byId = (id) => exits.find((e) => e.id === id);
      let exit = result && result.exit ? byId(result.exit) : null;
      if (!exit) {
        const fb = a.fallback || {};
        const base = byId(fb.exit);
        if (!base) return null;
        exit = Object.assign({}, base, { set: Object.assign({}, fb.set || {}, base.set || {}) });
      }
      return exit;
    }
    async mountAdhoc(a) {
      const host = document.createElement("div");
      host.id = "gf-adhoc"; host.className = "gf-adhoc";
      $("gf-stage").appendChild(host);
      this._adhocHost = host;
      this._adhocAbort = new AbortController();
      if (a.style) {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = this.adhocURL(a.style); link.dataset.adhoc = this.sceneId;
        document.head.appendChild(link); this._adhocStyle = link;
      }
      try {
        const mod = await import(this.adhocURL(a.module));
        const fn = (a.entry && mod[a.entry]) || mod.default || mod.mount;
        if (typeof fn !== "function") throw new Error("adhoc module has no entry function");
        return await fn(this.adhocContext(host, this._adhocAbort.signal, a));
      } catch (e) {
        return null; // → declared fallback (§14.5)
      }
    }
    teardownAdhoc() {
      if (this._adhocAbort) { try { this._adhocAbort.abort(); } catch {} this._adhocAbort = null; }
      if (this._adhocStyle) { this._adhocStyle.remove(); this._adhocStyle = null; }
      if (this._adhocHost) { this._adhocHost.remove(); this._adhocHost = null; }
    }
    async runAdhoc(scene) {
      const a = scene.adhoc;
      $("gf-dialogue").classList.add("hidden"); $("gf-choices").classList.add("hidden");
      const result = await this.mountAdhoc(a);
      const exit = this.resolveAdhocExit(a, result);
      if (exit) {
        if (exit.set) this.assign(exit.set);            // static exit writes…
        if (result && result.set) this.assign(result.set); // …then dynamic module writes
      }
      this.teardownAdhoc();
      if (!exit) { this.cEnd({ end: null }); return; }
      if (exit.return) {
        const f = this.callStack.pop();
        if (f) await this.restoreFrames(f.scene, f.frames);
        else this.cEnd({ end: null });               // return with empty stack ⇒ end (§14.3)
      } else if ("end" in exit) {
        this.cEnd({ end: exit.end });
      } else if (exit.jump) {
        await this.jump(exit.jump);                    // may chain into another adhoc scene
      }
    }

    // ---------- the run loop ----------
    async run() {
      this.running = true;
      while (this.frames.length) {
        const fr = this.frames[this.frames.length - 1];
        if (!fr.cmds) { fr.cmds = await this.ensureScene(this.sceneId); }
        if (fr.i >= fr.cmds.length) { this.frames.pop(); continue; }
        const cmd = fr.cmds[fr.i++];
        const done = await this.exec(cmd);
        if (done === "STOP") { this.running = false; return; }
      }
      this.running = false;
    }

    verb(cmd) {
      const prims = Object.keys(cmd).filter((k) => VERBS.has(k));
      if (prims.length === 1) return prims[0];
      if (prims.length > 1) return null;
      if ("face" in cmd && "to" in cmd) return "face";
      if ("outfit" in cmd && "to" in cmd) return "outfit";
      if ("voice" in cmd) return "voice";
      return null;
    }

    async exec(cmd) {
      switch (this.verb(cmd)) {
        case "say": return this.cSay(cmd);
        case "narrate": return this.cSay({ say: null, text: cmd.narrate, id: cmd.id, voice: cmd.voice });
        case "bg": return this.cBg(cmd);
        case "show": return this.cShow(cmd);
        case "hide": return this.cHide(cmd);
        case "move": return this.cMove(cmd);
        case "face": return this.cFace(cmd);
        case "outfit": return this.cOutfit(cmd);
        case "cg": return this.cCg(cmd);
        case "closeup": return this.cCloseup(cmd);
        case "bgm": return this.cBgm(cmd);
        case "se": return this.cSe(cmd);
        case "voice": return this.cVoice(cmd);
        case "shake": return this.cShake(cmd);
        case "flash": return this.cFlash(cmd);
        case "wait": return this.cWait(cmd);
        case "choice": return this.cChoice(cmd);
        case "set": this.assign(cmd.set); return;
        case "if": return this.cIf(cmd);
        case "label": return;
        case "jump": return this.jump(cmd.jump);
        case "call": this.callStack.push({ scene: this.sceneId, frames: this.serializeFrames() }); return this.jump(cmd.call);
        case "return": { const f = this.callStack.pop(); if (f) await this.restoreFrames(f.scene, f.frames); return; }
        case "end": return this.cEnd(cmd);
        default: return; // unknown → skip (forward-compat)
      }
    }

    // ---------- commands ----------
    async cSay(cmd) {
      const speaker = cmd.say;
      let name = "", color = "#cfcfd6";
      if (speaker) {
        const ch = await this.getChar(speaker);
        if (ch) { name = this.text(ch.name); color = ch.nameColor || color; }
        if (ch && ch.sprite) this.stageSay(speaker, cmd);  // §6.3 alternation
      }
      if (cmd.as) name = this.text(cmd.as);
      const txt = this.text(cmd.text);
      this.renderStage();
      await this.showLine(name, color, txt);
      this.backlog.push({ who: name, line: txt });
      // voice
      if (cmd.voice) this.playVoice(cmd.voice, speaker, cmd.id);
      await this.waitAdvance();
    }

    async cBg(cmd) {
      this.stage.bg = cmd.bg;
      await this.setBg(cmd.bg, cmd.transition);
    }
    async cShow(cmd) {
      await this.getChar(cmd.show);
      this.stageShow(cmd.show, cmd.at, cmd);
      this.renderStage(cmd.transition);
    }
    cHide(cmd) {
      if (cmd.hide === "all") this.stage.visible = [];
      else this.stage.visible = this.stage.visible.filter((v) => v.char !== cmd.hide);
      this.renderStage(cmd.transition);
    }
    cMove(cmd) {
      const v = this.stage.visible.find((x) => x.char === cmd.move);
      if (v && !this.stage.visible.some((x) => x.slot === cmd.to && x.char !== cmd.move)) v.slot = cmd.to;
      this.renderStage(cmd.transition);
    }
    cFace(cmd) { const v = this.stage.visible.find((x) => x.char === cmd.face); if (v) v.face = cmd.to; this.renderStage(); }
    cOutfit(cmd) { const v = this.stage.visible.find((x) => x.char === cmd.outfit); if (v) { v.outfit = cmd.to; if (cmd.pose) v.pose = cmd.pose; } this.renderStage(); }

    async cCg(cmd) {
      this.stage.cg = cmd.cg;
      const el = $("gf-cg");
      const dur = this.tdur(cmd.transition, this.defaultTransitions.cg || "fade");
      if (cmd.cg) { el.style.setProperty("--t", dur + "ms"); this.setImageLayer(el, this.assetPath("cg", cmd.cg), cmd.cg); el.classList.remove("hidden"); requestAnimationFrame(() => el.classList.add("on")); }
      else { el.classList.remove("on"); await sleep(dur); el.classList.add("hidden"); }
      await sleep(dur);
    }
    async cCloseup(cmd) {
      const wrap = $("gf-closeup"), img = $("gf-closeup-img"), cap = $("gf-closeup-cap");
      const dur = this.tdur(cmd.transition, "dissolve");
      if (cmd.closeup) {
        this.stage.closeup = cmd.closeup;
        wrap.style.setProperty("--dim", (cmd.dim != null ? cmd.dim : 0.6));
        img.style.setProperty("--zoom", cmd.zoom || 1);
        this.setImageLayer(img, this.assetPath("items", cmd.closeup), cmd.closeup);
        cap.textContent = cmd.caption ? this.text(cmd.caption) : ""; cap.style.display = cmd.caption ? "" : "none";
        wrap.style.setProperty("--t", dur + "ms"); wrap.classList.remove("hidden");
        requestAnimationFrame(() => wrap.classList.add("on"));
      } else { this.stage.closeup = null; wrap.classList.remove("on"); await sleep(dur); wrap.classList.add("hidden"); }
      await sleep(dur);
    }
    cBgm(cmd) { if (cmd.bgm === null || cmd.bgm === "stop") this.stopBgm(cmd.fade || 0); else this.playBgm(cmd.bgm, cmd.fade || 0, cmd.volume); }
    cSe(cmd) { this.playSe(cmd.se, cmd.volume); return cmd.wait ? sleep(400) : undefined; }
    cVoice(cmd) { if (cmd.voice === "stop") this.stopVoice(); else this.playVoice(cmd.voice); }
    async cShake(cmd) { const s = (cmd.shake && cmd.shake.duration) || 400; const st = $("gf-stage");
      st.animate([{ transform: "translate(0,0)" }, { transform: "translate(-8px,4px)" }, { transform: "translate(7px,-5px)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(0,0)" }], { duration: s, iterations: 1 }); await sleep(s); }
    async cFlash(cmd) { const d = (cmd.flash && cmd.flash.duration) || 200; const f = $("gf-flash");
      f.style.background = (cmd.flash && cmd.flash.color) || "#fff";
      f.animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { duration: d }); await sleep(d); }
    async cWait(cmd) { if (cmd.wait === "click") return this.waitAdvance(); await sleep(Number(cmd.wait) || 0); }

    async cIf(cmd) {
      let branch = null;
      if (this.cond(cmd.if)) branch = { sel: "then", cmds: cmd.then || [] };
      else {
        for (let n = 0; n < (cmd.elif || []).length; n++) if (this.cond(cmd.elif[n].if)) { branch = { sel: "elif:" + n, cmds: cmd.elif[n].then || [] }; break; }
        if (!branch && cmd.else) branch = { sel: "else", cmds: cmd.else };
      }
      if (branch) { const parent = this.frames[this.frames.length - 1]; this.frames.push({ cmds: branch.cmds, i: 0, origin: { at: parent.i - 1, sel: branch.sel } }); }
    }

    async cChoice(cmd) {
      const opts = (cmd.options || []).map((o, idx) => ({ o, idx }))
        .filter(({ o }) => !("if" in o) || this.cond(o.if) || !o.hideIfFalse);
      const prompt = cmd.choice ? this.text(cmd.choice) : "";
      const pick = await this.showChoices(prompt, opts.map(({ o }) => ({
        label: this.text(o.text), enabled: !("if" in o) || this.cond(o.if),
      })));
      const chosen = opts[pick].o;
      if (chosen.set) this.assign(chosen.set);
      const extra = Array.isArray(chosen.do) ? chosen.do.slice() : [];
      if (chosen.jump) extra.push({ jump: chosen.jump });
      if (extra.length) { const parent = this.frames[this.frames.length - 1]; this.frames.push({ cmds: extra, i: 0, origin: { at: parent.i - 1, sel: "choice" } }); }
    }

    cEnd(cmd) {
      const id = cmd.end;
      let title = "";
      if (typeof id === "string" && this.game.endings && this.game.endings[id]) title = this.text(this.game.endings[id].title);
      $("gf-ending-title").textContent = title || "The End";
      $("gf-ending").classList.remove("hidden");
      $("gf-dialogue").classList.add("hidden");
      this.stopBgm(600);
      this.frames = [];
      return "STOP";
    }

    // =====================================================================
    // Stage model (§6) — two-character limit + alternating display
    // =====================================================================
    charDefault(id, key, fb) { const c = this.chars[id]; return (c && c[key]) || fb; }
    preferredSlot(id) {
      const used = new Set(this.stage.visible.map((v) => v.slot));
      const pref = this.charDefault(id, "defaultPosition", null);
      if (pref === "left" || pref === "right") { if (!used.has(pref)) return pref; }
      return ["left", "right", "center"].find((s) => !used.has(s)) || "left";
    }
    makeEntry(id, at, cmd) {
      return { char: id, slot: at || this.preferredSlot(id),
        outfit: (cmd && cmd.outfit) || this.charDefault(id, "defaultOutfit", "default"),
        pose: (cmd && cmd.pose) || this.charDefault(id, "defaultPose", "stand"),
        face: (cmd && cmd.face) || this.charDefault(id, "defaultFace", "neutral"),
        entering: true };
    }
    evictNonActive() {
      const last = this.stage.last;
      const victim = this.stage.visible.find((v) => v.char !== last) || this.stage.visible[0];
      this.stage.visible = this.stage.visible.filter((v) => v !== victim);
    }
    stageSay(id, cmd) {
      let v = this.stage.visible.find((x) => x.char === id);
      if (v) { if (cmd && cmd.face) v.face = cmd.face; if (cmd && cmd.outfit) v.outfit = cmd.outfit; }
      else {
        if (this.stage.visible.length >= 2) this.evictNonActive();
        v = this.makeEntry(id, cmd && cmd.at, cmd); this.stage.visible.push(v);
      }
      this.stage.active = id; this.stage.last = id;
    }
    stageShow(id, at, cmd) {
      if (this.stage.visible.some((x) => x.char === id)) return;
      if (this.stage.visible.length >= 2) this.evictNonActive();
      this.stage.visible.push(this.makeEntry(id, at, cmd));
    }

    // =====================================================================
    // Rendering
    // =====================================================================
    assetPath(group, id) { const a = this.manifest[group] && this.manifest[group][id]; return a ? `${this.dir}/${a.path}` : null; }
    spriteLayer(charId, outfit, pose, face) {
      const sp = this.manifest.sprites && this.manifest.sprites[charId];
      if (!sp) return { body: null, face: null, faceMeta: null };
      const body = sp.bodies && sp.bodies[outfit] && sp.bodies[outfit][pose];
      const fc = sp.faces && sp.faces[face];
      return { body: body ? `${this.dir}/${body.path}` : null, face: fc ? `${this.dir}/${fc.path}` : null, faceMeta: fc || null };
    }

    buildBg() {
      const bg = $("gf-bg"); bg.innerHTML = "";
      this.bgLayers = [document.createElement("div"), document.createElement("div")];
      this.bgLayers.forEach((l) => { l.className = "layer"; bg.appendChild(l); });
      this.bgFront = 0;
    }
    async setBg(id, transition) {
      const dur = this.tdur(transition, this.defaultTransitions.bg || "dissolve");
      const back = this.bgLayers[1 - this.bgFront];
      back.style.setProperty("--t", dur + "ms");
      back.innerHTML = "";
      if (id) {
        const path = this.assetPath("backgrounds", id);
        back.style.background = phGradient(id);
        if (path) { const im = new Image(); im.onload = () => { back.style.backgroundImage = `url("${path}")`; }; im.src = path; }
        const lbl = document.createElement("div"); lbl.className = "gf-ph-label"; lbl.textContent = "bg: " + id; back.appendChild(lbl);
      } else back.style.background = "#0a0c12";
      this.bgLayers[this.bgFront].classList.remove("show");
      back.classList.add("show"); this.bgFront = 1 - this.bgFront;
      await sleep(dur);
    }

    setImageLayer(el, path, id) {
      el.style.background = phGradient(id); el.style.backgroundSize = "cover"; el.innerHTML = "";
      const lbl = document.createElement("div"); lbl.className = "gf-ph-label"; lbl.textContent = id; el.appendChild(lbl);
      if (path) { const im = new Image(); im.onload = () => { el.style.backgroundImage = `url("${path}")`; }; im.src = path; }
    }

    renderStage(transition) {
      const cont = $("gf-sprites");
      const slideDir = (transition && (typeof transition === "object") && transition.type === "slide") ? transition.direction : null;
      const present = new Set(this.stage.visible.map((v) => v.char));
      // remove gone
      [...cont.children].forEach((el) => { if (!present.has(el.dataset.char)) { el.classList.remove("on"); setTimeout(() => el.remove(), 360); } });
      for (const v of this.stage.visible) {
        let el = cont.querySelector(`[data-char="${v.char}"]`);
        const ch = this.chars[v.char] || {};
        if (!el) {
          el = document.createElement("div"); el.className = "gf-slot"; el.dataset.char = v.char;
          el.innerHTML = `<div class="gf-sprite"><div class="gf-ph"><span class="em"></span><span class="nm"></span><span class="st"></span></div><img class="body" alt=""><img class="face" alt=""></div>`;
          cont.appendChild(el);
          if (slideDir === "left" || slideDir === "right") el.classList.add("enter-" + slideDir);
        }
        el.className = "gf-slot " + v.slot;
        const dur = this.tdur(transition, this.defaultTransitions.char || "dissolve");
        el.style.setProperty("--t", dur + "ms");
        // emphasis (alternating display)
        const dim = this.stage.active && this.stage.active !== v.char;
        el.classList.toggle("dim", !!dim);
        // placeholder content
        const ph = el.querySelector(".gf-ph");
        ph.style.setProperty("--c", ch.nameColor || "hsl(" + hashHue(v.char) + " 40% 35%)");
        ph.querySelector(".nm").textContent = ch.name ? this.text(ch.name) : v.char;
        ph.querySelector(".st").textContent = `${v.outfit} · ${v.face}`;
        ph.querySelector(".em").textContent = emoji(v.face);
        // real layered sprite (if assets exist)
        const layer = this.spriteLayer(v.char, v.outfit, v.pose, v.face);
        const sprite = el.querySelector(".gf-sprite");
        const bodyImg = el.querySelector("img.body"), faceImg = el.querySelector("img.face");
        loadInto(bodyImg, layer.body, () => sprite.classList.add("has-body"));
        loadInto(faceImg, layer.face, null, layer.faceMeta);
        requestAnimationFrame(() => el.classList.add("on"));
      }
    }

    // ---------- dialogue ----------
    showLine(name, color, text) {
      const box = $("gf-dialogue"), nm = $("gf-name"), tx = $("gf-text"), adv = $("gf-advance");
      box.classList.remove("hidden"); box.style.setProperty("--nc", color);
      nm.textContent = name || ""; adv.classList.remove("show");
      tx.textContent = "";
      return new Promise((resolve) => {
        this._revealDone = resolve;
        if (this.skip) { tx.textContent = text; this._revealing = false; adv.classList.add("show"); resolve(); return; }
        this._revealing = true; let i = 0;
        const speed = 18;
        const tick = () => {
          if (!this._revealing) return;
          tx.textContent = text.slice(0, ++i);
          if (i >= text.length) { this._revealing = false; adv.classList.add("show"); resolve(); }
          else this._revTimer = setTimeout(tick, speed);
        };
        tick();
        this._fullText = text;
      });
    }
    finishReveal() {
      if (!this._revealing) return false;
      clearTimeout(this._revTimer); this._revealing = false;
      $("gf-text").textContent = this._fullText; $("gf-advance").classList.add("show");
      if (this._revealDone) this._revealDone();
      return true;
    }
    waitAdvance() {
      return new Promise((resolve) => {
        this._advance = resolve;
        if (this.skip) { setTimeout(() => this.doAdvance(), 12); }
        else if (this.auto) { this._autoTimer = setTimeout(() => this.doAdvance(), (this.game.text && this.game.text.autoDelayMs) || 1200); }
      });
    }
    doAdvance() {
      if (this.finishReveal()) return;            // first click completes typewriter
      clearTimeout(this._autoTimer);
      const r = this._advance; this._advance = null; if (r) r();
    }

    // ---------- choices ----------
    showChoices(prompt, options) {
      const box = $("gf-choices"); box.innerHTML = ""; box.classList.remove("hidden");
      $("gf-dialogue").classList.add("hidden");
      if (prompt) { const p = document.createElement("div"); p.className = "gf-choice-prompt"; p.textContent = prompt; box.appendChild(p); }
      return new Promise((resolve) => {
        options.forEach((opt, i) => {
          const b = document.createElement("button"); b.className = "gf-choice"; b.textContent = opt.label;
          b.disabled = opt.enabled === false;
          b.onclick = () => { box.classList.add("hidden"); resolve(i); };
          box.appendChild(b);
        });
      });
    }

    // =====================================================================
    // Audio (best-effort; missing files are ignored)
    // =====================================================================
    makeAudio(group, id, loop) {
      const a = this.manifest[group] && this.manifest[group][id]; if (!a) return null;
      const el = new Audio(`${this.dir}/${a.path}`); el.loop = !!loop; return el;
    }
    playBgm(id, fade, volume) {
      if (this.audio.bgm === id && this.audio.bgmEl) return;
      this.stopBgm(fade);
      const m = this.manifest.bgm && this.manifest.bgm[id];
      const el = this.makeAudio("bgm", id, m ? m.loop !== false : true);
      this.audio.bgm = id; this.audio.bgmEl = el;
      $("gf-bgm-hud").textContent = "♪ " + id;
      if (el) { el.volume = (volume != null ? volume : (this.game.audio && this.game.audio.bgm) || 0.8); el.play().catch(() => {}); }
    }
    stopBgm() { if (this.audio.bgmEl) { try { this.audio.bgmEl.pause(); } catch {} } this.audio.bgmEl = null; this.audio.bgm = null; $("gf-bgm-hud").textContent = ""; }
    playSe(id, volume) { const el = this.makeAudio("se", id, false); if (el) { el.volume = volume != null ? volume : (this.game.audio && this.game.audio.se) || 0.9; el.play().catch(() => {}); } }
    voiceId(speaker, line) { return this.voicePattern.replace("{speaker}", speaker).replace("{line}", line || "").replace("{locale}", this.locale); }
    playVoice(v, speaker, line) {
      this.stopVoice();
      let id = v;
      if (v === "auto") { id = this.voiceId(speaker, line); }
      const voices = this.manifest.voice || {};
      const key = (voices[`${id}@${this.locale}`] ? `${id}@${this.locale}` : id);
      const a = voices[key]; if (!a) return;
      this.voiceEl = new Audio(`${this.dir}/${a.path}`);
      this.voiceEl.volume = (this.game.audio && this.game.audio.voice) || 1; this.voiceEl.play().catch(() => {});
    }
    stopVoice() { if (this.voiceEl) { try { this.voiceEl.pause(); } catch {} this.voiceEl = null; } }

    // ---------- transition duration helper ----------
    tdur(transition, fallback) {
      const t = transition != null ? transition : fallback;
      if (t == null) return 500;
      if (typeof t === "string") return t === "none" || t === "cut" ? 0 : 500;
      if (typeof t === "object") return t.type === "none" || t.type === "cut" ? 0 : (t.duration != null ? t.duration : 500);
      return 500;
    }

    // =====================================================================
    // Save / load (§11) — descent-encoded frame stack
    // =====================================================================
    serializeFrames() {
      return this.frames.map((f) => ({ i: f.i, origin: f.origin }));
    }
    snapshot() {
      const top = this.frames[this.frames.length - 1];
      const stage = JSON.parse(JSON.stringify(this.stage));
      // strip transient render-only flags so the snapshot matches save.schema.json (§11)
      (stage.visible || []).forEach((v) => { delete v.entering; });
      // an adhoc scene is atomic (§14.6): record its entry so resume re-runs it
      const adhocNow = this.scenes[this.sceneId] && this.scenes[this.sceneId].adhoc;
      return {
        gvnf: "1.0", game: this.game.id, gameVersion: this.game.version, savedAt: new Date().toISOString(),
        locale: this.locale,
        pc: { scene: this.sceneId, index: adhocNow ? 0 : (top ? top.i : 0) },   // §11 conformant
        frames: adhocNow ? [] : this.serializeFrames(),         // engine extension (nested-branch resume)
        callStack: this.callStack, variables: Object.assign({}, this.vars),
        stage: stage, audio: { bgm: this.audio.bgm, bgmPositionMs: this.audio.bgmEl ? Math.round((this.audio.bgmEl.currentTime || 0) * 1000) : 0 },
        backlogCursor: this.backlog.length,
      };
    }
    async restoreFrames(sceneId, frameDescs) {
      const script = await this.ensureScene(sceneId); this.sceneId = sceneId;
      const frames = []; let cmds = script;
      for (let k = 0; k < frameDescs.length; k++) {
        const d = frameDescs[k];
        if (k > 0) {
          const ctrl = frames[k - 1].cmds[d.origin.at];
          if (d.origin.sel === "then") cmds = ctrl.then || [];
          else if (d.origin.sel === "else") cmds = ctrl.else || [];
          else if (d.origin.sel === "choice") cmds = []; // choice `do` not resumable mid-way; rare
          else if (d.origin.sel.startsWith("elif:")) cmds = (ctrl.elif[+d.origin.sel.slice(5)] || {}).then || [];
        }
        frames.push({ cmds, i: d.i, origin: d.origin });
      }
      this.frames = frames.length ? frames : [{ cmds: script, i: 0, origin: null }];
    }
    async loadSnapshot(s) {
      // cancel any pending waits
      this._advance = null; this._revealing = false; clearTimeout(this._autoTimer); clearTimeout(this._revTimer);
      this.locale = s.locale || this.defaultLocale; $("gf-lang").value = this.locale;
      this.vars = Object.assign({}, s.variables);
      this.callStack = s.callStack || [];
      this.stage = s.stage;
      $("gf-ending").classList.add("hidden"); $("gf-choices").classList.add("hidden"); $("gf-boot").classList.add("hidden");
      // re-render visuals
      $("gf-sprites").innerHTML = "";
      await this.setBg(this.stage.bg, "none");
      this.renderStage("none");
      if (this.stage.cg) await this.cCg({ cg: this.stage.cg, transition: "none" });
      else { $("gf-cg").classList.add("hidden"); $("gf-cg").classList.remove("on"); }
      if (s.audio && s.audio.bgm) this.playBgm(s.audio.bgm, 0); else this.stopBgm();
      this.teardownAdhoc();
      const scene = (s.pc && s.pc.scene) || s.scene;
      const sc = await this.getScene(scene).catch(() => null);
      if (sc && sc.adhoc) {
        // adhoc scenes are atomic (§14.6): re-run from entry, then resume the flow
        this.sceneId = scene; this.running = false;
        await this.runAdhoc(sc);
        this.run();
        return;
      }
      if (s.frames) await this.restoreFrames(scene, s.frames);
      else { const script = await this.ensureScene(scene); this.sceneId = scene; this.frames = [{ cmds: script, i: (s.pc && s.pc.index) || 0, origin: null }]; }
      if (this.running) { /* loop will pick up */ } else this.run();
    }

    saveTo(slot) { try { localStorage.setItem(this.saveKey(slot), JSON.stringify(this.snapshot())); } catch {} }
    readSlot(slot) { try { return JSON.parse(localStorage.getItem(this.saveKey(slot))); } catch { return null; } }
    saveKey(slot) { return `galforge:${this.game.id}:save${slot}`; }

    openSaves(mode) {
      const panel = $("gf-saves"), list = $("gf-saves-list");
      $("gf-saves-title").textContent = mode === "save" ? "Save" : "Load";
      list.innerHTML = "";
      for (let i = 1; i <= 4; i++) {
        const data = this.readSlot(i);
        const row = document.createElement("div"); row.className = "gf-save-slot";
        const when = data ? new Date(data.savedAt).toLocaleString() : "empty";
        row.innerHTML = `<span>Slot ${i}</span><span class="meta">${data ? (data.scene + " · " + when) : "— empty —"}</span>`;
        row.onclick = () => {
          if (mode === "save") { this.saveTo(i); this.openSaves("save"); }
          else if (data) { panel.classList.add("hidden"); this.loadSnapshot(data); }
        };
        list.appendChild(row);
      }
      panel.classList.remove("hidden");
    }

    // ---------- backlog ----------
    openBacklog() {
      const list = $("gf-backlog-list"); list.innerHTML = "";
      this.backlog.slice(-200).forEach((b) => {
        const r = document.createElement("div"); r.className = "gf-backlog-row";
        r.innerHTML = `<div class="who">${escapeHtml(b.who || "")}</div><div class="ln">${escapeHtml(b.line)}</div>`;
        list.appendChild(r);
      });
      $("gf-backlog").classList.remove("hidden");
      list.scrollTop = list.scrollHeight;
    }

    // =====================================================================
    // UI binding
    // =====================================================================
    bindUI() {
      // language selector
      const lang = $("gf-lang"); lang.innerHTML = "";
      for (const code of this.game.locales.supported) { const o = document.createElement("option"); o.value = code; o.textContent = code; lang.appendChild(o); }
      lang.value = this.locale;
      lang.onchange = () => { this.locale = lang.value; this.renderStage(); };

      // advance on click / keys (but not when a panel/choice is open)
      const stageClick = (e) => {
        if (e.target.closest("#gf-controls") || e.target.closest(".gf-panel") || e.target.closest(".gf-choices") || e.target.closest(".gf-ending")) return;
        this.doAdvance();
      };
      this.root.addEventListener("click", stageClick);
      window.addEventListener("keydown", (e) => {
        if (["Space", "Enter"].includes(e.code)) { e.preventDefault(); if (!this.panelsOpen()) this.doAdvance(); }
        else if (e.code === "Escape") { ["gf-backlog","gf-saves"].forEach((id)=>$(id).classList.add("hidden")); }
        else if (e.code === "KeyA") this.toggleAuto();
        else if (e.code === "ControlLeft" || e.code === "KeyS") {}
      });

      this.root.querySelectorAll("#gf-controls [data-act]").forEach((b) => {
        b.onclick = () => {
          const a = b.dataset.act;
          if (a === "auto") this.toggleAuto(b);
          else if (a === "skip") this.toggleSkip(b);
          else if (a === "backlog") this.openBacklog();
          else if (a === "save") this.openSaves("save");
          else if (a === "load") this.openSaves("load");
        };
      });
      this.root.querySelector('[data-act="close-backlog"]').onclick = () => $("gf-backlog").classList.add("hidden");
      this.root.querySelector('[data-act="close-saves"]').onclick = () => $("gf-saves").classList.add("hidden");
      this.root.querySelector('[data-act="restart"]').onclick = () => this.start();
    }
    panelsOpen() { return !$("gf-backlog").classList.contains("hidden") || !$("gf-saves").classList.contains("hidden") || !$("gf-choices").classList.contains("hidden"); }
    toggleAuto(btn) { this.auto = !this.auto; (btn || this.ctlBtn("auto")).classList.toggle("active", this.auto); if (this.auto && this._advance) this.doAdvance(); }
    toggleSkip(btn) { this.skip = !this.skip; (btn || this.ctlBtn("skip")).classList.toggle("active", this.skip); if (this.skip) this.doAdvance(); }
    ctlBtn(a) { return this.root.querySelector(`#gf-controls [data-act="${a}"]`); }
  }

  // ---- helpers ----
  function loadInto(img, src, onloadCb, faceMeta) {
    img.classList.remove("loaded");
    if (!src) { img.removeAttribute("src"); return; }
    img.onload = () => { img.classList.add("loaded"); if (onloadCb) onloadCb();
      if (faceMeta && faceMeta.offset) { /* face offset positioning when real art exists */ img.style.bottom = "auto"; } };
    img.onerror = () => { img.classList.remove("loaded"); };
    img.src = src;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function emoji(face) {
    const m = { neutral: "🙂", smile: "😊", grin: "😁", laugh: "😄", blush: "😳", shy: "☺️", sad: "🙁",
      cry: "😢", angry: "😠", pout: "😤", surprised: "😲", shocked: "😧", thinking: "🤔", smug: "😏",
      sleepy: "😴", determined: "😤" };
    return m[face] || "🙂";
  }

  window.GalForge = {
    boot(root, dir) { const e = new Engine(root, dir); window.__gf = e; e.boot(); return e; },
    evalExpr,
  };
})();
