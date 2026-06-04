/* GalForge — GVNF v1.0 engine (UI-agnostic).
 *
 * A faithful port of the vanilla reference runtime (runtime/galforge.js), but
 * with all DOM/rendering stripped out. The engine is a pure state machine: it
 * loads a project, runs the command loop until it reaches a *blocking* beat
 * (a dialogue line, a choice, a `wait "click"`, or an ending), and emits an
 * immutable "view model" describing what to draw. React renders that model and
 * calls advance()/choose()/load()/etc. back into the engine.
 *
 * Implements: command loop (§8/§10), two-character stage with alternating
 * display (§6), transitions (§7), layered sprites + expression/outfit swaps
 * (§3.3/§5), item close-ups & CG (§8.9–§8.10), variables/branching (§9),
 * localization (§1.3/§4), voice (§3.4), save/load (§11).
 */
import { evalExpr } from "./evalExpr.js";

// Primary verbs (face/outfit/voice are intentionally absent — they are dual-use
// keys disambiguated in verb() per script-standard §8.0).
const VERBS = new Set([
  "say", "narrate", "bg", "show", "hide", "move", "cg", "closeup", "bgm", "se",
  "shake", "flash", "wait", "choice", "set", "if", "label", "jump", "call", "return", "end",
]);

export class Engine {
  constructor(baseDir) {
    this.baseDir = String(baseDir).replace(/\/$/, "");
    this.scenes = {};
    this.chars = {};
    this.localeStrings = {};
    this.listeners = new Set();
    this.fx = [];
    this.fxSeq = 0;
    this.lineSeq = 0;
    this.viewSeq = 0;
    this.ready = false;
    this.view = null;
  }

