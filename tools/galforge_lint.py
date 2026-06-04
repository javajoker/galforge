#!/usr/bin/env python3
"""galforge lint — validate a GVNF (GalForge Visual-Novel Format) project.

Implements the validation rules of the GalForge script standard (docs/spec/script-standard.md
§12): JSON Schema shape validation, cross-file reference resolution, the two-character stage
rule, localization completeness, and flow/branch integrity.

Usage:
    python3 tools/galforge_lint.py <project_dir> [--strict] [--json] [--schemas DIR]

Exit codes: 0 = clean (no errors; warnings allowed unless --strict), 1 = errors found,
2 = could not load project.

Shape validation uses `jsonschema` if installed; if it is missing, shape checks are skipped
(with a notice) and the cross-file + stage checks still run (they are pure-Python).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Verb model (script-standard §8)
# ---------------------------------------------------------------------------
PRIMARY_VERBS = {
    "say", "narrate", "bg", "show", "hide", "move", "cg", "closeup", "bgm", "se",
    "shake", "flash", "wait", "choice", "set", "if", "label", "jump", "call", "return", "end",
}
# Dual-use keys: standalone verbs OR inline modifiers (§8.0)
DUAL_USE = {"face", "outfit", "voice"}
FUNCS = {"min", "max", "abs", "has"}
IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str):
        self.warnings.append(f"{where}: {msg}")


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_project(root: Path):
    proj = {"root": root}
    proj["game"] = load_json(root / "game.json")
    proj["manifest"] = load_json(root / "resources" / "manifest.json")
    proj["chars"] = {p.stem: load_json(p) for p in sorted((root / "characters").glob("*.json"))}
    proj["scenes"] = {p.stem: load_json(p) for p in sorted((root / "scenes").glob("*.json"))}
    proj["locales"] = {p.stem: load_json(p) for p in sorted((root / "i18n").glob("*.json"))}
    return proj


# ---------------------------------------------------------------------------
# Shape validation (optional, requires jsonschema)
# ---------------------------------------------------------------------------
def validate_shape(proj, schema_dir: Path, rep: Report):
    try:
        from jsonschema import Draft202012Validator
        from referencing import Registry, Resource
    except Exception:
        print("  (note: `jsonschema`/`referencing` not installed — skipping shape checks)")
        return

    schemas = {p.name: load_json(p) for p in schema_dir.glob("*.json")}
    if not schemas:
        rep.warn("schemas", f"no schemas found in {schema_dir}")
        return
    base = "https://galforge.dev/schemas/1.0/"
    resources = []
    for name, s in schemas.items():
        res = Resource.from_contents(s)
        if "$id" in s:
            resources.append((s["$id"], res))
        resources.append((base + name, res))
    registry = Registry().with_resources(resources)

    def run(schema_name, data, where):
        if schema_name not in schemas:
            return
        v = Draft202012Validator(schemas[schema_name], registry=registry)
        for e in sorted(v.iter_errors(data), key=lambda e: list(e.path)):
            loc = "/".join(map(str, e.path)) or "<root>"
            rep.err(f"{where} @{loc}", e.message)

    root = proj["root"]
    run("game.schema.json", proj["game"], "game.json")
    run("resource-manifest.schema.json", proj["manifest"], "resources/manifest.json")
    for cid, c in proj["chars"].items():
        run("character.schema.json", c, f"characters/{cid}.json")
    for lid, l in proj["locales"].items():
        run("locale.schema.json", l, f"i18n/{lid}.json")
    for sid, s in proj["scenes"].items():
        run("scene.schema.json", s, f"scenes/{sid}.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = prefix + k
        if isinstance(v, dict):
            out.update(flatten(v, key + "."))
        else:
            out[key] = v
    return out


def resolve_verb(cmd):
    """Return the single command verb (dual-use aware) or None if ambiguous/none."""
    primaries = [k for k in cmd if k in PRIMARY_VERBS]
    if len(primaries) == 1:
        return primaries[0]
    if len(primaries) > 1:
        return None
    if "face" in cmd and "to" in cmd:
        return "face"
    if "outfit" in cmd and "to" in cmd:
        return "outfit"
    if "voice" in cmd:
        return "voice"
    return None


def is_adhoc(scene):
    """An adhoc scene (script-standard §14) carries an `adhoc` block instead of `script`."""
    return isinstance(scene, dict) and "adhoc" in scene


def walk(script):
    """Yield every command, descending into if/then/elif/else and choice option `do`."""
    for cmd in script or []:
        yield cmd
        for arm in ("then", "else"):
            if isinstance(cmd.get(arm), list):
                yield from walk(cmd[arm])
        for branch in cmd.get("elif", []) or []:
            if isinstance(branch.get("then"), list):
                yield from walk(branch["then"])
        for opt in cmd.get("options", []) or []:
            if isinstance(opt.get("do"), list):
                yield from walk(opt["do"])


def scene_labels(scene):
    if is_adhoc(scene):
        return set()  # adhoc scenes have no in-scene labels (§14)
    return {c["label"] for c in walk(scene["script"]) if resolve_verb(c) == "label"}


def ends_explicitly(script):
    """True if every path through `script` terminates with jump/end/return.

    An `if` terminates only when both its `then` and `else` branches terminate.
    """
    if not script:
        return False
    last = script[-1]
    v = resolve_verb(last)
    if v in ("jump", "end", "return"):
        return True
    if v == "if":
        return ends_explicitly(last.get("then", [])) and ends_explicitly(last.get("else", []))
    return False


def expr_idents(expr: str):
    out = set()
    # strip quoted strings, then collect bare identifiers that aren't functions
    stripped = re.sub(r"'[^']*'|\"[^\"]*\"", " ", expr)
    for m in IDENT_RE.findall(stripped):
        low = m.lower()
        if low in FUNCS or low in ("true", "false"):
            continue
        out.add(m)
    return out


# ---------------------------------------------------------------------------
# Cross-file validation (script-standard §12)
# ---------------------------------------------------------------------------
def validate_cross(proj, rep: Report, strict: bool):
    game = proj["game"]
    man = proj["manifest"]
    chars = proj["chars"]
    scenes = proj["scenes"]
    locales = proj["locales"]
    default_locale = game.get("locales", {}).get("default")

    sprites = man.get("sprites", {})
    bgs = man.get("backgrounds", {})
    cgs = man.get("cg", {})
    items = man.get("items", {})
    bgms = man.get("bgm", {})
    ses = man.get("se", {})
    voices = man.get("voice", {})

    # locale key sets
    locale_keys = {}
    for lid, l in locales.items():
        locale_keys[lid] = set(flatten(l.get("strings", {})))
    default_keys = locale_keys.get(default_locale, set())
    if default_locale not in locales:
        rep.err("game.json", f"default locale '{default_locale}' has no i18n/{default_locale}.json")

    used_keys = set()
    used_assets = {"bg": set(), "cg": set(), "item": set(), "bgm": set(), "se": set(),
                   "voice": set(), "char": set()}
    declared_vars = set(game.get("variables", {}).keys())
    read_vars = set()

    def chk_text(t, where):
        if not isinstance(t, str):
            return
        if t.startswith("@@"):
            return
        if t.startswith("@"):
            key = t[1:]
            used_keys.add(key)
            if default_keys and key not in default_keys:
                rep.err(where, f"i18n key '{key}' missing from default locale '{default_locale}'")
            for lid, ks in locale_keys.items():
                if lid != default_locale and key not in ks:
                    rep.warn(where, f"i18n key '{key}' missing from locale '{lid}'")
            # {var} interpolation tokens
            for tok in re.findall(r"\{([a-z0-9_]+)\}", t):
                read_vars.add(tok)
        else:
            rep.warn(where, "inline literal text where an @i18n key is expected")

    def voicepat(speaker, line):
        pat = game.get("voicePattern", "{speaker}/{line}")
        return pat.format(speaker=speaker, line=line, locale=default_locale)

    def chk_voice(v, speaker, line, where):
        if v in (None, "stop"):
            return
        if v == "auto":
            if not line:
                rep.warn(where, "voice 'auto' has no line `id` to resolve")
                return
            vid = voicepat(speaker, line)
            used_assets["voice"].add(vid)
            if vid not in voices and f"{vid}@{default_locale}" not in voices:
                rep.warn(where, f"voice 'auto' resolves to '{vid}' which is not in the manifest")
        else:
            used_assets["voice"].add(v)
            if v not in voices:
                rep.err(where, f"voice id '{v}' not in manifest")

    def outfit_ok(cid, o):
        return cid in sprites and o in sprites[cid].get("bodies", {})

    def pose_ok(cid, o, p):
        return outfit_ok(cid, o) and p in sprites[cid]["bodies"][o]

    def face_ok(cid, f):
        return cid in sprites and f in sprites[cid].get("faces", {})

    def chk_jump(target, current, where):
        scene_part, _, label = target.partition("#")
        s = scene_part or current
        if s not in scenes:
            rep.err(where, f"jump target scene '{s}' not found")
            return
        if label and label not in scene_labels(scenes[s]):
            rep.err(where, f"label '#{label}' not found in scene '{s}'")

    def chk_cmd(cmd, sid, where):
        verb = resolve_verb(cmd)
        present = [k for k in cmd if k in PRIMARY_VERBS or k in DUAL_USE]
        if verb is None:
            rep.err(where, f"command does not resolve to exactly one verb (keys: {present})")
            return

        if verb == "say":
            sp = cmd.get("say")
            chk_text(cmd.get("text"), where)
            chk_text(cmd.get("as"), where)
            if sp is not None:
                used_assets["char"].add(sp)
                if sp not in chars:
                    rep.err(where, f"unknown speaker '{sp}'")
                elif chars[sp].get("sprite"):
                    if "face" in cmd and not face_ok(sp, cmd["face"]):
                        rep.err(where, f"'{sp}' has no expression '{cmd['face']}'")
                    if "outfit" in cmd and not outfit_ok(sp, cmd["outfit"]):
                        rep.err(where, f"'{sp}' has no outfit '{cmd['outfit']}'")
            if "voice" in cmd:
                chk_voice(cmd["voice"], sp, cmd.get("id"), where)
        elif verb == "narrate":
            chk_text(cmd.get("narrate"), where)
            if "voice" in cmd:
                chk_voice(cmd["voice"], "narrator", cmd.get("id"), where)
        elif verb == "bg":
            if cmd["bg"] is not None:
                used_assets["bg"].add(cmd["bg"])
                if cmd["bg"] not in bgs:
                    rep.err(where, f"background '{cmd['bg']}' not in manifest")
        elif verb == "cg":
            if cmd["cg"] is not None:
                used_assets["cg"].add(cmd["cg"])
                if cmd["cg"] not in cgs:
                    rep.err(where, f"cg '{cmd['cg']}' not in manifest")
        elif verb == "closeup":
            if cmd["closeup"] is not None:
                used_assets["item"].add(cmd["closeup"])
                if cmd["closeup"] not in items:
                    rep.err(where, f"item '{cmd['closeup']}' not in manifest")
            chk_text(cmd.get("caption"), where)
        elif verb == "show":
            cid = cmd["show"]
            used_assets["char"].add(cid)
            if cid not in chars:
                rep.err(where, f"unknown character '{cid}'")
            else:
                o = cmd.get("outfit", chars[cid].get("defaultOutfit"))
                p = cmd.get("pose", chars[cid].get("defaultPose"))
                if o and not outfit_ok(cid, o):
                    rep.err(where, f"'{cid}' has no outfit '{o}'")
                elif o and p and not pose_ok(cid, o, p):
                    rep.err(where, f"'{cid}/{o}' has no pose '{p}'")
                if "face" in cmd and not face_ok(cid, cmd["face"]):
                    rep.err(where, f"'{cid}' has no expression '{cmd['face']}'")
        elif verb in ("hide", "move"):
            cid = cmd[verb]
            if cid != "all":
                used_assets["char"].add(cid)
                if cid not in chars:
                    rep.err(where, f"unknown character '{cid}'")
        elif verb == "face":
            cid = cmd["face"]
            used_assets["char"].add(cid)
            if cid not in chars:
                rep.err(where, f"unknown character '{cid}'")
            elif not face_ok(cid, cmd["to"]):
                rep.err(where, f"'{cid}' has no expression '{cmd['to']}'")
        elif verb == "outfit":
            cid = cmd["outfit"]
            used_assets["char"].add(cid)
            if cid not in chars:
                rep.err(where, f"unknown character '{cid}'")
            elif not outfit_ok(cid, cmd["to"]):
                rep.err(where, f"'{cid}' has no outfit '{cmd['to']}'")
        elif verb == "bgm":
            b = cmd["bgm"]
            if b not in (None, "stop"):
                used_assets["bgm"].add(b)
                if b not in bgms:
                    rep.err(where, f"bgm '{b}' not in manifest")
        elif verb == "se":
            used_assets["se"].add(cmd["se"])
            if cmd["se"] not in ses:
                rep.err(where, f"se '{cmd['se']}' not in manifest")
        elif verb == "voice":
            if cmd["voice"] != "stop":
                used_assets["voice"].add(cmd["voice"])
                if cmd["voice"] not in voices:
                    rep.err(where, f"voice '{cmd['voice']}' not in manifest")
        elif verb == "jump":
            chk_jump(cmd["jump"], sid, where)
        elif verb == "call":
            chk_jump(cmd["call"], sid, where)
        elif verb == "choice":
            chk_text(cmd.get("choice"), where)
            for j, opt in enumerate(cmd.get("options", [])):
                chk_text(opt.get("text"), f"{where}.opt{j}")
                if "if" in opt:
                    read_vars.update(expr_idents(opt["if"]))
                if "set" in opt:
                    declared_vars.update(opt["set"].keys())
                    for var, val in opt["set"].items():
                        if isinstance(val, str) and val.startswith("="):
                            read_vars.update(expr_idents(val[1:]))
                if "jump" in opt:
                    chk_jump(opt["jump"], sid, f"{where}.opt{j}")
        elif verb == "set":
            declared_vars.update(cmd["set"].keys())
            for var, val in cmd["set"].items():
                if isinstance(val, str) and val.startswith("="):
                    read_vars.update(expr_idents(val[1:]))
        elif verb == "if":
            read_vars.update(expr_idents(cmd["if"]))
            for branch in cmd.get("elif", []) or []:
                read_vars.update(expr_idents(branch.get("if", "")))
        elif verb == "end":
            if isinstance(cmd["end"], str) and cmd["end"] not in game.get("endings", {}):
                rep.err(where, f"ending '{cmd['end']}' not declared in game.json")

    def chk_set(d, where):
        """Treat a `set`-style map's keys as declared and collect expr reads."""
        if not isinstance(d, dict):
            return
        declared_vars.update(d.keys())
        for val in d.values():
            if isinstance(val, str) and val.startswith("="):
                read_vars.update(expr_idents(val[1:]))

    def chk_adhoc(scene, sid, where):
        """Validate an adhoc scene's exits, fallback, and variable interface (§14.7)."""
        a = scene["adhoc"]
        chk_text(a.get("title"), f"{where} adhoc.title")
        read_vars.update(a.get("reads", []) or [])
        declared_vars.update(a.get("writes", []) or [])
        exit_ids = set()
        for j, ex in enumerate(a.get("exits", []) or []):
            ew = f"{where} adhoc.exits[{j}]"
            if ex.get("id"):
                exit_ids.add(ex["id"])
            ctrl = [k for k in ("jump", "end", "return") if k in ex]
            if len(ctrl) != 1:
                rep.err(ew, f"exit must have exactly one of jump/end/return (has: {ctrl})")
            if "jump" in ex:
                chk_jump(ex["jump"], sid, ew)
            if "end" in ex and isinstance(ex["end"], str) and ex["end"] not in game.get("endings", {}):
                rep.err(ew, f"ending '{ex['end']}' not declared in game.json")
            chk_set(ex.get("set"), ew)
        fb = a.get("fallback") or {}
        if fb.get("exit") not in exit_ids:
            rep.err(f"{where} adhoc.fallback", f"fallback exit '{fb.get('exit')}' is not a declared exit")
        chk_set(fb.get("set"), f"{where} adhoc.fallback")

    # Walk every scene
    for sid, scene in scenes.items():
        if scene.get("id") and scene["id"] != sid:
            rep.warn(f"scenes/{sid}.json", f"id '{scene['id']}' does not match filename")
        has_script = isinstance(scene.get("script"), list)
        has_adhoc = is_adhoc(scene)
        if has_script == has_adhoc:  # both present, or neither
            rep.err(f"scenes/{sid}.json", "scene must have exactly one of 'script' or 'adhoc' (§14.1)")
            continue
        if has_adhoc:
            chk_adhoc(scene, sid, f"scenes/{sid}.json")
            continue
        for i, cmd in enumerate(scene["script"]):
            chk_cmd(cmd, sid, f"{sid}[{i}]")
            for arm in ("then", "else"):
                for k, sub in enumerate(cmd.get(arm, []) or []):
                    chk_cmd(sub, sid, f"{sid}[{i}].{arm}[{k}]")
            for bk, branch in enumerate(cmd.get("elif", []) or []):
                for k, sub in enumerate(branch.get("then", []) or []):
                    chk_cmd(sub, sid, f"{sid}[{i}].elif[{bk}][{k}]")
            for ok, opt in enumerate(cmd.get("options", []) or []):
                for k, sub in enumerate(opt.get("do", []) or []):
                    chk_cmd(sub, sid, f"{sid}[{i}].opt{ok}.do[{k}]")
        # implicit-end warning
        if scene["script"] and not ends_explicitly(scene["script"]):
            rep.warn(f"scenes/{sid}.json", "scene ends without an explicit jump/end (implicit end)")

    # game-level texts
    chk_text(game.get("title"), "game.json title")
    for eid, e in game.get("endings", {}).items():
        chk_text(e.get("title"), f"game.json endings.{eid}")
    for cid, c in chars.items():
        chk_text(c.get("name"), f"characters/{cid}.json name")

    # entry scene
    entry = game.get("entry")
    if entry not in scenes:
        rep.err("game.json", f"entry scene '{entry}' not found")

    # reachability (warning)
    reachable = set()

    def visit(sid):
        if sid in reachable or sid not in scenes:
            return
        reachable.add(sid)
        scene = scenes[sid]
        if is_adhoc(scene):  # an adhoc scene reaches the scenes named by its exit jumps (§14.3)
            for ex in scene["adhoc"].get("exits", []) or []:
                if "jump" in ex:
                    tgt = ex["jump"].partition("#")[0]
                    if tgt:
                        visit(tgt)
            return
        for cmd in walk(scene["script"]):
            v = resolve_verb(cmd)
            if v in ("jump", "call"):
                tgt = cmd[v].partition("#")[0]
                if tgt:
                    visit(tgt)
            elif v == "choice":
                for opt in cmd.get("options", []):
                    if "jump" in opt:
                        tgt = opt["jump"].partition("#")[0]
                        if tgt:
                            visit(tgt)

    if entry in scenes:
        visit(entry)
    for sid in scenes:
        if sid not in reachable:
            rep.warn(f"scenes/{sid}.json", "scene is unreachable from the entry scene")

    # undeclared variable reads (warning)
    for v in sorted(read_vars - declared_vars):
        rep.warn("variables", f"variable '{v}' is read but never declared/initialized")

    # unused assets (warning); gallery/cover exempt
    def exempt(meta):
        tags = meta.get("tags", []) if isinstance(meta, dict) else []
        return "gallery" in tags
    cover = game.get("meta", {}).get("cover")
    for aid, meta in bgs.items():
        if aid not in used_assets["bg"] and not exempt(meta):
            rep.warn("resources", f"background '{aid}' is declared but never used")
    for aid, meta in cgs.items():
        if aid not in used_assets["cg"] and not exempt(meta) and aid != cover:
            rep.warn("resources", f"cg '{aid}' is declared but never used")
    for aid, meta in items.items():
        if aid not in used_assets["item"] and not exempt(meta):
            rep.warn("resources", f"item '{aid}' is declared but never used")
    for aid, meta in bgms.items():
        if aid not in used_assets["bgm"] and not exempt(meta):
            rep.warn("resources", f"bgm '{aid}' is declared but never used")
    for aid, meta in ses.items():
        if aid not in used_assets["se"] and not exempt(meta):
            rep.warn("resources", f"se '{aid}' is declared but never used")
    for cid in sprites:
        if cid not in used_assets["char"]:
            rep.warn("resources", f"sprite set '{cid}' is declared but never used")


