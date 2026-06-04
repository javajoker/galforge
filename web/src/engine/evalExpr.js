/* Safe expression evaluator — grammar = GVNF script-standard §9.3.
 * Ported verbatim from the vanilla reference runtime (runtime/galforge.js) so
 * both runtimes share identical condition/assignment semantics.
 *
 * Supports: || && ! comparisons (== != < <= > >=) + - * / %, parentheses,
 * numeric/string/bool literals, variable lookup (undeclared → 0), and the
 * functions min/max/abs/has.
 */
function tokenize(src) {
  const re =
    /\s*(>=|<=|==|!=|&&|\|\||[()+\-*/%<>!,]|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*)/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

const FUNCS = { min: Math.min, max: Math.max, abs: Math.abs };

export function evalExpr(src, vars) {
  const t = tokenize(String(src));
  let p = 0;
  const peek = () => t[p];
  const next = () => t[p++];

  function truthy(v) {
    return !(v === false || v === 0 || v === "" || v === undefined || v === null);
  }
  function parseOr() {
    let v = parseAnd();
    while (peek() === "||") {
      next();
      const r = parseAnd();
      v = truthy(v) || truthy(r);
    }
    return v;
  }
  function parseAnd() {
    let v = parseCmp();
    while (peek() === "&&") {
      next();
      const r = parseCmp();
      v = truthy(v) && truthy(r);
    }
    return v;
  }
  function parseCmp() {
    let v = parseAdd();
    if (["==", "!=", "<", "<=", ">", ">="].includes(peek())) {
      const op = next();
      const r = parseAdd();
      switch (op) {
        case "==": return v === r;
        case "!=": return v !== r;
        case "<": return v < r;
        case "<=": return v <= r;
        case ">": return v > r;
        case ">=": return v >= r;
      }
    }
    return v;
  }
  function parseAdd() {
    let v = parseMul();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = parseMul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseMul() {
    let v = parseUnary();
    while (["*", "/", "%"].includes(peek())) {
      const op = next();
      const r = parseUnary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function parseUnary() {
    if (peek() === "!") {
      next();
      return !truthy(parseUnary());
    }
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    return parseAtom();
  }
  function parseAtom() {
    const tok = next();
    if (tok === "(") {
      const v = parseOr();
      if (peek() === ")") next();
      return v;
    }
    if (tok === undefined) return false;
    if (/^\d+\.\d+$/.test(tok) || /^\d+$/.test(tok)) return Number(tok);
    if (tok[0] === "'" || tok[0] === '"') return tok.slice(1, -1).replace(/\\(.)/g, "$1");
    if (tok === "true") return true;
    if (tok === "false") return false;
    if (peek() === "(") {
      // function call
      next();
      const args = [];
      if (peek() !== ")") {
        args.push(parseOr());
        while (peek() === ",") {
          next();
          args.push(parseOr());
        }
      }
      if (peek() === ")") next();
      if (tok === "has") return truthy(args[0]);
      return (FUNCS[tok] || (() => 0))(...args.map(Number));
    }
    return tok in vars ? vars[tok] : 0; // undeclared → 0 (lint warns)
  }
  return parseOr();
}