  // ---------------------------------------------------------------- pub/sub
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.view = this.buildView();
    for (const fn of this.listeners) fn(this.view);
  }

  // ----------------------------------------------------------------- loading
  async loadJSON(path) {
    const res = await fetch(`${this.baseDir}/${path}`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  async boot(opts = {}) {
    this.game = await this.loadJSON("game.json");
    this.manifest = await this.loadJSON("resources/manifest.json");
    this.defaultLocale = this.game.locales.default;
    this.locale = this.defaultLocale;
    this.localeStrings = {};
    for (const code of this.game.locales.supported) {
      try {
        this.localeStrings[code] = this.flatten((await this.loadJSON(`i18n/${code}.json`)).strings || {});
      } catch {
        /* missing locale file → fallback chain handles it */
      }
    }
    this.voicePattern = this.game.voicePattern || "{speaker}/{line}";
    this.defaultTransitions = this.game.transitions || {};
    await this.loadAllScenes();
    await this.loadAllChars();
    // Preload media so the first frame of every scene paints without pop-in.
    // Best-effort: missing files (demo games ship no binaries) are tolerated.
    if (opts.preload !== false) {
      try {
        await this.preload(opts.onProgress, opts);
      } catch {
        /* preload is non-fatal — playback can stream on demand */
      }
    }
    this.ready = true;
    this.start();
    return this;
  }

  // ----------------------------------------------------------- preloading
  // Gather every media URL the game can reference, from the manifest.
  // Voice is excluded by default (large, line-specific — it streams on demand);
  // pass { includeVoice: true } to warm it too.
  collectAssetURLs({ includeVoice = false } = {}) {
    const images = new Set();
    const audio = new Set();
    const m = this.manifest || {};
    const addImg = (a) => { const u = this.assetURL(a); if (u) images.add(u); };
    const addAud = (a) => { const u = this.assetURL(a); if (u) audio.add(u); };
    for (const group of ["backgrounds", "cg", "items", "ui"])
      for (const id in m[group] || {}) addImg(m[group][id]);
    for (const cid in m.sprites || {}) {
      const sp = m.sprites[cid] || {};
      for (const outfit in sp.bodies || {})
        for (const pose in sp.bodies[outfit]) addImg(sp.bodies[outfit][pose]);
      for (const face in sp.faces || {}) addImg(sp.faces[face]);
    }
    for (const id in m.bgm || {}) addAud(m.bgm[id]);
    for (const id in m.se || {}) addAud(m.se[id]);
    if (includeVoice) for (const id in m.voice || {}) addAud(this.manifest.voice[id]);
    return { images: [...images], audio: [...audio] };
  }

  preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const done = () => resolve();
      img.onload = done;
      img.onerror = done; // tolerate a missing bitmap; don't block the boot
      try { img.decoding = "async"; } catch { /* not supported */ }
      img.src = url;
    });
  }
  preloadAudio(url) {
    // Warm the HTTP cache; later `new Audio(url)` playback hits the cache.
    return fetch(url, { cache: "force-cache" }).then(() => {}, () => {});
  }

  // Preload all collected assets with bounded concurrency, reporting progress
  // as { loaded, total } after each settles. Resolves when everything settles.
  async preload(onProgress, opts = {}) {
    const { images, audio } = this.collectAssetURLs(opts);
    const tasks = [
      ...images.map((u) => () => this.preloadImage(u)),
      ...audio.map((u) => () => this.preloadAudio(u)),
    ];
    const total = tasks.length;
    let loaded = 0;
    this.preloadState = { loaded, total };
    if (onProgress) onProgress({ loaded, total });
    if (!total) return;
    const concurrency = Math.min(opts.concurrency || 8, total);
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const job = tasks[next++];
        await job();
        loaded += 1;
        this.preloadState = { loaded, total };
        if (onProgress) onProgress({ loaded, total });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  async loadAllScenes() {
    const queue = [this.game.entry];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      let scene;
      try {
        scene = await this.loadJSON(`scenes/${id}.json`);
      } catch {
        continue;
      }
      this.scenes[id] = scene;
      this.collectTargets(scene.script, queue);
    }
  }
  collectTargets(cmds, out) {
    for (const c of cmds || []) {
      if (!c || typeof c !== "object") continue;
      if (typeof c.jump === "string") {
        const s = c.jump.split("#")[0];
        if (s) out.push(s);
      }
      if (typeof c.call === "string") {
        const s = c.call.split("#")[0];
        if (s) out.push(s);
      }
      if (Array.isArray(c.then)) this.collectTargets(c.then, out);
      if (Array.isArray(c.else)) this.collectTargets(c.else, out);
      if (Array.isArray(c.elif)) for (const e of c.elif) this.collectTargets(e.then, out);
      if (Array.isArray(c.options))
        for (const o of c.options) {
          if (typeof o.jump === "string") {
            const s = o.jump.split("#")[0];
            if (s) out.push(s);
          }
          if (Array.isArray(o.do)) this.collectTargets(o.do, out);
        }
    }
  }
  async loadAllChars() {
    const ids = new Set(Object.keys(this.manifest.sprites || {}));
    const scan = (cmds) => {
      for (const c of cmds || []) {
        if (!c || typeof c !== "object") continue;
        if (typeof c.say === "string") ids.add(c.say);
        if (typeof c.show === "string") ids.add(c.show);
        if (typeof c.move === "string") ids.add(c.move);
        if (typeof c.hide === "string" && c.hide !== "all") ids.add(c.hide);
        if (Array.isArray(c.then)) scan(c.then);
        if (Array.isArray(c.else)) scan(c.else);
        if (Array.isArray(c.elif)) for (const e of c.elif) scan(e.then);
        if (Array.isArray(c.options)) for (const o of c.options) if (Array.isArray(o.do)) scan(o.do);
      }
    };
    for (const id in this.scenes) {
      scan(this.scenes[id].script);
      for (const c of this.scenes[id].cast || []) ids.add(c);
    }
    await Promise.all(
      [...ids].map(async (id) => {
        try {
          this.chars[id] = await this.loadJSON(`characters/${id}.json`);
        } catch {
          this.chars[id] = null;
        }
      })
    );
  }

  // -------------------------------------------------------------------- i18n
  flatten(obj, pre = "", out = {}) {
    for (const k in obj) {
      const v = obj[k];
      const key = pre + k;
      if (v && typeof v === "object") this.flatten(v, key + ".", out);
      else out[key] = v;
    }
    return out;
  }
  str(key) {
    const cur = this.localeStrings[this.locale] || {};
    const def = this.localeStrings[this.defaultLocale] || {};
    return key in cur ? cur[key] : key in def ? def[key] : `@${key}`;
  }
  text(v) {
    if (typeof v !== "string") return "";
    if (v.startsWith("@@")) v = v.slice(1);
    else if (v.startsWith("@")) v = this.str(v.slice(1));
    return v.replace(/\{([a-z0-9_]+)\}/gi, (_, n) => (n in this.vars ? this.vars[n] : `{${n}}`));
  }

  // --------------------------------------------------------------- variables
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
  cond(expr) {
    try {
      return !!evalExpr(expr, this.vars);
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------- asset paths
  assetURL(a) {
    return a ? (/^https?:\/\//.test(a.path) ? a.path : `${this.baseDir}/${a.path}`) : null;
  }
  asset(group, id) {
    const a = this.manifest[group] && this.manifest[group][id];
    return this.assetURL(a);
  }
  spriteBody(charId, outfit, pose) {
    const sp = this.manifest.sprites && this.manifest.sprites[charId];
    const b = sp && sp.bodies && sp.bodies[outfit] && sp.bodies[outfit][pose];
    return this.assetURL(b);
  }
  spriteFace(charId, face) {
    const sp = this.manifest.sprites && this.manifest.sprites[charId];
    const f = sp && sp.faces && sp.faces[face];
    return this.assetURL(f);
  }
  vol(kind) {
    const a = this.game.audio || {};
    const fb = { bgm: 0.8, se: 0.9, voice: 1.0 }[kind];
    return a[kind] != null ? a[kind] : fb;
  }
  voiceId(speaker, line) {
    return this.voicePattern
      .replace("{speaker}", speaker || "")
      .replace("{line}", line || "")
      .replace("{locale}", this.locale);
  }
  resolveVoice(v, speaker, line) {
    let id = v;
    if (v === "auto") id = this.voiceId(speaker, line);
    const voices = this.manifest.voice || {};
    const key = voices[`${id}@${this.locale}`] ? `${id}@${this.locale}` : id;
    const a = voices[key];
    return a ? `${this.baseDir}/${a.path}` : null;
  }

  // ----------------------------------------------------------- transitions
  normTransition(t, fallbackKey) {
    const tr = t != null ? t : this.defaultTransitions[fallbackKey];
    if (tr == null) return { type: "dissolve", duration: 500 };
    if (typeof tr === "string")
      return { type: tr, duration: tr === "none" || tr === "cut" ? 0 : 500 };
    if (typeof tr === "object")
      return {
        type: tr.type || "dissolve",
        duration: tr.duration != null ? tr.duration : tr.type === "none" || tr.type === "cut" ? 0 : 500,
        direction: tr.direction || null,
      };
    return { type: "dissolve", duration: 500 };
  }

  // ------------------------------------------------------ stage model (§6)
  charDefault(id, key, fb) {
    const c = this.chars[id];
    return (c && c[key]) || fb;
  }
  preferredSlot(id) {
    const used = new Set(this.stage.visible.map((v) => v.slot));
    const pref = this.charDefault(id, "defaultPosition", null);
    if ((pref === "left" || pref === "right") && !used.has(pref)) return pref;
    return ["left", "right", "center"].find((s) => !used.has(s)) || "left";
  }
  makeEntry(id, at, cmd) {
    return {
      char: id,
      slot: at || this.preferredSlot(id),
      outfit: (cmd && cmd.outfit) || this.charDefault(id, "defaultOutfit", "default"),
      pose: (cmd && cmd.pose) || this.charDefault(id, "defaultPose", "stand"),
      face: (cmd && cmd.face) || this.charDefault(id, "defaultFace", "neutral"),
    };
  }
  evictNonActive() {
    const last = this.stage.last;
    const victim = this.stage.visible.find((v) => v.char !== last) || this.stage.visible[0];
    this.stage.visible = this.stage.visible.filter((v) => v !== victim);
  }
  stageSay(id, cmd) {
    let v = this.stage.visible.find((x) => x.char === id);
    if (v) {
      if (cmd && cmd.face) v.face = cmd.face;
      if (cmd && cmd.outfit) v.outfit = cmd.outfit;
    } else {
      if (this.stage.visible.length >= 2) this.evictNonActive();
      v = this.makeEntry(id, cmd && cmd.at, cmd);
      this.stage.visible.push(v);
    }
    this.stage.active = id;
    this.stage.last = id;
  }
  stageShow(id, at, cmd) {
    if (this.stage.visible.some((x) => x.char === id)) return;
    if (this.stage.visible.length >= 2) this.evictNonActive();
    this.stage.visible.push(this.makeEntry(id, at, cmd));
  }

  // ---------------------------------------------------------------- effects
  fxPush(fx) {
    this.fx.push({ ...fx, id: ++this.fxSeq });
  }

  // ------------------------------------------------------------- run / start
  start() {
    this.vars = Object.assign({}, this.game.variables || {});
    this.backlog = [];
    this.callStack = [];
    this.stage = { visible: [], last: null, active: null, bg: null, bgT: null, cg: null, cgT: null, closeup: null, spriteT: null };
    this.audio = { bgm: null };
    this.ended = null;
    this.pending = null;
    this.fx = [];
    this.sceneId = this.game.entry;
    this.frames = [{ cmds: this.sceneScript(this.game.entry), i: 0, origin: null }];
    this.step();
    this.emit();
  }
  restart() {
    this.start();
  }

  sceneScript(id) {
    const s = this.scenes[id];
    return s ? s.script : [];
  }
  labelIndex(script, label) {
    for (let i = 0; i < script.length; i++)
      if (script[i] && script[i].label === label && !("to" in script[i])) return i;
    return 0;
  }

  // The synchronous command loop — runs until a blocking beat or an ending.
  step() {
    while (this.frames.length) {
      const fr = this.frames[this.frames.length - 1];
      if (fr.i >= fr.cmds.length) {
        this.frames.pop();
        continue;
      }
      const cmd = fr.cmds[fr.i++];
      const sig = this.exec(cmd);
      if (sig) return; // LINE | CHOICE | TAP | END
    }
    this.doEnd({ end: null }); // implicit ending
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

  exec(cmd) {
    switch (this.verb(cmd)) {
      case "say":
        return this.doSay(cmd.say, cmd);
      case "narrate":
        return this.doSay(null, { text: cmd.narrate, voice: cmd.voice, id: cmd.id });
      case "bg":
        this.stage.bg = cmd.bg || null;
        this.stage.bgT = this.normTransition(cmd.transition, "bg");
        return;
      case "show":
        this.stageShow(cmd.show, cmd.at, cmd);
        this.stage.spriteT = this.normTransition(cmd.transition, "char");
        return;
      case "hide":
        if (cmd.hide === "all") this.stage.visible = [];
        else this.stage.visible = this.stage.visible.filter((v) => v.char !== cmd.hide);
        this.stage.spriteT = this.normTransition(cmd.transition, "char");
        return;
      case "move": {
        const v = this.stage.visible.find((x) => x.char === cmd.move);
        if (v && !this.stage.visible.some((x) => x.slot === cmd.to && x.char !== cmd.move)) v.slot = cmd.to;
        return;
      }
      case "face": {
        const v = this.stage.visible.find((x) => x.char === cmd.face);
        if (v) v.face = cmd.to;
        return;
      }
      case "outfit": {
        const v = this.stage.visible.find((x) => x.char === cmd.outfit);
        if (v) {
          v.outfit = cmd.to;
          if (cmd.pose) v.pose = cmd.pose;
        }
        return;
      }
      case "cg":
        this.stage.cg = cmd.cg || null;
        this.stage.cgT = this.normTransition(cmd.transition, "cg");
        return;
      case "closeup":
        if (cmd.closeup)
          this.stage.closeup = {
            id: cmd.closeup,
            caption: cmd.caption ? this.text(cmd.caption) : "",
            captionRaw: cmd.caption || null,
            zoom: cmd.zoom || 1,
            dim: cmd.dim != null ? cmd.dim : 0.6,
            transition: this.normTransition(cmd.transition, "char"),
          };
        else this.stage.closeup = null;
        return;
      case "bgm":
        this.audio.bgm = cmd.bgm === null || cmd.bgm === "stop" ? null : cmd.bgm;
        return;
      case "se":
        this.fxPush({ type: "se", id: cmd.se, src: this.asset("se", cmd.se), volume: this.vol("se") });
        return;
      case "voice":
        if (cmd.voice === "stop") this.fxPush({ type: "stopVoice" });
        else this.fxPush({ type: "voice", src: this.resolveVoice(cmd.voice), volume: this.vol("voice") });
        return;
      case "shake":
        this.fxPush({ type: "shake", dur: (cmd.shake && cmd.shake.duration) || 400 });
        return;
      case "flash":
        this.fxPush({ type: "flash", dur: (cmd.flash && cmd.flash.duration) || 200, color: (cmd.flash && cmd.flash.color) || "#fff" });
        return;
      case "wait":
        if (cmd.wait === "click") {
          this.pending = { kind: "tap" };
          return "TAP";
        }
        // a timed wait is a blocking beat the UI auto-advances past after `ms`
        // (so e.g. a close-up shown then cleared actually stays on screen).
        this.pending = { kind: "wait", ms: Number(cmd.wait) || 0 };
        return "WAIT";
      case "choice":
        return this.doChoice(cmd);
      case "set":
        this.assign(cmd.set);
        return;
      case "if":
        this.doIf(cmd);
        return;
      case "label":
        return;
      case "jump":
        this.doJump(cmd.jump);
        return;
      case "call":
        this.callStack.push({ scene: this.sceneId, frames: this.serializeFrames() });
        this.doJump(cmd.call);
        return;
      case "return": {
        const f = this.callStack.pop();
        if (f) this.restoreFramesSync(f.scene, f.frames);
        return;
      }
      case "end":
        return this.doEnd(cmd);
      default:
        return; // unknown verb → skip (forward-compat)
    }
  }

  doSay(speaker, cmd) {
    let name = "";
    let color = "#cfcfd6";
    const ch = speaker ? this.chars[speaker] : null;
    if (ch) {
      name = this.text(ch.name);
      color = ch.nameColor || color;
    }
    if (ch && ch.sprite) this.stageSay(speaker, cmd); // §6.3 alternation (sprite-backed only)
    if (cmd.as) name = this.text(cmd.as);
    const text = this.text(cmd.text);
    this.pending = {
      kind: "line",
      name,
      color,
      text,
      rawText: cmd.text,
      asRaw: cmd.as || null,
      speaker: speaker || null,
      lineId: ++this.lineSeq,
    };
    this.backlog.push({ who: name, line: text });
    if (cmd.voice) {
      this.fxPush({ type: "voice", src: this.resolveVoice(cmd.voice, speaker, cmd.id), volume: this.vol("voice") });
    }
    return "LINE";
  }

  doChoice(cmd) {
    const opts = (cmd.options || [])
      .map((o) => ({ o }))
      .filter(({ o }) => !("if" in o) || this.cond(o.if) || !o.hideIfFalse);
    this.pending = {
      kind: "choice",
      raw: cmd,
      _opts: opts,
      prompt: cmd.choice ? this.text(cmd.choice) : "",
      choices: opts.map((e, pos) => ({
        pos,
        label: this.text(e.o.text),
        enabled: !("if" in e.o) || this.cond(e.o.if),
      })),
    };
    return "CHOICE";
  }

  doIf(cmd) {
    let branch = null;
    if (this.cond(cmd.if)) branch = { sel: "then", cmds: cmd.then || [] };
    else {
      for (let n = 0; n < (cmd.elif || []).length; n++)
        if (this.cond(cmd.elif[n].if)) {
          branch = { sel: "elif:" + n, cmds: cmd.elif[n].then || [] };
          break;
        }
      if (!branch && cmd.else) branch = { sel: "else", cmds: cmd.else };
    }
    if (branch) {
      const parent = this.frames[this.frames.length - 1];
      this.frames.push({ cmds: branch.cmds, i: 0, origin: { at: parent.i - 1, sel: branch.sel } });
    }
  }

  doJump(target) {
    const [scenePart, label] = String(target).split("#");
    const sid = scenePart || this.sceneId;
    const script = this.sceneScript(sid);
    const idx = label ? this.labelIndex(script, label) + 1 : 0;
    this.sceneId = sid;
    this.frames = [{ cmds: script, i: idx, origin: null }];
  }

  doEnd(cmd) {
    const id = cmd.end;
    let title = "";
    if (typeof id === "string" && this.game.endings && this.game.endings[id])
      title = this.text(this.game.endings[id].title);
    this.ended = { id: typeof id === "string" ? id : null, title: title || "The End" };
    this.pending = null;
    this.frames = [];
    this.audio.bgm = null;
    return "END";
  }

  // -------------------------------------------------------- player actions
  advance() {
    if (!this.pending) return;
    if (this.pending.kind === "choice") return; // must choose
    this.pending = null;
    this.step();
    this.emit();
  }
  choose(pos) {
    if (!this.pending || this.pending.kind !== "choice") return;
    const entry = this.pending._opts[pos];
    if (!entry) return;
    const chosen = entry.o;
    this.pending = null;
    if (chosen.set) this.assign(chosen.set);
    const extra = Array.isArray(chosen.do) ? chosen.do.slice() : [];
    if (chosen.jump) extra.push({ jump: chosen.jump });
    if (extra.length) {
      const parent = this.frames[this.frames.length - 1];
      this.frames.push({ cmds: extra, i: 0, origin: { at: parent.i - 1, sel: "choice" } });
    }
    this.step();
    this.emit();
  }
  setLocale(code) {
    if (!this.game.locales.supported.includes(code) || code === this.locale) return;
    this.locale = code;
    if (this.pending && this.pending.kind === "line") {
      this.pending.text = this.text(this.pending.rawText);
      if (this.pending.asRaw) this.pending.name = this.text(this.pending.asRaw);
      else if (this.pending.speaker) {
        const ch = this.chars[this.pending.speaker];
        if (ch) this.pending.name = this.text(ch.name);
      }
      this.pending.lineId = ++this.lineSeq;
    } else if (this.pending && this.pending.kind === "choice") {
      const cmd = this.pending.raw;
      this.pending.prompt = cmd.choice ? this.text(cmd.choice) : "";
      this.pending.choices = this.pending._opts.map((e, pos) => ({
        pos,
        label: this.text(e.o.text),
        enabled: !("if" in e.o) || this.cond(e.o.if),
      }));
    }
    if (this.stage.closeup && this.stage.closeup.captionRaw)
      this.stage.closeup.caption = this.text(this.stage.closeup.captionRaw);
    this.emit();
  }

  // ----------------------------------------------------------- save / load
  serializeFrames() {
    return this.frames.map((f) => ({ i: f.i, origin: f.origin }));
  }
  snapshot() {
    const top = this.frames[this.frames.length - 1];
    const stage = {
      visible: this.stage.visible.map((v) => ({
        char: v.char,
        slot: v.slot,
        outfit: v.outfit,
        pose: v.pose,
        face: v.face,
      })),
      last: this.stage.last,
      active: this.stage.active,
      bg: this.stage.bg || null,
      cg: this.stage.cg || null,
      closeup: this.stage.closeup ? this.stage.closeup.id : null,
    };
    return {
      gvnf: "1.0",
      game: this.game.id,
      gameVersion: this.game.version,
      savedAt: new Date().toISOString(),
      locale: this.locale,
      pc: { scene: this.sceneId, index: top ? top.i : 0 }, // §11 conformant
      frames: this.serializeFrames(), // engine extension: nested-branch resume
      callStack: this.callStack,
      variables: Object.assign({}, this.vars),
      stage,
      audio: { bgm: this.audio.bgm, bgmPositionMs: 0 },
      backlogCursor: this.backlog.length,
    };
  }
  restoreFramesSync(sceneId, frameDescs) {
    const script = this.sceneScript(sceneId);
    this.sceneId = sceneId;
    const frames = [];
    let cmds = script;
    for (let k = 0; k < frameDescs.length; k++) {
      const d = frameDescs[k];
      if (k > 0) {
        const ctrl = frames[k - 1].cmds[d.origin.at];
        if (d.origin.sel === "then") cmds = ctrl.then || [];
        else if (d.origin.sel === "else") cmds = ctrl.else || [];
        else if (d.origin.sel === "choice") cmds = [];
        else if (d.origin.sel.startsWith("elif:")) cmds = (ctrl.elif[+d.origin.sel.slice(5)] || {}).then || [];
      }
      frames.push({ cmds, i: d.i, origin: d.origin });
    }
    this.frames = frames.length ? frames : [{ cmds: script, i: 0, origin: null }];
  }
  loadStage(s) {
    const st = s.stage || {};
    this.stage = {
      visible: (st.visible || []).map((v) => ({ ...v })),
      last: st.last || null,
      active: st.active || null,
      bg: st.bg || null,
      bgT: { type: "none", duration: 0 },
      cg: st.cg || null,
      cgT: { type: "none", duration: 0 },
      closeup: null, // close-ups are momentary; not restored
      spriteT: { type: "none", duration: 0 },
    };
  }
  loadSnapshot(s) {
    this.locale = this.game.locales.supported.includes(s.locale) ? s.locale : this.defaultLocale;
    this.vars = Object.assign({}, s.variables);
    this.callStack = s.callStack || [];
    this.loadStage(s);
    this.audio = { bgm: (s.audio && s.audio.bgm) || null };
    this.ended = null;
    this.pending = null;
    this.fx = [];
    const scene = (s.pc && s.pc.scene) || s.scene;
    if (s.frames) this.restoreFramesSync(scene, s.frames);
    else {
      this.sceneId = scene;
      this.frames = [{ cmds: this.sceneScript(scene), i: (s.pc && s.pc.index) || 0, origin: null }];
    }
    // resume on the SAME beat the player saved at (re-display the line/choice)
    const top = this.frames[this.frames.length - 1];
    if (top && top.i > 0) {
      const prev = top.cmds[top.i - 1];
      const vb = prev && this.verb(prev);
      if (vb === "say" || vb === "narrate" || vb === "choice" || (vb === "wait" && prev.wait === "click")) {
        top.i -= 1; // re-execute the saved beat so the line/choice is shown again
      }
    }
    this.backlog = this.backlog.slice(0, s.backlogCursor != null ? s.backlogCursor : this.backlog.length);
    this.step();
    this.emit();
  }

  // localStorage slots (keyed per game id)
  saveKey(slot) {
    return `galforge:${this.game.id}:save${slot}`;
  }
  save(slot) {
    try {
      localStorage.setItem(this.saveKey(slot), JSON.stringify(this.snapshot()));
    } catch {
      /* storage disabled */
    }
  }
  readSlot(slot) {
    try {
      return JSON.parse(localStorage.getItem(this.saveKey(slot)));
    } catch {
      return null;
    }
  }
  load(slot) {
    const data = this.readSlot(slot);
    if (data) this.loadSnapshot(data);
    return !!data;
  }
  listSaves(n = 4) {
    const out = [];
    for (let i = 1; i <= n; i++) out.push({ slot: i, data: this.readSlot(i) });
    return out;
  }

  // ------------------------------------------------------------- view model
  buildView() {
    const st = this.stage;
    const active = st.active;
    const sprites = st.visible.map((v) => {
      const ch = this.chars[v.char] || {};
      return {
        char: v.char,
        slot: v.slot,
        outfit: v.outfit,
        pose: v.pose,
        face: v.face,
        active: active === v.char,
        dim: !!(active && active !== v.char),
        name: ch.name ? this.text(ch.name) : v.char,
        color: ch.nameColor || null,
        body: this.spriteBody(v.char, v.outfit, v.pose),
        faceImg: this.spriteFace(v.char, v.face),
      };
    });
    const v = {
      ready: true,
      status: this.ended ? "ended" : this.pending ? this.pending.kind : "running",
      title: this.text(this.game.title),
      bg: st.bg ? { id: st.bg, src: this.asset("backgrounds", st.bg), transition: st.bgT } : null,
      cg: st.cg ? { id: st.cg, src: this.asset("cg", st.cg), transition: st.cgT } : null,
      closeup: st.closeup ? { ...st.closeup, src: this.asset("items", st.closeup.id) } : null,
      sprites,
      spriteT: st.spriteT,
      active,
      audio: { bgm: this.audio.bgm, bgmSrc: this.audio.bgm ? this.asset("bgm", this.audio.bgm) : null, volume: this.vol("bgm") },
      locale: this.locale,
      defaultLocale: this.defaultLocale,
      locales: this.game.locales.supported,
      fx: this.fx.slice(),
      backlog: this.backlog,
      seq: ++this.viewSeq,
    };
    if (this.pending && this.pending.kind === "line") {
      v.speaker = this.pending.name ? { name: this.pending.name, color: this.pending.color } : null;
      v.text = this.pending.text;
      v.lineId = this.pending.lineId;
    } else if (this.pending && this.pending.kind === "choice") {
      v.prompt = this.pending.prompt;
      v.choices = this.pending.choices;
    } else if (this.pending && this.pending.kind === "tap") {
      v.tap = true;
    } else if (this.pending && this.pending.kind === "wait") {
      v.waitMs = this.pending.ms;
    }
    if (this.ended) v.ending = this.ended;
    this.fx = [];
    return v;
  }
}