# ---------------------------------------------------------------------------
# Stage-rule simulation (script-standard §6) — the two-character limit
# ---------------------------------------------------------------------------
def simulate_stage(proj, rep: Report):
    chars = proj["chars"]
    sprite_chars = {cid for cid, c in chars.items() if c.get("sprite")}
    global_mode = proj["game"].get("stage", {}).get("mode", "auto")

    def sim(scene):
        if is_adhoc(scene):
            return 0  # adhoc scenes manage their own presentation; no GVNF stage (§14)
        mode = scene.get("stageMode", global_mode)
        visible = []  # list[(char, slot)]
        last = [None]
        max_seen = [0]

        def place(cid):
            pref = chars.get(cid, {}).get("defaultPosition")
            used = {s for _, s in visible}
            if pref in ("left", "right") and pref not in used:
                slot = pref
            else:
                slot = next((s for s in ("left", "right", "center") if s not in used), "left")
            visible.append((cid, slot))

        def evict_nonactive():
            victim = next((c for c, _ in visible if c != last[0]), visible[0][0])
            visible[:] = [(c, s) for c, s in visible if c != victim]

        def say(cid, where):
            if cid not in sprite_chars:
                return
            if cid in [c for c, _ in visible]:
                last[0] = cid
                return
            if len(visible) >= 2:
                evict_nonactive()
            place(cid)
            last[0] = cid
            max_seen[0] = max(max_seen[0], len(visible))

        def show(cid, where):
            if cid in [c for c, _ in visible]:
                return
            if len(visible) >= 2:
                if mode == "manual":
                    rep.err(where, f"`show {cid}` would put 3 characters on stage (manual mode); the two-character limit is hard (§6.1)")
                    return
                evict_nonactive()
            place(cid)
            max_seen[0] = max(max_seen[0], len(visible))

        def run(script, prefix):
            for i, cmd in enumerate(script):
                where = f"{prefix}[{i}]"
                v = resolve_verb(cmd)
                if v == "say" and cmd.get("say"):
                    say(cmd["say"], where)
                elif v == "show":
                    show(cmd["show"], where)
                elif v == "hide":
                    if cmd["hide"] == "all":
                        visible.clear()
                    else:
                        visible[:] = [(c, s) for c, s in visible if c != cmd["hide"]]
                elif v == "if":
                    snapshot = list(visible)
                    run(cmd.get("then", []), f"{where}.then")
                    visible[:] = list(snapshot)
                    for branch in cmd.get("elif", []) or []:
                        run(branch.get("then", []), f"{where}.elif")
                        visible[:] = list(snapshot)
                    run(cmd.get("else", []), f"{where}.else")
                    visible[:] = list(snapshot)

        run(scene["script"], scene.get("id", "scene"))
        return max_seen[0]

    for sid, scene in proj["scenes"].items():
        mx = sim(scene)
        if mx > 2:
            rep.err(f"scenes/{sid}.json", f"stage shows {mx} characters simultaneously (max 2, §6.1)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="Validate a GVNF (GalForge) project.")
    ap.add_argument("project", help="path to the GVNF project directory (containing game.json)")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors (ship gate)")
    ap.add_argument("--json", action="store_true", dest="as_json", help="emit machine-readable JSON")
    ap.add_argument("--schemas", default=None, help="path to the JSON Schemas directory")
    args = ap.parse_args(argv)

    root = Path(args.project).resolve()
    if not (root / "game.json").exists():
        print(f"error: no game.json in {root}", file=sys.stderr)
        return 2

    schema_dir = Path(args.schemas).resolve() if args.schemas else (
        Path(__file__).resolve().parents[1] / "docs" / "spec" / "schemas")

    rep = Report()
    try:
        proj = load_project(root)
    except Exception as e:  # noqa: BLE001
        print(f"error: failed to load project: {e}", file=sys.stderr)
        return 2

    if not args.as_json:
        print(f"galforge lint — {root}")
        print("  validating shape (JSON Schema)…")
    validate_shape(proj, schema_dir, rep)
    validate_cross(proj, rep, args.strict)
    simulate_stage(proj, rep)

    promoted = args.strict and rep.warnings
    fail = bool(rep.errors) or bool(promoted)

    if args.as_json:
        print(json.dumps({
            "project": str(root),
            "errors": rep.errors,
            "warnings": rep.warnings,
            "strict": args.strict,
            "ok": not fail,
        }, indent=2, ensure_ascii=False))
    else:
        for e in rep.errors:
            print(f"  ERROR   {e}")
        for w in rep.warnings:
            label = "ERROR  " if args.strict else "warning"
            print(f"  {label} {w}" + ("   (strict)" if args.strict else ""))
        print()
        print(f"  {len(rep.errors)} error(s), {len(rep.warnings)} warning(s)"
              + ("  [--strict: warnings fail]" if args.strict else ""))
        print("  RESULT:", "FAIL" if fail else "clean ✓")

    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
