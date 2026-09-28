#!/usr/bin/env -S npx tsx
/* eslint-disable */
// @ts-nocheck
import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate2(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate2(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules2 = self.RULES.keywords;
      for (const key in schema) {
        if (!rules2[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules2) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules2[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate2 = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate2);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules2 = it.self.RULES.all;
      for (const keyword in rules2) {
        const rule = rules2[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches2 = RELATIVE_JSON_POINTER.exec($data);
        if (!matches2)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches2[1];
        jsonPointer = matches2[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate2 = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate2 });
        validate2.errors = null;
        validate2.schema = sch.schema;
        validate2.schemaEnv = sch;
        if (sch.$async)
          validate2.$async = true;
        if (this.opts.code.source === true) {
          validate2.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate2.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate2.source)
            validate2.source.evaluated = (0, codegen_1.stringify)(validate2.evaluated);
        }
        sch.validate = validate2;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve16.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve16(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isPort = RegExp.prototype.test.bind(/^\d*$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u);
    var isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u);
    var isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u);
    var BYTE_HEX = new Array(256);
    {
      const HEX_DIGITS = "0123456789ABCDEF";
      for (let i = 0; i < 256; i++) {
        BYTE_HEX[i] = "%" + HEX_DIGITS[i >> 4] + HEX_DIGITS[i & 15];
      }
    }
    function percentEncodeNonAscii(cp) {
      if (cp < 2048) {
        return BYTE_HEX[192 | cp >> 6] + BYTE_HEX[128 | cp & 63];
      }
      if (cp < 65536) {
        return BYTE_HEX[224 | cp >> 12] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
      }
      return BYTE_HEX[240 | cp >> 18] + BYTE_HEX[128 | cp >> 12 & 63] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
    }
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var isHextet = RegExp.prototype.test.bind(/^[\dA-Fa-f]{1,4}$/);
    var isIPvFuture = RegExp.prototype.test.bind(/^[vV][\dA-Fa-f]+\.[A-Za-z\d\-._~!$&'()*+,;=:]+$/);
    var isZoneCharacter = RegExp.prototype.test.bind(/^[A-Za-z\d\-._~]$/);
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function isZoneIdentifier(zone) {
      if (zone.length === 0) return false;
      for (let i = 0; i < zone.length; i++) {
        if (isZoneCharacter(zone[i])) continue;
        if (zone[i] === "%" && i + 2 < zone.length && isHexPair(zone.slice(i + 1, i + 3))) {
          i += 2;
          continue;
        }
        return false;
      }
      return true;
    }
    function compressIPv6ZeroRun(hextets) {
      let bestStart = -1;
      let bestLength = 0;
      let runStart = -1;
      let runLength = 0;
      for (let i = 0; i < hextets.length; i++) {
        if (hextets[i] === "0") {
          if (runStart === -1) runStart = i;
          runLength++;
          if (runLength > bestLength) {
            bestLength = runLength;
            bestStart = runStart;
          }
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (bestLength < 2) return hextets.join(":");
      const head = hextets.slice(0, bestStart).join(":");
      const tail = hextets.slice(bestStart + bestLength).join(":");
      return head + "::" + tail;
    }
    function normalizeIPv6Address(input) {
      const compression = input.indexOf("::");
      if (compression !== -1 && input.indexOf("::", compression + 1) !== -1) return void 0;
      const left = compression === -1 ? input.split(":") : input.slice(0, compression).split(":");
      const right = compression === -1 ? [] : input.slice(compression + 2).split(":");
      if (compression !== -1) {
        if (left.length === 1 && left[0] === "") left.length = 0;
        if (right.length === 1 && right[0] === "") right.length = 0;
      }
      const parts = left.concat(right);
      let hextetCount = 0;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") return void 0;
        if (part.indexOf(".") !== -1) {
          if (i !== parts.length - 1 || compression !== -1 && right.length === 0 || !isIPv4(part)) return void 0;
          hextetCount += 2;
          continue;
        }
        if (!isHextet(part)) return void 0;
        parts[i] = parseInt(part, 16).toString(16);
        hextetCount++;
      }
      if (compression === -1) {
        if (hextetCount !== 8) return void 0;
        return compressIPv6ZeroRun(parts);
      }
      if (hextetCount >= 8) return void 0;
      const expanded = parts.slice(0, left.length);
      for (let i = hextetCount; i < 8; i++) expanded.push("0");
      for (let i = left.length; i < parts.length; i++) expanded.push(parts[i]);
      return compressIPv6ZeroRun(expanded);
    }
    function normalizeIPv6(host) {
      const bracketed = host[0] === "[" && host[host.length - 1] === "]";
      const hasBracket = host[0] === "[" || host[host.length - 1] === "]";
      if (hasBracket && !bracketed) return { host, isIPV6: false, error: true };
      let input = bracketed ? host.slice(1, -1) : host;
      if (bracketed && isIPvFuture(input)) {
        input = input.toLowerCase();
        return { host: `[${input}]`, escapedHost: input, isIPV6: false, isIPVFuture: true };
      }
      if (findToken(input, ":") < 2) {
        return { host, isIPV6: false, error: bracketed };
      }
      let zoneIdentifier = "";
      const zoneSeparator = input.indexOf("%");
      if (zoneSeparator !== -1) {
        const separatorLength = input.slice(zoneSeparator, zoneSeparator + 3).toLowerCase() === "%25" ? 3 : 1;
        zoneIdentifier = input.slice(zoneSeparator + separatorLength);
        if (!isZoneIdentifier(zoneIdentifier)) return { host, isIPV6: false, error: true };
        input = input.slice(0, zoneSeparator);
      }
      const address = normalizeIPv6Address(input);
      if (address === void 0) return { host, isIPV6: false, error: true };
      return {
        host: address + (zoneIdentifier ? "%" + zoneIdentifier : ""),
        escapedHost: address + (zoneIdentifier ? "%25" + zoneIdentifier : ""),
        isIPV6: true
      };
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function serializePathEncoding(input, pathNoScheme = false) {
      let output = "";
      let firstSegment = pathNoScheme && input[0] !== "/";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (ch === "/") {
          firstSegment = false;
        }
        if (isPathCharacter(ch) && (ch !== ":" || !firstSegment)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeComponent(input, isAllowed) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (isAllowed(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeUserinfo(input) {
      return encodeComponent(input, isUserinfoCharacter);
    }
    function encodeQuery(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function encodeFragment(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function isEscapeSafe(cp) {
      return cp >= 48 && cp <= 57 || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 42 || cp === 43 || cp === 45 || cp === 46 || cp === 47 || cp === 64 || cp === 95;
    }
    function normalizeQueryFragmentEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isQueryFragmentCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(encodeUserinfo(component.userinfo));
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = component.host;
        if (!isIPv4(host)) {
          let ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 !== true && ipV6res.isIPVFuture !== true) {
            host = normalizePercentEncoding(host, true);
            ipV6res = normalizeIPv6(host);
          }
          if (ipV6res.isIPV6 === true || ipV6res.isIPVFuture === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        const port = String(component.port);
        if (!isPort(port)) {
          throw new TypeError("URI port is malformed.");
        }
        uriTokens.push(":");
        uriTokens.push(port);
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      serializePathEncoding,
      normalizeQueryFragmentEncoding,
      encodeUserinfo,
      encodeQuery,
      encodeFragment,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const queryIndex = wsComponent.resourceName.indexOf("?");
        const path = queryIndex === -1 ? wsComponent.resourceName : wsComponent.resourceName.slice(0, queryIndex);
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = queryIndex === -1 ? void 0 : wsComponent.resourceName.slice(queryIndex + 1);
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches2 = urnComponent.path.match(URN_REG);
      if (matches2 && matches2[0] === urnComponent.path) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches2[1].toLowerCase();
        urnComponent.nss = matches2[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, serializePathEncoding, normalizeQueryFragmentEncoding, encodeQuery, encodeFragment, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    var VALID_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/u;
    var MALFORMED_SCHEME_ERROR = "URI scheme is malformed.";
    function decodeValidScheme(scheme) {
      const decodedScheme = unescape(String(scheme));
      if (!VALID_SCHEME.test(decodedScheme)) {
        throw new TypeError(MALFORMED_SCHEME_ERROR);
      }
      return decodedScheme;
    }
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve16(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const {
        parsed: baseParsed,
        malformedAuthorityOrPort: baseMalformed,
        malformedPercentEncoding: baseMalformedPercentEncoding,
        malformedSchemeSpecific: baseMalformedSchemeSpecific,
        malformedHost: baseMalformedHost,
        malformedScheme: baseMalformedScheme
      } = parseWithStatus(baseURI, schemelessOptions);
      const {
        parsed: relativeParsed,
        malformedAuthorityOrPort: relativeMalformed,
        malformedPercentEncoding: relativeMalformedPercentEncoding,
        malformedSchemeSpecific: relativeMalformedSchemeSpecific,
        malformedHost: relativeMalformedHost,
        malformedScheme: relativeMalformedScheme
      } = parseWithStatus(relativeURI, schemelessOptions);
      if (baseMalformed || relativeMalformed || baseMalformedPercentEncoding || relativeMalformedPercentEncoding || baseMalformedSchemeSpecific || relativeMalformedSchemeSpecific || baseMalformedHost || relativeMalformedHost || baseMalformedScheme || relativeMalformedScheme) {
        throw new Error(baseParsed.error || relativeParsed.error || "URI is malformed.");
      }
      const resolved = resolveComponent(baseParsed, relativeParsed, schemelessOptions, true);
      const resolvedSchemeHandler = getSchemeHandler(options && options.scheme || resolved.scheme);
      const resolvedHost = resolved.host;
      const resolvedHostIsIP = resolvedHost !== void 0 && resolvedHost !== "" && (isIPv4(resolvedHost) || normalizeIPv6(resolvedHost).isIPV6);
      canonicalizeHost2(resolved, options || {}, resolvedSchemeHandler, resolvedHostIsIP);
      const encodedASCIIHost = resolvedHost && resolvedHost.indexOf("%") !== -1 && !new RegExp("\\P{ASCII}", "u").test(resolvedHost);
      if (resolved.error && !encodedASCIIHost) {
        throw new Error(resolved.error);
      }
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative3, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative3 = parse(serialize(relative3, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative3.scheme) {
        target.scheme = relative3.scheme;
        target.userinfo = relative3.userinfo;
        target.host = relative3.host;
        target.port = relative3.port;
        target.path = removeDotSegments(relative3.path || "");
        target.query = relative3.query;
      } else {
        if (relative3.userinfo !== void 0 || relative3.host !== void 0 || relative3.port !== void 0) {
          target.userinfo = relative3.userinfo;
          target.host = relative3.host;
          target.port = relative3.port;
          target.path = removeDotSegments(relative3.path || "");
          target.query = relative3.query;
        } else {
          if (!relative3.path) {
            target.path = base.path;
            if (relative3.query !== void 0) {
              target.query = relative3.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative3.path[0] === "/") {
              target.path = removeDotSegments(relative3.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative3.path;
              } else if (!base.path) {
                target.path = relative3.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative3.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative3.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative3.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA === normalizedB;
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      if (component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
      }
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      const hasAuthority = component.userinfo !== void 0 || component.host !== void 0 || component.port !== void 0;
      const pathNoScheme = !options.skipEscape && component.scheme === void 0 && !hasAuthority;
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = serializePathEncoding(component.path, pathNoScheme);
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (pathNoScheme) {
          s = serializePathEncoding(s, true);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", encodeQuery(component.query));
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", encodeFragment(component.fragment));
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    var AUTHORITY_INTRODUCER_REGION = /^(?:[^#/:?]+:)?([/\\\t\n\r]*)/;
    function getParseError(parsed, matches2) {
      if (matches2[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function hasMalformedPercentEncoding(component) {
      if (component === void 0) return false;
      let percent = component.indexOf("%");
      while (percent !== -1) {
        if (percent + 2 >= component.length || !/^[\da-f]{2}$/iu.test(component.slice(percent + 1, percent + 3))) {
          return true;
        }
        percent = component.indexOf("%", percent + 3);
      }
      return false;
    }
    function isIPLiteral(host) {
      return host[0] === "[" && host[host.length - 1] === "]";
    }
    function hasMalformedComponentPercentEncoding(matches2) {
      const host = matches2[4];
      return hasMalformedPercentEncoding(matches2[3]) || host !== void 0 && !isIPLiteral(host) && hasMalformedPercentEncoding(host) || hasMalformedPercentEncoding(matches2[6]) || hasMalformedPercentEncoding(matches2[7]) || hasMalformedPercentEncoding(matches2[8]);
    }
    function canonicalizeHost2(parsed, options, schemeHandler, isIP) {
      if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport) && parsed.host && !isIPLiteral(parsed.host) && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
        try {
          parsed.host = new URL("http://" + parsed.host).hostname;
        } catch (e) {
          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          return true;
        }
      }
      return false;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let malformedPercentEncoding = false;
      let malformedSchemeSpecific = false;
      let malformedHost = false;
      let malformedIPLiteral = false;
      let malformedScheme = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const introducerMatch = uri.match(AUTHORITY_INTRODUCER_REGION);
      if (introducerMatch !== null) {
        const region = introducerMatch[1];
        const normalizedRegion = region.replace(/[\t\n\r]/g, "");
        if (normalizedRegion.length >= 2) {
          if (normalizedRegion.slice(0, 2) !== "//") {
            parsed.error = parsed.error || "URI authority must not contain a literal backslash.";
            malformedAuthorityOrPort = true;
          } else if (region.length !== normalizedRegion.length) {
            parsed.error = parsed.error || "URI authority introducer must not contain whitespace.";
            malformedAuthorityOrPort = true;
          }
        }
      }
      const matches2 = uri.match(URI_PARSE);
      if (matches2) {
        parsed.scheme = matches2[1];
        parsed.userinfo = matches2[3];
        parsed.host = matches2[4];
        parsed.port = parseInt(matches2[5], 10);
        parsed.path = matches2[6] || "";
        parsed.query = matches2[7];
        parsed.fragment = matches2[8];
        if (parsed.scheme !== void 0) {
          const decodedScheme = unescape(parsed.scheme);
          if (VALID_SCHEME.test(decodedScheme)) {
            parsed.scheme = decodedScheme.toLowerCase();
          } else {
            parsed.error = parsed.error || MALFORMED_SCHEME_ERROR;
            malformedScheme = true;
          }
        }
        malformedPercentEncoding = hasMalformedComponentPercentEncoding(matches2);
        if (malformedPercentEncoding) {
          parsed.error = parsed.error || "URI contains malformed percent-encoding.";
        }
        if (isNaN(parsed.port)) {
          parsed.port = matches2[5];
        }
        const parseError = getParseError(parsed, matches2);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const bracketedIPLiteral = isIPLiteral(parsed.host);
            const hasIPLiteralBracket = parsed.host.indexOf("[") !== -1 || parsed.host.indexOf("]") !== -1;
            const ipv6result = normalizeIPv6(parsed.host);
            isIP = ipv6result.isIPV6 || ipv6result.isIPVFuture === true;
            malformedIPLiteral = hasIPLiteralBracket && (!bracketedIPLiteral || ipv6result.error === true);
            parsed.host = isIP ? ipv6result.host : ipv6result.host.toLowerCase();
            if (malformedIPLiteral) {
              parsed.error = parsed.error || "URI host is malformed.";
              malformedAuthorityOrPort = true;
            }
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!malformedIPLiteral) {
          malformedHost = canonicalizeHost2(parsed, options, schemeHandler, isIP);
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.host !== void 0 && !malformedIPLiteral) {
              const host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true);
              parsed.host = reescapeHostDelimiters(host, isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.query) {
            parsed.query = normalizeQueryFragmentEncoding(parsed.query);
          }
          if (parsed.fragment) {
            parsed.fragment = normalizeQueryFragmentEncoding(parsed.fragment);
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
          if (schemeHandler === SCHEMES.urn && parsed.nid === void 0) {
            malformedSchemeSpecific = true;
          }
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort,
        malformedPercentEncoding,
        malformedSchemeSpecific,
        malformedHost,
        malformedScheme
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri !== "string" && typeof uri !== "object") {
        return void 0;
      }
      let value;
      try {
        value = typeof uri === "string" ? uri : serialize(uri, opts);
      } catch {
        return void 0;
      }
      const { normalized, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = normalizeStringWithStatus(value, opts);
      return malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? void 0 : normalized;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve16,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv2 = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules2 = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules2) {
            const rule = rules2[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv2.ValidationError = validation_error_1.default;
    Ajv2.MissingRefError = ref_error_1.default;
    exports.default = Ajv2;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module) {
    module.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv2 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv2;
    module.exports = exports = Ajv2;
    module.exports.Ajv = Ajv2;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv2;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// packages/core/diagnostics/registry.ts
function lookup(code) {
  const entry = REGISTRY[code];
  if (entry === void 0) {
    throw new Error(`diag(): unknown diagnostic code "${code}" \u2014 not in REGISTRY`);
  }
  return entry;
}
function interpolate(template, params) {
  return template.replace(PLACEHOLDER_RE, (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new Error(
        `diag(): template placeholder "{${key}}" has no matching params key (params: ${JSON.stringify(params)})`
      );
    }
    return String(params[key]);
  });
}
function diag(code, params, opts) {
  const entry = lookup(code);
  return {
    code,
    severity: opts?.severity ?? entry.defaultSeverity,
    ...opts?.path !== void 0 ? { path: opts.path } : {},
    params,
    message: interpolate(entry.template, params)
  };
}
var REGISTRY, PLACEHOLDER_RE;
var init_registry = __esm({
  "packages/core/diagnostics/registry.ts"() {
    "use strict";
    REGISTRY = Object.freeze({
      // --- FF1xxx: schema/shape (ajv), both pipelines ---
      FF1001: {
        template: "schema violation: {keyword} at {instancePath} (schema: {schemaPath})",
        defaultSeverity: "error",
        explanation: "Generic ajv schema-shape violation. keyword is ajv's own discriminator; per-keyword codes would bloat the registry with no consumer (spec \xA73.2)."
      },
      // --- FF2xxx: provenance/trust (resolveAllowedSources / validateProvenance) ---
      FF2001: {
        template: "malformed URL: {url}",
        defaultSeverity: "error",
        explanation: "p.url (or finalUrl) failed `new URL()` parsing. allowlist-resolver.ts parseHttpsHost."
      },
      FF2002: {
        template: "non-https URL: {url}",
        defaultSeverity: "error",
        explanation: 'URL parsed but protocol !== "https:". allowlist-resolver.ts parseHttpsHost.'
      },
      FF2003: {
        template: "IP-literal host {host} rejected: registrable domain names only",
        defaultSeverity: "error",
        explanation: "Host is a bare IPv4 or bracketed IPv6 literal. allowlist-resolver.ts parseHttpsHost."
      },
      FF2004: {
        template: "punycode (xn--) host {host} rejected outside an explicit Tier-2 ack",
        defaultSeverity: "error",
        explanation: "Host carries an xn-- (IDN/punycode) label and is not explicitly acked. allowlist-resolver.ts punycodeReject."
      },
      FF2005: {
        template: "unknown allowlistKey: {allowlistKey}",
        defaultSeverity: "error",
        explanation: "allowlistKey matched no Tier-0 builtin, no Tier-1 miss reason, and no Tier-2 ack. allowlist-resolver.ts validateUrlAgainstTiers (terminal fallback)."
      },
      FF2006: {
        template: "host {host} not allowed under key {allowlistKey} (expected one of: {expectedHosts})",
        defaultSeverity: "error",
        explanation: "allowlistKey matched a Tier-0 builtin, but the URL host is not in that key's host list. allowlist-resolver.ts validateUrlAgainstTiers (Tier 0 branch)."
      },
      FF2007: {
        template: "host not authorized: `{packageName}` is not a direct dependency",
        defaultSeverity: "error",
        explanation: "Tier-1 direct-dep gate: packageName is not in the consumer's direct dependency set. allowlist-resolver.ts resolveAllowedSources tier1For."
      },
      FF2008: {
        template: "host not authorized: Tier-1 unavailable for `{packageName}` (no ecosystem adapter wired \u2014 S2)",
        defaultSeverity: "error",
        explanation: "No EcosystemAdapter wired on the ResolveCtx (S1 back-compat path, or no ctx at all) \u2014 Tier-1 always misses. allowlist-resolver.ts resolveAllowedSources tier1For."
      },
      FF2009: {
        template: "no Tier-1-eligible host in {packageName} metadata (multi-tenant or non-https)",
        defaultSeverity: "error",
        explanation: "Tier-1 derivation found zero eligible hosts across homepage/repository metadata (multi-tenant apex, non-https, IP-literal, or punycode all fold into this single reason \u2014 DN-D1-2: the resolver emits ONE reason string for all four causes, so ONE code is honest to what is actually emitted). allowlist-resolver.ts resolveAllowedSources tier1For."
      },
      FF2010: {
        template: "cross-package provenance: packageName {packageName} !== entry.package {entryPackage} (T-RTT-A)",
        defaultSeverity: "error",
        explanation: "Tier-1 scope-lock: the provenance packageName does not match the entry's own package. allowlist-resolver.ts validateUrlAgainstTiers (Tier 1 branch)."
      },
      FF2011: {
        template: "host not authorized: not in the Tier-1 host set of `{packageName}`",
        defaultSeverity: "error",
        explanation: "Tier-1 resolved a host set for packageName, but the URL host is not in it. allowlist-resolver.ts validateUrlAgainstTiers (Tier 1 branch)."
      },
      FF2012: {
        template: "ack key {allowlistKey} is scoped to package {scope}",
        defaultSeverity: "error",
        explanation: "Tier-2 ack entry carries a scope that does not match opts.entryPackage. allowlist-resolver.ts validateUrlAgainstTiers (Tier 2 branch)."
      },
      FF2013: {
        template: "host {host} not allowed under ack key {allowlistKey} (acked hosts: {ackedHosts})",
        defaultSeverity: "error",
        explanation: "Tier-2 ack entry exists for allowlistKey, but the URL host is not in its acked hosts. allowlist-resolver.ts validateUrlAgainstTiers (Tier 2 branch)."
      },
      FF2014: {
        template: "{ackFileReason}",
        defaultSeverity: "error",
        explanation: "Ack-file malformed family \u2014 thrown as AckFileError (NEW-2), NOT returned by validateProvenance. Covers: malformed JSON, bad shape, malformed ackedAt date, IP-literal ack host, single-label ack host (#857), duplicate key. allowlist-resolver.ts loadAckFile throw sites."
      },
      FF2015: {
        template: "finalUrl redirect crosses to an unauthorized host: {innerReason}",
        defaultSeverity: "error",
        explanation: "p.finalUrl is present, differs from p.url, and independently fails the same tier resolution. allowlist-resolver.ts validateProvenance (finalUrl redirect check)."
      },
      FF2016: {
        template: "ecosystem mismatch: `{packageName}` requested a different ecosystem than the wired adapter",
        defaultSeverity: "error",
        explanation: 'S4 ecosystem-prefix dispatch (research-source-trust.md \xA74): packageName carries an "<ecosystem>:<bareName>" prefix (or defaults to npm when unprefixed) that does not match ctx.adapter.ecosystem \u2014 fail closed rather than silently retrying under the wrong adapter. allowlist-resolver.ts resolveAllowedSources tier1For.'
      },
      // --- FF3xxx: L4 semantic gates (validator/gate-*.ts) ---
      // One code per failure KIND per gate (DN-D1-4, spec-literal per-gate
      // allocation — 20 codes, not the 16-code shared-astgrep alternative).
      // The astgrep-deferred branch appears in 5 gates; each gets its own code
      // because its message text already diverges per gate (e.g.
      // gate-require-vacuity.ts's wording differs from the other four) and the
      // gate identity is a meaningful discriminator for the `path`/context.
      FF3001: {
        template: "SynthesisPlan schema violation: {details}",
        defaultSeverity: "error",
        explanation: "Gate 1 (schema): plan fails synthesis-plan.schema.json (ajv). gate-schema.ts."
      },
      FF3002: {
        template: "{checkType}-checked rule has no negative-test (required by L4 gate 2 \u2014 rule-tester roundtrip)",
        defaultSeverity: "error",
        explanation: "Gate 1 (schema): an eslint/declarative rule is missing its negative-test. gate-schema.ts."
      },
      FF3003: {
        template: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)",
        defaultSeverity: "error",
        explanation: "Gate 2 (ruleTester): declarative rule declares engine ast-grep, deferred. gate-rule-tester.ts."
      },
      FF3004: {
        template: "eslint rule has no negative-test (gate 1 catches this; gate 2 cannot run without it)",
        defaultSeverity: "error",
        explanation: "Gate 2 (ruleTester): eslint-type rule missing negative-test. gate-rule-tester.ts."
      },
      FF3005: {
        template: "negative-test.input[{idx}] did not produce expected violation '{expectViolation}' for rule '{ruleName}'; got {got}",
        defaultSeverity: "error",
        explanation: "Gate 2 (ruleTester): negative-test input did not fire the expected violation. gate-rule-tester.ts."
      },
      FF3006: {
        template: "examples.good produced unexpected violation: rule='{ruleId}' message='{message}'",
        defaultSeverity: "error",
        explanation: "Gate 2 (ruleTester): examples.good unexpectedly fired the rule. gate-rule-tester.ts."
      },
      FF3007: {
        template: "tautology \u2014 rule '{ruleName}' fires on negative-corpus/{fileName}: {details}",
        defaultSeverity: "error",
        explanation: "Gate 4 (tautology): rule fires on a fixed negative-corpus file. gate-tautology.ts."
      },
      FF3008: {
        template: "references plugin rule '{ruleName}' that does not exist in the preset plugin registry; known: {knownRules}",
        defaultSeverity: "error",
        explanation: "Gate 6 (conflict): plugin rule reference orphan. gate-conflict.ts."
      },
      FF3009: {
        template: "synthesized rule references '{ruleName}' but eslintConfigSnippet has no entry for it (B1 merge may have dropped the rule, or recipe.eslintRuleConfig is empty)",
        defaultSeverity: "error",
        explanation: "Gate 6 (conflict): eslintConfigSnippet is missing an entry for a referenced rule. gate-conflict.ts."
      },
      FF3010: {
        template: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)",
        defaultSeverity: "error",
        explanation: "Gate 7 (singleTokenDiff): declarative rule declares engine ast-grep, deferred. gate-single-token-diff.ts."
      },
      FF3011: {
        template: "single-token-diff: examples.bad and examples.good differ by {distance} tokens (threshold {threshold}) \u2014 pair does not isolate the forbidden construct; reduce to a minimal \u22481 token / 1 AST-node difference",
        defaultSeverity: "error",
        explanation: "Gate 7 (singleTokenDiff): bad/good example pair exceeds MAX_TOKEN_EDITS. gate-single-token-diff.ts."
      },
      FF3012: {
        template: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)",
        defaultSeverity: "error",
        explanation: "Gate 8 (messageIdCoverage): declarative rule declares engine ast-grep with a declared message/messageId, deferred. gate-message-id-coverage.ts."
      },
      FF3013: {
        template: "messageId-coverage: declared check.message '{declaredMessage}' not found in emitted message '{emittedMessage}' \u2014 declared message is unreachable",
        defaultSeverity: "error",
        explanation: "Gate 8 (messageIdCoverage): declared check.message never appears in the actually-emitted message. gate-message-id-coverage.ts."
      },
      FF3014: {
        template: "messageId-coverage: declared check.messageId '{declaredMessageId}' does not match emitted messageId '{emittedMessageId}' \u2014 declared messageId is unreachable",
        defaultSeverity: "error",
        explanation: "Gate 8 (messageIdCoverage): declared check.messageId never matches the actually-emitted messageId. gate-message-id-coverage.ts."
      },
      FF3015: {
        template: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)",
        defaultSeverity: "error",
        explanation: "Gate 9 (autofixClean): declarative rule declares engine ast-grep, deferred. gate-autofix-clean.ts."
      },
      FF3016: {
        template: "autofix-clean: fixer for '{ruleName}' produced unparseable output \u2014 {details}",
        defaultSeverity: "error",
        explanation: "Gate 9 (autofixClean): one-pass fixer output fails to parse. gate-autofix-clean.ts."
      },
      FF3017: {
        template: "autofix-clean: fixer for '{ruleName}' left {count} violation(s) in fixed output \u2014 fix is incomplete or introduces new same-rule violations",
        defaultSeverity: "error",
        explanation: "Gate 9 (autofixClean): fixer output still has same-rule violations after one pass. gate-autofix-clean.ts."
      },
      FF3018: {
        template: "ast-grep engine reserved but not wired for require-vacuity gate \u2014 deferred per generator-require-composite-tier decision",
        defaultSeverity: "error",
        explanation: "requireVacuity gate: declarative require-presence rule declares engine ast-grep, deferred. gate-require-vacuity.ts."
      },
      FF3019: {
        template: "require-vacuity direction A \u2014 selector never fires on examples.bad; rule can never catch violations",
        defaultSeverity: "error",
        explanation: "requireVacuity gate: selector never fires on the bad example (always-green false negative). gate-require-vacuity.ts."
      },
      FF3020: {
        template: "require-vacuity direction B \u2014 selector fires on good example ({count} violation{plural}); rule fires unconditionally",
        defaultSeverity: "error",
        explanation: "requireVacuity gate: selector fires on the good example too (always-red false positive). gate-require-vacuity.ts."
      },
      FF3021: {
        template: "examples.safeForms[{idx}] produced unexpected violation \u2014 selector is broader than its rationale (matches a known-safe form): rule='{ruleId}' message='{message}'",
        defaultSeverity: "error",
        explanation: "Gate 2 (ruleTester): a declared known-safe form of the forbidden construct fired the rule \u2014 over-broad selector (GH #915 obs 4: hasOwnProperty.call / x == null class). gate-rule-tester.ts."
      },
      FF3022: {
        template: "{gate} skipped rule '{ruleName}': the 'rules-as-tests' plugin registry could not be resolved, so the check cannot run. Tried: {tried}",
        defaultSeverity: "warning",
        explanation: "Any plugin-rule gate: neither the consumer barrel (<cwd>/eslint-rules-local/index.mjs) nor the workspace preset packages resolved, so the rule could not be linted. Environmental, not a defect in the plan \u2014 the gate reports `degrade`, never `pass`. validator/preset-plugin-resolver.ts."
      },
      // --- FF6xxx: IR grammar gates (MT umbrella S1 — ir/gates/grammar.ts) ---
      FF6001: {
        template: "degenerate pairedExamples: positive === negative for node {nodeId}",
        defaultSeverity: "error",
        explanation: "IR grammar gate (tautology class): pairedExamples.positive and pairedExamples.negative are byte-identical, so the pair cannot discriminate the convention it claims to test. ir/gates/grammar.ts."
      },
      FF6002: {
        template: "duplicate ConventionNode id {id} ({count} occurrences)",
        defaultSeverity: "error",
        explanation: "IR grammar gate (conflict class): two or more nodes in the set share the same id, breaking id-addressability. ir/gates/grammar.ts."
      },
      FF6003: {
        template: "dangling anchor {anchor} on node {nodeId}: not a REGISTRY code",
        defaultSeverity: "error",
        explanation: "IR grammar gate (coverage/broken-ref class, principle-08 pattern generalized): an anchor in node.anchors does not resolve to a key in the diagnostics REGISTRY. ir/gates/grammar.ts."
      },
      FF6004: {
        template: "degenerate relational tree: {op} composite on node {nodeId} has duplicate children (no discriminating power)",
        defaultSeverity: "error",
        explanation: "IR grammar gate (relational tautology class \u2014 FF6001 analog on the relational plane): a relational composite (all/any/not) carries two or more byte-identical child rules, so the composition adds no discriminating power. The relational tree SHAPE is deep-validated by ajv (FF1001) against the recursive convention-node.schema.json RelationalRule definition; FF6004 is the residual semantic check ajv cannot express (cross-child equality). ir/gates/grammar.ts."
      },
      // --- FF7xxx: render outcomes (MT umbrella S2 — backends/cargo/render-clippy.ts) ---
      FF7001: {
        template: "not expressible in {backend}: selectorClass {selectorClass} (node {nodeId})",
        defaultSeverity: "warning",
        explanation: "Backend render refusal (capability class): the node's selectorClass has no representation in this backend's render target at v0 (e.g. syntax-class or dep-graph-class nodes against the cargo clippy.toml backend). backends/cargo/render-clippy.ts."
      },
      FF7002: {
        template: "params contract violation for {backend} renderer: node {nodeId} missing/invalid {missing}",
        defaultSeverity: "error",
        explanation: "Backend render refusal (params class): node.params does not satisfy the backend's own params contract (e.g. missing kind/path, or kind outside the backend's known set). backends/cargo/render-clippy.ts."
      },
      FF7003: {
        template: "severity {requested} not projected by {backend} at v0 (node {nodeId})",
        defaultSeverity: "note",
        explanation: "Backend render degradation (severity class): the node's defaultSeverity has no projection in this backend's render target at v0 (rendered-with-loss, not dropped \u2014 the content is still emitted). backends/cargo/render-clippy.ts."
      },
      // --- FF8xxx: composition/doc plane (MT umbrella S4 — composition/gates/composition-gate.ts) ---
      FF8001: {
        template: "dangling node reference: id {nodeId} in {where} has no matching ConventionNode",
        defaultSeverity: "error",
        explanation: "Composition gate (broken-ref class): a DocPlan section nodeId or an excluded[] nodeId points at a ConventionNode id that is not in the node set. A plan cannot document a node that does not exist. composition/gates/composition-gate.ts."
      },
      FF8002: {
        template: "node {nodeId} is neither placed in a section nor a valid excluded[] entry ({reason})",
        defaultSeverity: "error",
        explanation: "Composition gate (coverage class, attention-is-not-a-mechanism): a scoped node is silently absent from the doc \u2014 it appears in no section AND has no valid excluded[] opt-out (missing, or reason under 20 chars). Silence about an undocumented node is impossible: it must be documented or explicitly, reasonedly excluded. composition/gates/composition-gate.ts."
      },
      FF8003: {
        template: "composition contradiction for node {nodeId}: {detail}",
        defaultSeverity: "error",
        explanation: "Composition gate (contradiction class): the plan and the render facts disagree \u2014 a node placed in BOTH a section and excluded[], OR a backend segment with no RenderOutcome in the outcomes Map (a doc claiming enforcement a backend never produced). composition/gates/composition-gate.ts."
      },
      FF8004: {
        template: 'matrix incoherence for node {nodeId} backend {backend}: the cell for its selectorClass carries live-fired evidence while its status is "no" (evidence of firing in a cell marked not-applicable)',
        defaultSeverity: "error",
        explanation: `Composition gate (honesty class, T-S4-A / DN-4): the capability-matrix cell for the node's selectorClass is internally incoherent \u2014 status is "no" (the rule does not apply) yet evidence.kind === "live-fired" (it was fired). The two honesty sources contradict. A rendered-not-fired \u{1F7E1} (status "no", no evidence) is spec-legal and is NOT FF8004. composition/gates/composition-gate.ts.`
      }
    });
    PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;
  }
});

// packages/core/diagnostics/ajv.ts
function makeSchemaValidator(schemaDoc4, ref) {
  const ajv = new import_ajv.Ajv({ allErrors: true, strict: false });
  const baseId = ref.split("#")[0];
  const schemaId = typeof schemaDoc4["$id"] === "string" && schemaDoc4["$id"].length > 0 ? schemaDoc4["$id"] : baseId;
  ajv.addSchema(schemaDoc4, schemaId);
  return ajv.compile({ $ref: ref });
}
function errorsText(errors) {
  return errorsTextAjv.errorsText(errors);
}
function ajvErrorsToDiagnostics(errors) {
  if (!errors) return [];
  return errors.map(
    (err) => diag(
      "FF1001",
      {
        keyword: err.keyword,
        instancePath: err.instancePath,
        schemaPath: err.schemaPath
      },
      { path: err.instancePath }
    )
  );
}
var import_ajv, errorsTextAjv;
var init_ajv = __esm({
  "packages/core/diagnostics/ajv.ts"() {
    "use strict";
    import_ajv = __toESM(require_ajv(), 1);
    init_registry();
    errorsTextAjv = new import_ajv.Ajv({ allErrors: true, strict: false });
  }
});

// packages/core/research/internal-validators.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function errorsText2(errors) {
  return errorsText(errors);
}
var HERE, _pkgCore, SCHEMA_PATH, schemaDoc, ACK_SCHEMA_PATH, ackSchemaDoc, validateEntry, validateResearchPlanShape, validateAckFileShape;
var init_internal_validators = __esm({
  "packages/core/research/internal-validators.ts"() {
    "use strict";
    init_ajv();
    HERE = dirname(fileURLToPath(new URL("../research/internal-validators.ts", import.meta.url).href));
    _pkgCore = process.env["AIF_SYNTH_PKG_ROOT"];
    SCHEMA_PATH = _pkgCore ? resolve(_pkgCore, "research", "research-plan.schema.json") : resolve(HERE, "research-plan.schema.json");
    schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    ACK_SCHEMA_PATH = _pkgCore ? resolve(_pkgCore, "research", "research-allowlist.schema.json") : resolve(HERE, "research-allowlist.schema.json");
    ackSchemaDoc = JSON.parse(readFileSync(ACK_SCHEMA_PATH, "utf8"));
    validateEntry = makeSchemaValidator(
      schemaDoc,
      "research-plan#/definitions/ResearchEntry"
    );
    validateResearchPlanShape = makeSchemaValidator(
      schemaDoc,
      "research-plan"
    );
    validateAckFileShape = makeSchemaValidator(
      ackSchemaDoc,
      "research-allowlist"
    );
  }
});

// packages/core/research/allowlist.ts
function validateProvenance2(p) {
  tier0Only ??= resolveAllowedSources();
  const d = validateProvenance(p, tier0Only);
  return d === null ? { ok: true } : { ok: false, reason: d.message };
}
var ALLOWED_SOURCES, tier0Only;
var init_allowlist = __esm({
  "packages/core/research/allowlist.ts"() {
    "use strict";
    init_allowlist_resolver();
    ALLOWED_SOURCES = {
      "next.official": ["nextjs.org", "vercel.com"],
      "react.official": ["react.dev"],
      "react-native.official": ["reactnative.dev"],
      "expo.official": ["expo.dev"],
      "tailwind.official": ["tailwindcss.com"],
      "mdn": ["developer.mozilla.org"],
      "typescript.official": ["typescriptlang.org", "www.typescriptlang.org"],
      // Python Tier-0 hosts (live-generation umbrella, LG-S1 — data change, NOT a resolver-source
      // edit; the #allowlist-as-code-not-data discipline, research-source-trust.md §3, parallel to
      // how react-native/expo were added). Canonical Python-language docs + the PEP index.
      "python.official": ["docs.python.org", "peps.python.org"],
      // PyYAML's own documentation host — the canonical source for the `yaml.load` security guidance
      // (use `safe_load`) that the `getff-no-yaml-load` flagship rule cites. Single-tenant apex.
      "pyyaml": ["pyyaml.org"],
      // Rust Tier-0 hosts (live-generation umbrella, LG-S3 — data change, NOT a resolver-source edit;
      // the #allowlist-as-code-not-data discipline, research-source-trust.md §3, parallel to how the
      // python keys were added by LG-S1). Canonical Rust-language docs + the crate docs host.
      "rust.official": ["doc.rust-lang.org", "docs.rs"],
      // Clippy's own lint documentation host — the canonical source for the `mem_forget` restriction-lint
      // guidance the `mem-forget` flagship rust rule cites (rust-lang.github.io/rust-clippy). Single-tenant
      // GitHub-Pages project apex (rust-lang.github.io is the rust-lang org's Pages host).
      "clippy": ["rust-lang.github.io"]
    };
  }
});

// packages/core/research/ecosystem-name.ts
function parseEcosystemName(name) {
  const idx = name.indexOf(":");
  if (idx === -1) {
    return { ecosystem: "npm", bareName: name };
  }
  const prefix = name.slice(0, idx);
  const rest = name.slice(idx + 1);
  if (KNOWN_ECOSYSTEM_PREFIXES.has(prefix)) {
    return { ecosystem: prefix, bareName: rest };
  }
  return { ecosystem: "unknown", bareName: name };
}
var KNOWN_ECOSYSTEM_PREFIXES;
var init_ecosystem_name = __esm({
  "packages/core/research/ecosystem-name.ts"() {
    "use strict";
    KNOWN_ECOSYSTEM_PREFIXES = /* @__PURE__ */ new Set(["npm", "cargo", "pip", "go"]);
  }
});

// packages/core/research/allowlist-resolver.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname2, join, resolve as resolvePath } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function canonicalizeHost(host) {
  const lower = host.toLowerCase();
  return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}
function isIpLiteral(host) {
  if (host.startsWith("[") && host.endsWith("]")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
function hasPunycodeLabel(host) {
  return host.split(".").some((label) => label.startsWith("xn--"));
}
function hostMatches(host, allowed) {
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}
function loadAckFile(path) {
  let raw;
  try {
    raw = readFileSync2(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return /* @__PURE__ */ new Map();
    throw e;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AckFileError(`malformed JSON in ack file: ${path}`);
  }
  if (!validateAckFileShape(parsed)) {
    throw new AckFileError(errorsText2(validateAckFileShape.errors));
  }
  const doc = parsed;
  const map = /* @__PURE__ */ new Map();
  for (const entry of doc.entries) {
    if (!Number.isFinite(Date.parse(entry.ackedAt))) {
      throw new AckFileError(
        `malformed ackedAt date "${entry.ackedAt}" in entry "${entry.key}"`
      );
    }
    const hosts = entry.hosts.map(canonicalizeHost);
    for (const h of hosts) {
      if (isIpLiteral(h)) {
        throw new AckFileError(
          `IP-literal host "${h}" in entry "${entry.key}" \u2014 registrable domain names only`
        );
      }
      if (!h.includes(".")) {
        throw new AckFileError(
          `single-label host "${h}" in entry "${entry.key}" \u2014 registrable domain names only`
        );
      }
    }
    if (map.has(entry.key)) {
      throw new AckFileError(`duplicate key "${entry.key}" in ack file`);
    }
    map.set(entry.key, { ...entry, hosts });
  }
  return map;
}
function isMultiTenantHost(host) {
  return MULTI_TENANT_HOSTS.some((apex) => host === apex || host.endsWith(`.${apex}`));
}
function resolveAllowedSources(ctx) {
  const tier2 = ctx ? loadAckFile(ctx.ackFilePath ?? join(ctx.root, ".ai-factory", "research-allowlist.json")) : /* @__PURE__ */ new Map();
  return {
    tier0: ALLOWED_SOURCES,
    tier2,
    tier1For(packageName) {
      if (!ctx?.adapter) {
        return {
          ok: false,
          reason: `host not authorized: Tier-1 unavailable for \`${packageName}\` (no ecosystem adapter wired \u2014 S2)`
        };
      }
      const parsed = parseEcosystemName(packageName);
      if (parsed.ecosystem !== ctx.adapter.ecosystem) {
        return {
          ok: false,
          reason: `ecosystem mismatch: \`${packageName}\` requests ecosystem "${parsed.ecosystem}", wired adapter is "${ctx.adapter.ecosystem}"`
        };
      }
      const bareName = parsed.bareName;
      if (!ctx.adapter.listDirectDeps(ctx.root).has(bareName)) {
        return {
          ok: false,
          reason: `host not authorized: \`${packageName}\` is not a direct dependency`
        };
      }
      const meta = ctx.adapter.readInstalledMeta(ctx.root, bareName);
      const candidateFields = [meta?.homepage, meta?.documentation, meta?.repository];
      const hosts = [];
      for (const field of candidateFields) {
        const rawHost = extractHttpsHostFromMeta(field);
        if (rawHost === null) continue;
        const host = canonicalizeHost(rawHost);
        if (isIpLiteral(host)) continue;
        if (!host.includes(".")) continue;
        if (hasPunycodeLabel(host)) continue;
        if (isMultiTenantHost(host)) continue;
        if (!hosts.includes(host)) hosts.push(host);
      }
      if (hosts.length === 0) {
        return {
          ok: false,
          reason: `no Tier-1-eligible host in ${packageName} metadata (multi-tenant or non-https)`
        };
      }
      return { ok: true, hosts };
    }
  };
}
function extractHttpsHostFromMeta(field) {
  if (field === void 0) return null;
  if (typeof field === "object") {
    return extractHttpsHostFromMeta(field.url);
  }
  const stripped = field.startsWith("git+") ? field.slice(4) : field;
  try {
    const url = new URL(stripped);
    if (url.protocol !== "https:") return null;
    return url.hostname;
  } catch {
    return null;
  }
}
function validateUrlAgainstTiers(rawUrl, p, resolved, opts) {
  const builtinHosts = resolved.tier0[p.allowlistKey];
  if (builtinHosts) {
    const parsed = parseHttpsHost(rawUrl);
    if (parsed.diagnostic) return parsed.diagnostic;
    if (hasPunycodeLabel(parsed.host)) return punycodeReject(parsed.host);
    if (hostMatches(parsed.host, builtinHosts)) return null;
    return diag("FF2006", {
      host: parsed.host,
      allowlistKey: p.allowlistKey,
      expectedHosts: builtinHosts.join(", ")
    });
  }
  let tier1Miss;
  const packageName = p.packageName;
  if (packageName !== void 0 && opts?.entryPackage !== void 0) {
    if (packageName !== opts.entryPackage) {
      return diag("FF2010", { packageName, entryPackage: opts.entryPackage });
    }
    const t1 = resolved.tier1For(packageName);
    if (t1.ok) {
      const parsed = parseHttpsHost(rawUrl);
      if (parsed.diagnostic) return parsed.diagnostic;
      if (hasPunycodeLabel(parsed.host)) return punycodeReject(parsed.host);
      if (hostMatches(parsed.host, t1.hosts)) return null;
      tier1Miss = diag("FF2011", { packageName });
    } else {
      tier1Miss = tier1ReasonToDiagnostic(t1.reason, packageName);
    }
  }
  const ack = resolved.tier2.get(p.allowlistKey);
  if (ack) {
    if (ack.scope !== void 0 && opts?.entryPackage !== ack.scope) {
      return diag("FF2012", { allowlistKey: p.allowlistKey, scope: ack.scope });
    }
    const parsed = parseHttpsHost(rawUrl);
    if (parsed.diagnostic) return parsed.diagnostic;
    if (hostMatches(parsed.host, ack.hosts)) {
      if (hasPunycodeLabel(parsed.host)) {
        const explicitlyAcked = ack.hosts.some(
          (a) => hasPunycodeLabel(a) && (parsed.host === a || parsed.host.endsWith(`.${a}`))
        );
        if (!explicitlyAcked) return punycodeReject(parsed.host);
      }
      return null;
    }
    return diag("FF2013", {
      host: parsed.host,
      allowlistKey: p.allowlistKey,
      ackedHosts: ack.hosts.join(", ")
    });
  }
  if (tier1Miss) return tier1Miss;
  return diag("FF2005", { allowlistKey: p.allowlistKey });
}
function tier1ReasonToDiagnostic(reason, packageName) {
  if (reason.includes("no ecosystem adapter wired")) {
    return diag("FF2008", { packageName });
  }
  if (reason.includes("ecosystem mismatch")) {
    return diag("FF2016", { packageName });
  }
  if (reason.includes("is not a direct dependency")) {
    return diag("FF2007", { packageName });
  }
  return diag("FF2009", { packageName });
}
function validateProvenance(p, resolved, opts) {
  const urlResult = validateUrlAgainstTiers(p.url, p, resolved, opts);
  if (urlResult !== null) return urlResult;
  if (p.finalUrl !== void 0 && p.finalUrl !== p.url) {
    const finalResult = validateUrlAgainstTiers(p.finalUrl, p, resolved, opts);
    if (finalResult !== null) {
      return diag("FF2015", { innerReason: finalResult.message });
    }
  }
  return null;
}
function parseHttpsHost(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { diagnostic: diag("FF2001", { url: rawUrl }) };
  }
  if (url.protocol !== "https:") {
    return { diagnostic: diag("FF2002", { url: rawUrl }) };
  }
  const host = canonicalizeHost(url.hostname);
  if (isIpLiteral(host)) {
    return { diagnostic: diag("FF2003", { host }) };
  }
  return { host };
}
function punycodeReject(host) {
  return diag("FF2004", { host });
}
var AckFileError, _here, _pkgCoreForData, MULTI_TENANT_HOSTS_PATH, MULTI_TENANT_HOSTS;
var init_allowlist_resolver = __esm({
  "packages/core/research/allowlist-resolver.ts"() {
    "use strict";
    init_internal_validators();
    init_registry();
    init_allowlist();
    init_ecosystem_name();
    AckFileError = class extends Error {
      name = "AckFileError";
      diagnostics;
      constructor(message) {
        super(message);
        this.diagnostics = [diag("FF2014", { ackFileReason: message })];
      }
    };
    _here = dirname2(fileURLToPath2(new URL("../research/allowlist-resolver.ts", import.meta.url).href));
    _pkgCoreForData = process.env["AIF_SYNTH_PKG_ROOT"];
    MULTI_TENANT_HOSTS_PATH = _pkgCoreForData ? resolvePath(_pkgCoreForData, "research", "multi-tenant-hosts.json") : resolvePath(_here, "multi-tenant-hosts.json");
    MULTI_TENANT_HOSTS = JSON.parse(readFileSync2(MULTI_TENANT_HOSTS_PATH, "utf8")).hosts;
  }
});

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports, module) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports, module) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports, module) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports = module.exports = {};
    var re = exports.re = [];
    var safeRe = exports.safeRe = [];
    var src = exports.src = [];
    var safeSrc = exports.safeSrc = [];
    var t = exports.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports, module) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports, module) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports, module) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var isPrereleaseIdentifier = (prerelease, identifier) => {
      const identifiers = identifier.split(".");
      if (identifiers.length > prerelease.length) {
        return false;
      }
      for (let i = 0; i < identifiers.length; i++) {
        if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
          return false;
        }
      }
      return true;
    };
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (isPrereleaseIdentifier(this.prerelease, identifier)) {
                const prereleaseBase = this.prerelease[identifier.split(".").length];
                if (isNaN(prereleaseBase)) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports, module) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module.exports = coerce;
  }
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS({
  "node_modules/semver/functions/truncate.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var constants = require_constants();
    var SemVer = require_semver();
    var truncate = (version, truncation, options) => {
      if (!constants.RELEASE_TYPES.includes(truncation)) {
        return null;
      }
      const clonedVersion = cloneInputVersion(version, options);
      return clonedVersion && doTruncation(clonedVersion, truncation);
    };
    var cloneInputVersion = (version, options) => {
      const versionStringToParse = version instanceof SemVer ? version.version : version;
      return parse(versionStringToParse, options);
    };
    var doTruncation = (version, truncation) => {
      if (isPrerelease(truncation)) {
        return version.version;
      }
      version.prerelease = [];
      switch (truncation) {
        case "major":
          version.minor = 0;
          version.patch = 0;
          break;
        case "minor":
          version.patch = 0;
          break;
      }
      return version.format();
    };
    var isPrerelease = (type) => {
      return type.startsWith("pre");
    };
    module.exports = truncate;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports, module) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports, module) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        range = range.replace(BUILDSTRIPRE, "");
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      src,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        if (invalidXRangeOrder(M, m, p)) {
          return comp;
        }
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports, module) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    };
    module.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports, module) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !c.test(gt.semver)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !c.test(lt.semver)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports, module) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var truncate = require_truncate();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      truncate,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// packages/core/backends/shared/render-outcome.ts
function assertEveryNodeResolved(nodeIds, outcomes) {
  const missing = nodeIds.filter((id) => !outcomes.has(id));
  if (missing.length > 0) {
    throw new Error(
      `assertEveryNodeResolved(): ${missing.length} node(s) have no RenderOutcome: ${missing.join(", ")}`
    );
  }
  if (outcomes.size !== nodeIds.length) {
    const extra = [...outcomes.keys()].filter((id) => !nodeIds.includes(id));
    throw new Error(
      `assertEveryNodeResolved(): outcomes map has ${extra.length} entr${extra.length === 1 ? "y" : "ies"} not in nodeIds: ${extra.join(", ")}`
    );
  }
}
var init_render_outcome = __esm({
  "packages/core/backends/shared/render-outcome.ts"() {
    "use strict";
  }
});

// packages/core/ir/gates/grammar.ts
import { readFileSync as readFileSync11 } from "node:fs";
import { dirname as dirname3, resolve as resolve8 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
function isNodeShape(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  return typeof v["id"] === "string" && Array.isArray(v["anchors"]) && typeof v["pairedExamples"] === "object" && v["pairedExamples"] !== null;
}
function assertNever2(x) {
  throw new Error(`unexpected relational op: ${JSON.stringify(x)}`);
}
function walkRelational(rule, nodeId, path, diagnostics) {
  switch (rule.op) {
    case "has":
      return;
    // leaf — no children
    case "not":
    case "all":
    case "any": {
      const seen = /* @__PURE__ */ new Set();
      for (const child of rule.children) {
        const key = JSON.stringify(child);
        if (seen.has(key)) {
          diagnostics.push(diag("FF6004", { op: rule.op, nodeId }, { path }));
          break;
        }
        seen.add(key);
      }
      for (const child of rule.children) {
        walkRelational(child, nodeId, path, diagnostics);
      }
      return;
    }
    default:
      return assertNever2(rule);
  }
}
function runGrammarGate(nodes) {
  const diagnostics = [];
  if (!Array.isArray(nodes)) {
    const wrapValidate = makeSchemaValidator(
      { type: "array", items: {} },
      "ConventionNodeArray"
    );
    wrapValidate(nodes);
    diagnostics.push(...ajvErrorsToDiagnostics(wrapValidate.errors));
    return { status: "fail", diagnostics };
  }
  const idCounts = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    if (typeof node === "object" && node !== null && typeof node["id"] === "string") {
      const id = node["id"];
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      diagnostics.push(diag("FF6002", { id, count }));
    }
  }
  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];
    const path = `/nodes/${idx}`;
    const shapeOk = validateNode(node);
    if (!shapeOk) {
      diagnostics.push(
        ...ajvErrorsToDiagnostics(validateNode.errors).map((d) => ({
          ...d,
          path: d.path ? `${path}${d.path}` : path
        }))
      );
      continue;
    }
    if (!isNodeShape(node)) continue;
    const nodeId = node.id;
    if (node.pairedExamples.positive === node.pairedExamples.negative) {
      diagnostics.push(diag("FF6001", { nodeId }, { path }));
    }
    for (const anchor of node.anchors) {
      if (!(anchor in REGISTRY)) {
        diagnostics.push(diag("FF6003", { anchor, nodeId }, { path }));
      }
    }
    if (node.relational !== void 0) {
      walkRelational(node.relational, nodeId, path, diagnostics);
    }
  }
  return { status: diagnostics.length > 0 ? "fail" : "pass", diagnostics };
}
var HERE2, _pkgCore2, SCHEMA_PATH2, schemaDoc2, validateNode;
var init_grammar = __esm({
  "packages/core/ir/gates/grammar.ts"() {
    "use strict";
    init_ajv();
    init_registry();
    init_registry();
    HERE2 = dirname3(fileURLToPath3(new URL("../ir/gates/grammar.ts", import.meta.url).href));
    _pkgCore2 = process.env["AIF_SYNTH_PKG_ROOT"];
    SCHEMA_PATH2 = _pkgCore2 ? resolve8(_pkgCore2, "ir", "convention-node.schema.json") : resolve8(HERE2, "..", "convention-node.schema.json");
    schemaDoc2 = JSON.parse(readFileSync11(SCHEMA_PATH2, "utf8"));
    validateNode = makeSchemaValidator(schemaDoc2, "ConventionNode");
  }
});

// packages/core/synthesizer/tier.ts
function stampProvenanceTier(provenance) {
  return provenance.map((p) => ({
    ...p,
    tier: p.tier ?? (validateProvenance2(p).ok ? 0 : DEFAULT_TIER)
  }));
}
function weakestTier(provenance, stamped) {
  if (stamped !== void 0) return stamped;
  if (provenance.length === 0) return DEFAULT_TIER;
  return Math.max(...provenance.map((p) => p.tier ?? DEFAULT_TIER));
}
var DEFAULT_TIER;
var init_tier = __esm({
  "packages/core/synthesizer/tier.ts"() {
    "use strict";
    init_allowlist();
    DEFAULT_TIER = 2;
  }
});

// packages/core/synthesizer/canonical-rule-hash.ts
import { createHash } from "node:crypto";
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = canonicalize(value[k]);
      return acc;
    }, {});
  }
  return value;
}
function canonicalRuleHash(rule) {
  const identity = { title: rule.title, check: rule.check, examples: rule.examples };
  const json = JSON.stringify(canonicalize(identity));
  return createHash("sha256").update(json).digest("hex");
}
var init_canonical_rule_hash = __esm({
  "packages/core/synthesizer/canonical-rule-hash.ts"() {
    "use strict";
  }
});

// packages/core/synthesizer/emit.ts
import { existsSync as existsSync12, mkdirSync as mkdirSync2, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { resolve as resolve10 } from "node:path";
function emit2(plan, outputDir) {
  const dir = resolve10(outputDir);
  if (!existsSync12(dir)) {
    throw new EmitError(dir, "output directory does not exist");
  }
  if (!statSync2(dir).isDirectory()) {
    throw new EmitError(dir, "output path is not a directory");
  }
  const manifestAdditions = {};
  for (const rule of plan.rules) {
    const { id, research, ...manifestShape } = rule;
    manifestAdditions[id] = { ...manifestShape, research };
  }
  writeFileSync2(
    resolve10(dir, "rules-manifest-additions.json"),
    JSON.stringify(manifestAdditions, null, 2) + "\n"
  );
  writeFileSync2(
    resolve10(dir, "RULES-additions.md"),
    plan.rulesMd ? `# Synthesized rules

${plan.rulesMd}` : "# Synthesized rules\n\n(no rules)\n"
  );
  writeFileSync2(
    resolve10(dir, "eslint-rules-snippet.json"),
    plan.eslintConfigSnippet + "\n"
  );
  const provenanceRules = {};
  for (const rule of plan.rules) {
    provenanceRules[rule.id] = {
      source: {
        entryId: rule.research.entryId,
        provenance: rule.research.provenance
      },
      contentHash: canonicalRuleHash(rule)
    };
  }
  writeFileSync2(
    resolve10(dir, "provenance.json"),
    JSON.stringify(
      {
        generatedBy: "rules-as-tests-synth",
        note: "GENERATED \u2014 do not edit emitted rule files by hand; regenerate via the synthesizer. S5 enforces this mechanically.",
        rules: provenanceRules
      },
      null,
      2
    ) + "\n"
  );
  const ctxRules = plan.rules.map((r) => ({
    id: r.id,
    provenance: r.research.provenance,
    tier: weakestTier(r.research.provenance, r.research.tier)
  }));
  writeFileSync2(
    resolve10(dir, "generation-context.json"),
    JSON.stringify({ version: plan.version, rules: ctxRules }, null, 2) + "\n"
  );
  const fragDir = resolve10(dir, "generation-context");
  mkdirSync2(fragDir, { recursive: true });
  for (const r of ctxRules) {
    writeFileSync2(
      resolve10(fragDir, `${r.id}.json`),
      JSON.stringify(r) + "\n"
    );
  }
}
var EmitError;
var init_emit = __esm({
  "packages/core/synthesizer/emit.ts"() {
    "use strict";
    init_canonical_rule_hash();
    init_tier();
    EmitError = class extends Error {
      constructor(path, reason) {
        super(`Cannot emit synthesis plan to ${path}: ${reason}`);
        this.path = path;
        this.name = "EmitError";
      }
      path;
    };
  }
});

// getff-from-project:eslint
var require_eslint = __commonJS({
  "getff-from-project:eslint"(exports, module) {
    var { createRequire: createRequire2 } = __require("node:module");
    var { join: join10 } = __require("node:path");
    var id = "eslint";
    var via = null;
    function missing(e) {
      return e && e.code === "MODULE_NOT_FOUND";
    }
    function load() {
      var fromProject = createRequire2(join10(process.cwd(), "package.json"));
      try {
        return fromProject(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      if (via) {
        try {
          return createRequire2(fromProject.resolve(via + "/package.json"))(id);
        } catch (e) {
          if (!missing(e)) throw e;
        }
      }
      try {
        return __require(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      throw new Error("getff: '" + id + "' is not installed in " + process.cwd() + " \u2014 getff's rule generator uses the project's own ESLint. Install it (npm install --save-dev eslint typescript-eslint) and re-run.");
    }
    module.exports = load();
  }
});

// getff-from-project:@typescript-eslint/parser
var require_parser = __commonJS({
  "getff-from-project:@typescript-eslint/parser"(exports, module) {
    var { createRequire: createRequire2 } = __require("node:module");
    var { join: join10 } = __require("node:path");
    var id = "@typescript-eslint/parser";
    var via = "typescript-eslint";
    function missing(e) {
      return e && e.code === "MODULE_NOT_FOUND";
    }
    function load() {
      var fromProject = createRequire2(join10(process.cwd(), "package.json"));
      try {
        return fromProject(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      if (via) {
        try {
          return createRequire2(fromProject.resolve(via + "/package.json"))(id);
        } catch (e) {
          if (!missing(e)) throw e;
        }
      }
      try {
        return __require(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      throw new Error("getff: '" + id + "' is not installed in " + process.cwd() + " \u2014 getff's rule generator uses the project's own ESLint. Install it (npm install --save-dev eslint typescript-eslint) and re-run.");
    }
    module.exports = load();
  }
});

// getff-from-project:@typescript-eslint/utils
var require_utils2 = __commonJS({
  "getff-from-project:@typescript-eslint/utils"(exports, module) {
    var { createRequire: createRequire2 } = __require("node:module");
    var { join: join10 } = __require("node:path");
    var id = "@typescript-eslint/utils";
    var via = "typescript-eslint";
    function missing(e) {
      return e && e.code === "MODULE_NOT_FOUND";
    }
    function load() {
      var fromProject = createRequire2(join10(process.cwd(), "package.json"));
      try {
        return fromProject(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      if (via) {
        try {
          return createRequire2(fromProject.resolve(via + "/package.json"))(id);
        } catch (e) {
          if (!missing(e)) throw e;
        }
      }
      try {
        return __require(id);
      } catch (e) {
        if (!missing(e)) throw e;
      }
      throw new Error("getff: '" + id + "' is not installed in " + process.cwd() + " \u2014 getff's rule generator uses the project's own ESLint. Install it (npm install --save-dev eslint typescript-eslint) and re-run.");
    }
    module.exports = load();
  }
});

// packages/core/eslint-rules/no-unsafe-zod-parse.ts
function isZodChain(node) {
  if (node.type === "CallExpression") return isZodChain(node.callee);
  if (node.type === "MemberExpression") {
    if (node.object.type === "Identifier" && node.object.name === "z")
      return true;
    return isZodChain(node.object);
  }
  return false;
}
function isZodishReceiver(receiver, scope) {
  if (isZodChain(receiver)) return true;
  if (receiver.type !== "Identifier") return false;
  const name = receiver.name;
  if (name.endsWith("Schema")) return true;
  let s = scope;
  while (s) {
    const variable = s.set.get(name);
    if (variable) {
      for (const def of variable.defs) {
        if (def.type === "ImportBinding" && def.parent?.source.value === "zod")
          return true;
        if (def.type === "Variable") {
          const init = def.node.init;
          if (init && isZodChain(init)) return true;
        }
      }
      break;
    }
    s = s.upper;
  }
  return false;
}
function isStaticLiteral(node) {
  switch (node.type) {
    case "Literal":
      return true;
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "UnaryExpression":
      return isStaticLiteral(node.argument);
    case "ObjectExpression":
      return node.properties.every(
        (p) => p.type === "Property" && !p.computed && (p.key.type === "Identifier" || p.key.type === "Literal") && isStaticLiteral(p.value)
      );
    case "ArrayExpression":
      return node.elements.every(
        (el) => el !== null && el.type !== "SpreadElement" && isStaticLiteral(el)
      );
    case "TSAsExpression":
    // { ... } as const
    case "TSSatisfiesExpression":
      return isStaticLiteral(node.expression);
    default:
      return false;
  }
}
var import_utils, createRule, noUnsafeZodParse;
var init_no_unsafe_zod_parse = __esm({
  "packages/core/eslint-rules/no-unsafe-zod-parse.ts"() {
    "use strict";
    import_utils = __toESM(require_utils2(), 1);
    createRule = import_utils.ESLintUtils.RuleCreator(
      () => `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r2--validation-at-boundaries`
    );
    noUnsafeZodParse = createRule({
      name: "no-unsafe-zod-parse",
      meta: {
        type: "problem",
        docs: {
          description: "Forbid Zod schema `.parse()` in HTTP boundary files; require `.safeParse()`. Stdlib `.parse()` (JSON, Date, path) and fully-static literal arguments (fail-fast config parses) are not flagged."
        },
        messages: {
          useSafeParse: "Use `.safeParse()` instead of `.parse()` in HTTP boundaries \u2014 `.parse()` throws and bypasses structured error handling (R2)."
        },
        schema: []
      },
      defaultOptions: [],
      create(context) {
        const sourceCode = context.sourceCode;
        return {
          "CallExpression[callee.type='MemberExpression'][callee.property.name='parse']"(node) {
            const line = node.loc.start.line;
            const lines = sourceCode.lines;
            const currentLine = lines[line - 1] ?? "";
            if (currentLine.includes("// audit:exempt")) return;
            const callee = node.callee;
            if (!isZodishReceiver(callee.object, sourceCode.getScope(node))) return;
            const firstArg = node.arguments[0];
            if (firstArg && firstArg.type !== "SpreadElement" && isStaticLiteral(firstArg))
              return;
            context.report({ node, messageId: "useSafeParse" });
          }
        };
      }
    });
  }
});

// packages/core/eslint-rules/no-direct-time-randomness.ts
function isExempt(line) {
  return line.includes("// audit:exempt");
}
var import_utils2, createRule2, FORBIDDEN_MODULES, noDirectTimeRandomness;
var init_no_direct_time_randomness = __esm({
  "packages/core/eslint-rules/no-direct-time-randomness.ts"() {
    "use strict";
    import_utils2 = __toESM(require_utils2(), 1);
    createRule2 = import_utils2.ESLintUtils.RuleCreator(
      () => `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r7--time-randomness-io`
    );
    FORBIDDEN_MODULES = /* @__PURE__ */ new Set([
      "fs",
      "http",
      "https",
      "node:fs",
      "node:http",
      "node:https"
    ]);
    noDirectTimeRandomness = createRule2({
      name: "no-direct-time-randomness",
      meta: {
        type: "problem",
        docs: {
          description: "Forbid Date.now(), new Date(), Math.random(), and direct fs/http/https imports outside infrastructure (R7)."
        },
        messages: {
          noDateNow: "Use an injected Clock instead of `Date.now()` (R7).",
          noNewDate: "Use an injected Clock instead of `new Date()` (R7).",
          noMathRandom: "Use an injected Random source instead of `Math.random()` (R7).",
          noDirectIO: "Direct `{{module}}` import is forbidden outside `infrastructure/` (R7). Wrap it in an infrastructure module."
        },
        schema: []
      },
      defaultOptions: [],
      create(context) {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;
        const lineExempt = (n) => isExempt(lines[n - 1] ?? "");
        return {
          "CallExpression[callee.type='MemberExpression'][callee.object.name='Date'][callee.property.name='now']"(node) {
            if (lineExempt(node.loc.start.line)) return;
            context.report({ node, messageId: "noDateNow" });
          },
          "CallExpression[callee.type='MemberExpression'][callee.object.name='Math'][callee.property.name='random']"(node) {
            if (lineExempt(node.loc.start.line)) return;
            context.report({ node, messageId: "noMathRandom" });
          },
          "NewExpression[callee.name='Date']"(node) {
            if (lineExempt(node.loc.start.line)) return;
            context.report({ node, messageId: "noNewDate" });
          },
          ImportDeclaration(node) {
            if (typeof node.source.value !== "string") return;
            if (!FORBIDDEN_MODULES.has(node.source.value)) return;
            if (lineExempt(node.loc.start.line)) return;
            context.report({
              node,
              messageId: "noDirectIO",
              data: { module: node.source.value }
            });
          }
        };
      }
    });
  }
});

// packages/core/eslint-rules/require-otel-span.ts
function functionHasSpan(body) {
  if (!body) return false;
  const stack = [body];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.type === import_utils4.AST_NODE_TYPES.CallExpression && node.callee.type === import_utils4.AST_NODE_TYPES.MemberExpression && node.callee.property.type === import_utils4.AST_NODE_TYPES.Identifier && node.callee.property.name === "startActiveSpan") {
      return true;
    }
    if (node.type === import_utils4.AST_NODE_TYPES.CallExpression && node.callee.type === import_utils4.AST_NODE_TYPES.Identifier && node.callee.name === "withSpan") {
      return true;
    }
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (!value || typeof value !== "object") continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object" && "type" in child) {
            stack.push(child);
          }
        }
      } else if ("type" in value) {
        stack.push(value);
      }
    }
  }
  return false;
}
var import_utils3, import_utils4, createRule3, SKIP_KEYS, requireOtelSpan;
var init_require_otel_span = __esm({
  "packages/core/eslint-rules/require-otel-span.ts"() {
    "use strict";
    import_utils3 = __toESM(require_utils2(), 1);
    import_utils4 = __toESM(require_utils2(), 1);
    createRule3 = import_utils3.ESLintUtils.RuleCreator(
      () => `https://github.com/artyhoo/getff/blob/main/packages/preset-next-15-canonical/RULES.md#r8--observability`
    );
    SKIP_KEYS = /* @__PURE__ */ new Set(["parent", "loc", "range", "tokens", "comments"]);
    requireOtelSpan = createRule3({
      name: "require-otel-span",
      meta: {
        type: "problem",
        docs: {
          description: "Exported async functions must open an OTel span (tracer.startActiveSpan or withSpan) \u2014 R8."
        },
        messages: {
          missingSpan: 'Exported async function "{{name}}" must open an OTel span (tracer.startActiveSpan / withSpan) \u2014 R8.'
        },
        schema: []
      },
      defaultOptions: [],
      create(context) {
        function checkFn(node, name) {
          if (!node.async) return;
          const body = node.body.type === import_utils4.AST_NODE_TYPES.BlockStatement ? node.body : void 0;
          if (functionHasSpan(body)) return;
          context.report({
            node,
            messageId: "missingSpan",
            data: { name }
          });
        }
        return {
          // export async function foo() {}
          "ExportNamedDeclaration > FunctionDeclaration"(node) {
            if (!node.id) return;
            checkFn(node, node.id.name);
          },
          // export const foo = async () => {} / async function() {}
          "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator"(node) {
            if (node.id.type !== import_utils4.AST_NODE_TYPES.Identifier || !node.init) return;
            if (node.init.type === import_utils4.AST_NODE_TYPES.ArrowFunctionExpression || node.init.type === import_utils4.AST_NODE_TYPES.FunctionExpression) {
              checkFn(node.init, node.id.name);
            }
          }
        };
      }
    });
  }
});

// packages/core/eslint-rules/restricted-syntax-audit-exempt.ts
var import_utils5, createRule4, EXEMPT_TOKEN, restrictedSyntaxAuditExempt;
var init_restricted_syntax_audit_exempt = __esm({
  "packages/core/eslint-rules/restricted-syntax-audit-exempt.ts"() {
    "use strict";
    import_utils5 = __toESM(require_utils2(), 1);
    createRule4 = import_utils5.ESLintUtils.RuleCreator(
      () => `https://github.com/artyhoo/getff/blob/main/packages/core/eslint-rules/restricted-syntax-audit-exempt.ts`
    );
    EXEMPT_TOKEN = "audit:exempt";
    restrictedSyntaxAuditExempt = createRule4({
      name: "restricted-syntax-audit-exempt",
      meta: {
        type: "problem",
        docs: {
          description: "Disallow syntax matching the given selector(s), honouring per-line `audit:exempt` suppression (exempt-aware no-restricted-syntax)."
        },
        messages: {
          restrictedSyntax: "{{message}}"
        },
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              selector: { type: "string", minLength: 1 },
              message: { type: "string" }
            },
            required: ["selector"],
            additionalProperties: false
          }
        }
      },
      defaultOptions: [],
      create(context) {
        const lines = context.sourceCode.lines;
        const listeners = {};
        for (const entry of context.options) {
          const { selector } = entry;
          const message = entry.message ?? `Using '${selector}' is restricted (audit:exempt to override).`;
          const handler = (node) => {
            const line = lines[node.loc.start.line - 1] ?? "";
            if (line.includes(EXEMPT_TOKEN)) return;
            context.report({
              node,
              messageId: "restrictedSyntax",
              data: { message }
            });
          };
          const prev = listeners[selector];
          listeners[selector] = prev ? (node) => {
            prev(node);
            handler(node);
          } : handler;
        }
        return listeners;
      }
    });
  }
});

// packages/core/eslint-rules/index.ts
var plugin, eslint_rules_default, rules;
var init_eslint_rules = __esm({
  "packages/core/eslint-rules/index.ts"() {
    "use strict";
    init_no_unsafe_zod_parse();
    init_no_direct_time_randomness();
    init_require_otel_span();
    init_restricted_syntax_audit_exempt();
    plugin = {
      meta: {
        name: "@rules-as-tests/core-eslint-rules",
        version: "0.1.0"
      },
      rules: {
        "no-unsafe-zod-parse": noUnsafeZodParse,
        "no-direct-time-randomness": noDirectTimeRandomness,
        "require-otel-span": requireOtelSpan,
        "restricted-syntax-audit-exempt": restrictedSyntaxAuditExempt
      }
    };
    eslint_rules_default = plugin;
    rules = plugin.rules;
  }
});

// packages/core/validator/preset-plugin-resolver.ts
import { createRequire } from "node:module";
import { resolve as resolve11 } from "node:path";
function rulesOf(mod) {
  const ns = mod;
  const rules2 = ns?.default?.rules ?? ns?.rules;
  if (!rules2 || typeof rules2 !== "object") return null;
  return rules2;
}
function reasonOf(err) {
  const e = err;
  const code = e?.code ? `${e.code}: ` : "";
  return `${code}${(e?.message ?? String(err)).split("\n")[0]}`;
}
function resolvePluginRegistry(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const workspaceSpecifiers = opts.workspaceSpecifiers ?? WORKSPACE_PRESET_SPECIFIERS;
  const coreRules = { ...eslint_rules_default.rules };
  const skipped = [];
  const barrelLabel = `${CONSUMER_BARREL_SPECIFIER} (from ${cwd})`;
  try {
    const requireFromCwd = createRequire(resolve11(cwd, "package.json"));
    const barrel = requireFromCwd(
      requireFromCwd.resolve(CONSUMER_BARREL_SPECIFIER)
    );
    const rules2 = rulesOf(barrel);
    if (!rules2) throw new Error("barrel exports no `rules` map");
    return {
      rules: { ...coreRules, ...rules2 },
      source: "consumer-barrel",
      resolvedFrom: [barrelLabel],
      skipped,
      presetsResolved: true
    };
  } catch (err) {
    skipped.push({ specifier: barrelLabel, reason: reasonOf(err) });
  }
  const requireFromHere = createRequire(new URL("../validator/preset-plugin-resolver.ts", import.meta.url).href);
  const resolvedFrom = [];
  let presetRules = {};
  for (const specifier of workspaceSpecifiers) {
    try {
      const rules2 = rulesOf(requireFromHere(specifier));
      if (!rules2) throw new Error("package exports no `rules` map");
      presetRules = { ...presetRules, ...rules2 };
      resolvedFrom.push(specifier);
    } catch (err) {
      skipped.push({ specifier, reason: reasonOf(err) });
    }
  }
  if (resolvedFrom.length > 0) {
    return {
      rules: { ...coreRules, ...presetRules },
      source: "workspace-presets",
      resolvedFrom,
      skipped,
      presetsResolved: true
    };
  }
  return {
    rules: coreRules,
    source: "core-only",
    resolvedFrom,
    skipped,
    presetsResolved: false
  };
}
function knownPlugins(registry) {
  return { "rules-as-tests": { rules: registry.rules } };
}
function isUnresolvablePluginRule(ruleName, registry) {
  if (registry.presetsResolved) return false;
  if (!ruleName.startsWith(PRESET_PREFIX)) return false;
  return !(ruleName.slice(PRESET_PREFIX.length) in registry.rules);
}
function degradeFor(gate, ruleName, registry, ruleId) {
  const tried = registry.skipped.map((s) => `${s.specifier} \u2014 ${s.reason}`).join("; ");
  return {
    ruleId,
    code: "FF3022",
    reason: `${gate} skipped rule '${ruleName}': the 'rules-as-tests' plugin registry could not be resolved, so the check cannot run. Tried: ${tried}. Install the framework into the project (which vendors eslint-rules-local/) or run the gate from the framework workspace.`
  };
}
function gateOutcome(failures, degraded) {
  if (failures.length > 0) {
    return degraded.length > 0 ? { status: "fail", failures, degraded } : { status: "fail", failures };
  }
  if (degraded.length > 0) return { status: "degrade", failures: [], degraded };
  return { status: "pass", failures: [] };
}
var PRESET_PREFIX, CONSUMER_BARREL_SPECIFIER, WORKSPACE_PRESET_SPECIFIERS;
var init_preset_plugin_resolver = __esm({
  "packages/core/validator/preset-plugin-resolver.ts"() {
    "use strict";
    init_eslint_rules();
    PRESET_PREFIX = "rules-as-tests/";
    CONSUMER_BARREL_SPECIFIER = "./eslint-rules-local/index.mjs";
    WORKSPACE_PRESET_SPECIFIERS = [
      "@rules-as-tests/preset-next-15-canonical/eslint-rules",
      "@rules-as-tests/preset-react-spa/eslint-rules"
    ];
  }
});

// packages/core/synthesizer/compile-declarative-md.ts
function declarativeRestrictedConfigEntry(check) {
  const entry = { selector: check.selector };
  if (check.message) entry.message = check.message;
  return ["error", entry];
}
function extractDeclarativeRuleConfigFromSnippet(parsedSnippet, selector) {
  const merged = parsedSnippet[ESLINT_RESTRICTED_RULE_NAME];
  if (!Array.isArray(merged)) return null;
  const [, ...entries] = merged;
  const match = entries.find(
    (e) => typeof e === "object" && e !== null && e.selector === selector
  );
  return match ? ["error", match] : null;
}
function resolveEngine(rule) {
  if (rule.check.type !== "declarative") {
    throw new Error(
      `resolveEngine called on non-declarative rule ${rule.id} (check.type=${rule.check.type})`
    );
  }
  const engineName = rule.check.engine ?? "eslint-restricted";
  const presenceLabel = rule.check.presence === "require" ? "require" : "forbid";
  switch (engineName) {
    case "eslint-restricted":
      return {
        runner: "no-restricted-syntax",
        checkLine: `declarative \`no-restricted-syntax\` ${presenceLabel} (eslint-restricted engine)`
      };
    case "ast-grep":
      return {
        runner: "ast-grep",
        checkLine: `declarative ast-grep ${presenceLabel} (ast-grep engine)`
      };
    // G3b: codegen engine slots here
    default:
      throw new Error(`Unsupported engine: ${engineName}`);
  }
}
function compileDeclarativeMd(rule) {
  if (rule.check.type !== "declarative") {
    throw new Error(
      `compileDeclarativeMd called on non-declarative rule ${rule.id} (check.type=${rule.check.type})`
    );
  }
  const { selector, message } = rule.check;
  const { runner, checkLine } = resolveEngine(rule);
  const why = message ?? (rule.check.presence === "require" ? "required construct" : "forbidden construct");
  return [
    `## ${rule.id} \u2014 ${rule.title}`,
    "",
    `**Stack:** ${rule.stack.join(", ")}  `,
    `**Check:** ${checkLine}  `,
    `**Selector:** \`${selector}\`  `,
    `**Why:** ${why}`,
    ""
  ].join("\n");
}
var ESLINT_RESTRICTED_RULE_NAME;
var init_compile_declarative_md = __esm({
  "packages/core/synthesizer/compile-declarative-md.ts"() {
    "use strict";
    ESLINT_RESTRICTED_RULE_NAME = "rules-as-tests/restricted-syntax-audit-exempt";
  }
});

// packages/core/validator/gate-autofix-clean.ts
function buildSingleRuleConfig(ruleName, ruleConfig, registry) {
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      plugins: knownPlugins(registry),
      rules: { [ruleName]: ruleConfig }
    }
  ];
}
function applyOnePatchPass(code, messages, ruleName) {
  const fixes = messages.filter(
    (m) => m.ruleId === ruleName && m.fix != null
  ).map((m) => m.fix).sort((a, b) => a.range[0] - b.range[0]);
  if (fixes.length === 0) return null;
  let result = "";
  let lastIndex = 0;
  for (const fix of fixes) {
    if (fix.range[0] < lastIndex) continue;
    result += code.slice(lastIndex, fix.range[0]);
    result += fix.text;
    lastIndex = fix.range[1];
  }
  result += code.slice(lastIndex);
  return result;
}
function checkRule(rule, parsedSnippet, registry, degraded) {
  if (rule.check.type !== "eslint" && rule.check.type !== "declarative") {
    return { hadFixer: false };
  }
  if (rule.check.type === "declarative" && rule.check.engine === "ast-grep") {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: "FF3015",
          reason: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)"
        }
      ]
    };
  }
  const ruleName = rule.check.type === "eslint" ? rule.check.rule : ESLINT_RESTRICTED_RULE_NAME;
  if (isUnresolvablePluginRule(ruleName, registry)) {
    degraded.push(degradeFor("autofixClean", ruleName, registry, rule.id));
    return { hadFixer: false };
  }
  const ruleConfig = rule.check.type === "declarative" ? extractDeclarativeRuleConfigFromSnippet(
    parsedSnippet,
    rule.check.selector
  ) ?? declarativeRestrictedConfigEntry(rule.check) : parsedSnippet[ruleName] ?? "error";
  const config = buildSingleRuleConfig(ruleName, ruleConfig, registry);
  const linter = new import_eslint.Linter();
  const messages = linter.verify(rule.examples.bad, config, {
    filename: "bad-example.tsx"
  });
  const fixedCode = applyOnePatchPass(rule.examples.bad, messages, ruleName);
  if (fixedCode === null) {
    return { hadFixer: false };
  }
  const parseMessages = linter.verify(fixedCode, PARSE_ONLY_CONFIG, {
    filename: "fixed.tsx"
  });
  const parseErrors = parseMessages.filter((m) => m.fatal);
  if (parseErrors.length > 0) {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: "FF3016",
          reason: `autofix-clean: fixer for '${ruleName}' produced unparseable output \u2014 ${parseErrors.map((m) => m.message).join("; ")}`
        }
      ]
    };
  }
  const fixedMessages = linter.verify(fixedCode, config, {
    filename: "fixed.tsx"
  });
  const remainingViolations = fixedMessages.filter(
    (m) => m.ruleId === ruleName
  );
  if (remainingViolations.length > 0) {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: "FF3017",
          reason: `autofix-clean: fixer for '${ruleName}' left ${remainingViolations.length} violation(s) in fixed output \u2014 fix is incomplete or introduces new same-rule violations`
        }
      ]
    };
  }
  return { hadFixer: true, failures: [] };
}
function runAutofixCleanGate(plan, opts) {
  const applicableRules = plan.rules.filter(
    (r) => r.check.type === "eslint" || r.check.type === "declarative"
  );
  if (applicableRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet);
  const registry = resolvePluginRegistry(opts);
  let anyHadFixer = false;
  const failures = [];
  const degraded = [];
  for (const rule of applicableRules) {
    const result = checkRule(rule, parsedSnippet, registry, degraded);
    if (result.hadFixer) {
      anyHadFixer = true;
      failures.push(...result.failures);
    }
  }
  if (!anyHadFixer && failures.length === 0 && degraded.length === 0) {
    return { status: "n/a", failures: [] };
  }
  return gateOutcome(failures, degraded);
}
var import_eslint, tseslintParser, PARSE_ONLY_CONFIG;
var init_gate_autofix_clean = __esm({
  "packages/core/validator/gate-autofix-clean.ts"() {
    "use strict";
    import_eslint = __toESM(require_eslint(), 1);
    tseslintParser = __toESM(require_parser(), 1);
    init_preset_plugin_resolver();
    init_compile_declarative_md();
    PARSE_ONLY_CONFIG = [
      {
        files: ["**/*.{ts,tsx,js,jsx}"],
        languageOptions: {
          parser: tseslintParser,
          parserOptions: {
            ecmaFeatures: { jsx: true },
            ecmaVersion: "latest",
            sourceType: "module"
          }
        }
      }
    ];
  }
});

// packages/core/validator/gate-conflict.ts
function runConflictGate(plan, opts) {
  const failures = [];
  const degraded = [];
  const registry = resolvePluginRegistry(opts);
  const presetRules = new Set(Object.keys(registry.rules));
  const snippet = JSON.parse(plan.eslintConfigSnippet);
  const checkRuleToSyntId = /* @__PURE__ */ new Map();
  for (const rule of plan.rules) {
    if (rule.check.type !== "eslint") continue;
    const ruleName = rule.check.rule;
    if (isUnresolvablePluginRule(ruleName, registry)) {
      degraded.push(degradeFor("conflict", ruleName, registry, rule.id));
    } else if (ruleName.startsWith(PRESET_PREFIX)) {
      const bareName = ruleName.slice(PRESET_PREFIX.length);
      if (!presetRules.has(bareName)) {
        failures.push({
          ruleId: rule.id,
          code: "FF3008",
          reason: `references plugin rule '${ruleName}' that does not exist in the preset plugin registry; known: ${Array.from(presetRules).map((n) => PRESET_PREFIX + n).join(", ")}`
        });
      }
    }
    if (!(ruleName in snippet)) {
      failures.push({
        ruleId: rule.id,
        code: "FF3009",
        reason: `synthesized rule references '${ruleName}' but eslintConfigSnippet has no entry for it (B1 merge may have dropped the rule, or recipe.eslintRuleConfig is empty)`
      });
    }
    if (!checkRuleToSyntId.has(ruleName)) {
      checkRuleToSyntId.set(ruleName, rule.id);
    }
  }
  return gateOutcome(failures, degraded);
}
var init_gate_conflict = __esm({
  "packages/core/validator/gate-conflict.ts"() {
    "use strict";
    init_preset_plugin_resolver();
  }
});

// packages/core/validator/gate-message-id-coverage.ts
function buildSingleRuleConfig2(ruleName, ruleConfig, registry) {
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: tseslintParser2,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      plugins: knownPlugins(registry),
      rules: { [ruleName]: ruleConfig }
    }
  ];
}
function checkRule2(rule, parsedSnippet, registry) {
  if (rule.check.type !== "declarative") return [];
  if (rule.check.engine === "ast-grep") {
    if (!rule.check.message && !rule.check.messageId) return [];
    return [
      {
        ruleId: rule.id,
        code: "FF3012",
        reason: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)"
      }
    ];
  }
  const declaredMessage = rule.check.message;
  const declaredMessageId = rule.check.messageId;
  if (!declaredMessage && !declaredMessageId) {
    return [];
  }
  const ruleName = ESLINT_RESTRICTED_RULE_NAME;
  const ruleConfig = extractDeclarativeRuleConfigFromSnippet(
    parsedSnippet,
    rule.check.selector
  );
  if (!ruleConfig) {
    return [];
  }
  const config = buildSingleRuleConfig2(ruleName, ruleConfig, registry);
  const linter = new import_eslint2.Linter();
  const messages = linter.verify(rule.examples.bad, config, {
    filename: "bad-example.tsx"
  });
  const violation = messages.find((m) => m.ruleId === ruleName);
  if (!violation) {
    return [];
  }
  if (declaredMessage && !violation.message.includes(declaredMessage)) {
    return [
      {
        ruleId: rule.id,
        code: "FF3013",
        reason: `messageId-coverage: declared check.message '${declaredMessage}' not found in emitted message '${violation.message}' \u2014 declared message is unreachable`
      }
    ];
  }
  if (declaredMessageId && violation.messageId !== declaredMessageId) {
    return [
      {
        ruleId: rule.id,
        code: "FF3014",
        reason: `messageId-coverage: declared check.messageId '${declaredMessageId}' does not match emitted messageId '${String(violation.messageId)}' \u2014 declared messageId is unreachable`
      }
    ];
  }
  return [];
}
function runMessageIdCoverageGate(plan, opts) {
  const declarativeRules = plan.rules.filter(
    (r) => r.check.type === "declarative"
  );
  if (declarativeRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const hasApplicableRule = declarativeRules.some(
    (r) => r.check.type === "declarative" && (r.check.message || r.check.messageId)
  );
  if (!hasApplicableRule) {
    return { status: "n/a", failures: [] };
  }
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet);
  const registry = resolvePluginRegistry(opts);
  const failures = [];
  for (const rule of declarativeRules) {
    failures.push(...checkRule2(rule, parsedSnippet, registry));
  }
  return failures.length === 0 ? { status: "pass", failures: [] } : { status: "fail", failures };
}
var import_eslint2, tseslintParser2;
var init_gate_message_id_coverage = __esm({
  "packages/core/validator/gate-message-id-coverage.ts"() {
    "use strict";
    import_eslint2 = __toESM(require_eslint(), 1);
    tseslintParser2 = __toESM(require_parser(), 1);
    init_preset_plugin_resolver();
    init_compile_declarative_md();
  }
});

// packages/core/validator/gate-rule-tester.ts
function buildSingleRuleConfig3(ruleName, ruleConfig, registry) {
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: tseslintParser3,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      plugins: knownPlugins(registry),
      rules: { [ruleName]: ruleConfig }
    }
  ];
}
function matches(message, expected, ruleName) {
  if (message.messageId === expected) return true;
  if (message.ruleId === expected) return true;
  if (message.ruleId === ruleName) return true;
  return false;
}
function runEslintRoundtrip(rule, parsedSnippet, registry, degraded) {
  if (rule.check.type !== "eslint" && rule.check.type !== "declarative") return [];
  if (rule.check.type === "declarative" && rule.check.engine === "ast-grep") {
    return [
      {
        ruleId: rule.id,
        code: "FF3003",
        reason: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)"
      }
    ];
  }
  const negativeTest = rule["negative-test"];
  if (!negativeTest) {
    return [
      {
        ruleId: rule.id,
        code: "FF3004",
        reason: "eslint rule has no negative-test (gate 1 catches this; gate 2 cannot run without it)"
      }
    ];
  }
  const ruleName = rule.check.type === "eslint" ? rule.check.rule : ESLINT_RESTRICTED_RULE_NAME;
  if (isUnresolvablePluginRule(ruleName, registry)) {
    degraded.push(degradeFor("ruleTester", ruleName, registry, rule.id));
    return [];
  }
  const ruleConfig = rule.check.type === "declarative" ? extractDeclarativeRuleConfigFromSnippet(
    parsedSnippet,
    rule.check.selector
  ) ?? declarativeRestrictedConfigEntry(rule.check) : parsedSnippet[ruleName] ?? "error";
  const config = buildSingleRuleConfig3(ruleName, ruleConfig, registry);
  const linter = new import_eslint3.Linter();
  const failures = [];
  for (const [idx, input] of negativeTest.input.entries()) {
    const negMessages = linter.verify(input, config, {
      filename: "negative-test.tsx"
    });
    const negMatched = negMessages.some(
      (m) => matches(m, negativeTest["expect-violation"], ruleName)
    );
    if (!negMatched) {
      failures.push({
        ruleId: rule.id,
        code: "FF3005",
        reason: `negative-test.input[${idx}] did not produce expected violation '${negativeTest["expect-violation"]}' for rule '${ruleName}'; got ${JSON.stringify(
          negMessages.map((m) => ({ rule: m.ruleId, messageId: m.messageId }))
        )}`
      });
    }
  }
  const posMessages = linter.verify(rule.examples.good, config, {
    filename: "example-good.tsx"
  });
  const posViolation = posMessages.find((m) => m.ruleId === ruleName);
  if (posViolation) {
    failures.push({
      ruleId: rule.id,
      code: "FF3006",
      reason: `examples.good produced unexpected violation: rule='${posViolation.ruleId}' message='${posViolation.message}'`
    });
  }
  for (const [idx, safeForm] of (rule.examples.safeForms ?? []).entries()) {
    const safeMessages = linter.verify(safeForm, config, {
      filename: `example-safe-form-${idx}.tsx`
    });
    const safeViolation = safeMessages.find((m) => m.ruleId === ruleName);
    if (safeViolation) {
      failures.push({
        ruleId: rule.id,
        code: "FF3021",
        reason: `examples.safeForms[${idx}] produced unexpected violation \u2014 selector is broader than its rationale (matches a known-safe form): rule='${safeViolation.ruleId}' message='${safeViolation.message}'`
      });
    }
  }
  return failures;
}
function runRuleTesterGate(plan, opts) {
  const eslintRules = plan.rules.filter(
    (r) => r.check.type === "eslint" || r.check.type === "declarative"
  );
  if (eslintRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const registry = resolvePluginRegistry(opts);
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet);
  const failures = [];
  const degraded = [];
  for (const rule of eslintRules) {
    failures.push(
      ...runEslintRoundtrip(rule, parsedSnippet, registry, degraded)
    );
  }
  return gateOutcome(failures, degraded);
}
var import_eslint3, tseslintParser3;
var init_gate_rule_tester = __esm({
  "packages/core/validator/gate-rule-tester.ts"() {
    "use strict";
    import_eslint3 = __toESM(require_eslint(), 1);
    tseslintParser3 = __toESM(require_parser(), 1);
    init_preset_plugin_resolver();
    init_compile_declarative_md();
  }
});

// packages/core/validator/internal-validators.ts
import { readFileSync as readFileSync13 } from "node:fs";
import { dirname as dirname5, resolve as resolve12 } from "node:path";
import { fileURLToPath as fileURLToPath5 } from "node:url";
function errorsText3(errors) {
  return errorsText(errors);
}
var HERE4, SCHEMA_PATH3, schemaDoc3, validateSynthesisPlan;
var init_internal_validators2 = __esm({
  "packages/core/validator/internal-validators.ts"() {
    "use strict";
    init_ajv();
    HERE4 = dirname5(fileURLToPath5(new URL("../validator/internal-validators.ts", import.meta.url).href));
    SCHEMA_PATH3 = resolve12(
      HERE4,
      "..",
      "synthesizer",
      "synthesis-plan.schema.json"
    );
    schemaDoc3 = JSON.parse(readFileSync13(SCHEMA_PATH3, "utf8"));
    validateSynthesisPlan = makeSchemaValidator(
      schemaDoc3,
      "synthesis-plan"
    );
  }
});

// packages/core/validator/gate-schema.ts
function runSchemaGate(plan) {
  if (!validateSynthesisPlan(plan)) {
    return {
      status: "fail",
      failures: [
        {
          code: "FF3001",
          reason: `SynthesisPlan schema violation: ${errorsText3(validateSynthesisPlan.errors)}`
        }
      ]
    };
  }
  const typed = plan;
  const failures = [];
  for (const rule of typed.rules) {
    if ((rule.check.type === "eslint" || rule.check.type === "declarative") && !rule["negative-test"]) {
      failures.push({
        ruleId: rule.id,
        code: "FF3002",
        reason: `${rule.check.type}-checked rule has no negative-test (required by L4 gate 2 \u2014 rule-tester roundtrip)`
      });
    }
  }
  return failures.length === 0 ? { status: "pass", failures: [] } : { status: "fail", failures };
}
var init_gate_schema = __esm({
  "packages/core/validator/gate-schema.ts"() {
    "use strict";
    init_internal_validators2();
  }
});

// packages/core/validator/gate-single-token-diff.ts
function tokenize(code) {
  return code.trim().split(/\s+/).filter(Boolean);
}
function tokenEditDistance(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const m = ta.length;
  const n = tb.length;
  let row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const newRow = [i];
    for (let j = 1; j <= n; j++) {
      const sub = ta[i - 1] === tb[j - 1] ? 0 : 1;
      newRow.push(
        Math.min(newRow[j - 1] + 1, row[j] + 1, row[j - 1] + sub)
      );
    }
    row = newRow;
  }
  return row[n];
}
function checkRule3(rule) {
  if (rule.check.type !== "declarative") return [];
  if (rule.check.engine === "ast-grep") {
    return [
      {
        ruleId: rule.id,
        code: "FF3010",
        reason: "ast-grep engine reserved but not wired \u2014 deferred per generator-forbid-mvp decision (i)"
      }
    ];
  }
  const distance = tokenEditDistance(rule.examples.bad, rule.examples.good);
  if (distance > MAX_TOKEN_EDITS) {
    return [
      {
        ruleId: rule.id,
        code: "FF3011",
        reason: `single-token-diff: examples.bad and examples.good differ by ${distance} tokens (threshold ${MAX_TOKEN_EDITS}) \u2014 pair does not isolate the forbidden construct; reduce to a minimal \u22481 token / 1 AST-node difference`
      }
    ];
  }
  return [];
}
function runSingleTokenDiffGate(plan) {
  const declarativeRules = plan.rules.filter(
    (r) => r.check.type === "declarative"
  );
  if (declarativeRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const failures = [];
  for (const rule of declarativeRules) {
    failures.push(...checkRule3(rule));
  }
  return failures.length === 0 ? { status: "pass", failures: [] } : { status: "fail", failures };
}
var MAX_TOKEN_EDITS;
var init_gate_single_token_diff = __esm({
  "packages/core/validator/gate-single-token-diff.ts"() {
    "use strict";
    MAX_TOKEN_EDITS = 5;
  }
});

// packages/core/validator/gate-tautology.ts
import { readFileSync as readFileSync14 } from "node:fs";
import { dirname as dirname6, resolve as resolve13 } from "node:path";
import { fileURLToPath as fileURLToPath6 } from "node:url";
function buildConfig(rule, parsedSnippet, registry) {
  if (rule.check.type !== "eslint") return null;
  const ruleName = rule.check.rule;
  const ruleConfig = parsedSnippet[ruleName] ?? "error";
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: import_parser.default,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      plugins: knownPlugins(registry),
      rules: { [ruleName]: ruleConfig }
    }
  ];
}
function runTautologyGate(plan, opts) {
  const eslintRules = plan.rules.filter((r) => r.check.type === "eslint");
  if (eslintRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const registry = resolvePluginRegistry(opts);
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet);
  const linter = new import_eslint4.Linter();
  const failures = [];
  const degraded = [];
  const corpus = CORPUS_FILES.map((name) => ({
    name,
    code: readFileSync14(resolve13(CORPUS_DIR, name), "utf8")
  }));
  for (const rule of eslintRules) {
    if (rule.check.type !== "eslint") continue;
    const config = buildConfig(rule, parsedSnippet, registry);
    if (!config) continue;
    const ruleName = rule.check.rule;
    if (isUnresolvablePluginRule(ruleName, registry)) {
      degraded.push(degradeFor("tautology", ruleName, registry, rule.id));
      continue;
    }
    for (const file of corpus) {
      const messages = linter.verify(file.code, config, { filename: file.name });
      const violating = messages.filter((m) => m.ruleId === ruleName);
      if (violating.length > 0) {
        failures.push({
          ruleId: rule.id,
          code: "FF3007",
          reason: `tautology \u2014 rule '${ruleName}' fires on negative-corpus/${file.name}: ${violating.map((m) => m.message).join("; ")}`
        });
      }
    }
  }
  return gateOutcome(failures, degraded);
}
var import_eslint4, import_parser, HERE5, CORPUS_DIR, CORPUS_FILES;
var init_gate_tautology = __esm({
  "packages/core/validator/gate-tautology.ts"() {
    "use strict";
    import_eslint4 = __toESM(require_eslint(), 1);
    import_parser = __toESM(require_parser(), 1);
    init_preset_plugin_resolver();
    HERE5 = dirname6(fileURLToPath6(new URL("../validator/gate-tautology.ts", import.meta.url).href));
    CORPUS_DIR = resolve13(HERE5, "fixtures", "negative-corpus");
    CORPUS_FILES = ["empty.ts", "comment-only.ts", "unrelated.tsx"];
  }
});

// packages/core/validator/gate-require-vacuity.ts
function buildRequireConfig(rule) {
  if (rule.check.type !== "declarative") return null;
  if (rule.check.presence !== "require") return null;
  const engine = rule.check.engine ?? "eslint-restricted";
  if (engine !== "eslint-restricted") return null;
  const entry = { selector: rule.check.selector };
  if (rule.check.message) entry.message = rule.check.message;
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: tseslintParser5,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      rules: {
        "no-restricted-syntax": ["error", entry]
      }
    }
  ];
}
function runRequireVacuityGate(plan) {
  const requireRules = plan.rules.filter(
    (r) => r.check.type === "declarative" && r.check.presence === "require"
  );
  if (requireRules.length === 0) {
    return { status: "n/a", failures: [] };
  }
  const linter = new import_eslint5.Linter();
  const failures = [];
  for (const rule of requireRules) {
    if (rule.check.type !== "declarative") continue;
    const engine = rule.check.engine ?? "eslint-restricted";
    if (engine === "ast-grep") {
      failures.push({
        ruleId: rule.id,
        code: "FF3018",
        reason: "ast-grep engine reserved but not wired for require-vacuity gate \u2014 deferred per generator-require-composite-tier decision"
      });
      continue;
    }
    const config = buildRequireConfig(rule);
    if (!config) continue;
    const badMessages = linter.verify(rule.examples.bad, config, { filename: "bad.ts" });
    const badViolations = badMessages.filter((m) => m.ruleId === "no-restricted-syntax");
    if (badViolations.length === 0) {
      failures.push({
        ruleId: rule.id,
        code: "FF3019",
        reason: `require-vacuity direction A \u2014 selector never fires on examples.bad; rule can never catch violations`
      });
    }
    const goodMessages = linter.verify(rule.examples.good, config, { filename: "good.ts" });
    const goodViolations = goodMessages.filter((m) => m.ruleId === "no-restricted-syntax");
    if (goodViolations.length > 0) {
      failures.push({
        ruleId: rule.id,
        code: "FF3020",
        reason: `require-vacuity direction B \u2014 selector fires on good example (${goodViolations.length} violation${goodViolations.length > 1 ? "s" : ""}); rule fires unconditionally`
      });
    }
  }
  return failures.length === 0 ? { status: "pass", failures: [] } : { status: "fail", failures };
}
var import_eslint5, tseslintParser5;
var init_gate_require_vacuity = __esm({
  "packages/core/validator/gate-require-vacuity.ts"() {
    "use strict";
    import_eslint5 = __toESM(require_eslint(), 1);
    tseslintParser5 = __toESM(require_parser(), 1);
  }
});

// packages/core/validator/validate.ts
function validate(plan) {
  const schema = runSchemaGate(plan);
  const downstreamSkipped = schema.status === "fail";
  const ruleTester = downstreamSkipped ? SKIPPED : runRuleTesterGate(plan);
  const tautology = downstreamSkipped ? SKIPPED : runTautologyGate(plan);
  const conflict = downstreamSkipped ? SKIPPED : runConflictGate(plan);
  const singleTokenDiff = downstreamSkipped ? SKIPPED : runSingleTokenDiffGate(plan);
  const messageIdCoverage = downstreamSkipped ? SKIPPED : runMessageIdCoverageGate(plan);
  const autofixClean = downstreamSkipped ? SKIPPED : runAutofixCleanGate(plan);
  const requireVacuity = downstreamSkipped ? SKIPPED : runRequireVacuityGate(plan);
  const ok = schema.status !== "fail" && ruleTester.status !== "fail" && tautology.status !== "fail" && conflict.status !== "fail" && singleTokenDiff.status !== "fail" && messageIdCoverage.status !== "fail" && autofixClean.status !== "fail" && requireVacuity.status !== "fail";
  const manualRules = plan.rules.filter((r) => r.check.type === "manual");
  return {
    ok,
    gates: {
      schema,
      ruleTester,
      tautology,
      conflict,
      singleTokenDiff,
      messageIdCoverage,
      autofixClean,
      requireVacuity
    },
    manualCount: manualRules.length,
    manualRuleIds: manualRules.map((r) => r.id)
  };
}
var SKIPPED;
var init_validate = __esm({
  "packages/core/validator/validate.ts"() {
    "use strict";
    init_gate_autofix_clean();
    init_gate_conflict();
    init_gate_message_id_coverage();
    init_gate_rule_tester();
    init_gate_schema();
    init_gate_single_token_diff();
    init_gate_tautology();
    init_gate_require_vacuity();
    SKIPPED = {
      status: "skip",
      failures: []
    };
  }
});

// packages/core/installer/install.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync13, mkdirSync as mkdirSync3, readFileSync as readFileSync15, writeFileSync as writeFileSync3 } from "node:fs";
import { resolve as resolve14 } from "node:path";
function outputDirOf(consumerRoot) {
  return resolve14(consumerRoot, ...OUTPUT_SUBPATH);
}
function lockNameOf(plan) {
  return plan.framework === null ? "rules-lock.json" : `rules-lock.${plan.framework}.json`;
}
function artifactsOf(plan) {
  return [...SHARED_ARTIFACTS, lockNameOf(plan)];
}
function fingerprint(plan) {
  return createHash2("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 16);
}
function readRulesLock(path) {
  const raw = JSON.parse(readFileSync15(path, "utf8"));
  if (raw.schemaVersion !== 2) {
    throw new RulesLockSchemaError(path, raw.schemaVersion ?? 0);
  }
  return raw;
}
function buildLock(plan, emittedAt) {
  const rules2 = plan.rules.map((r) => ({
    id: r.id,
    provenance: r.research.provenance,
    tier: weakestTier(r.research.provenance, r.research.tier)
  })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    schemaVersion: 2,
    framework: plan.framework,
    version: plan.version,
    rules: rules2,
    emittedAt,
    sourceFingerprint: fingerprint(plan)
  };
}
function postInstallChecks(plan, outputDir) {
  const failures = [];
  for (const name of artifactsOf(plan)) {
    const path = resolve14(outputDir, name);
    if (!existsSync13(path)) {
      failures.push({
        stage: "post-validate",
        reason: `expected artifact missing on disk: ${name}`
      });
    }
  }
  try {
    const lockPath = resolve14(outputDir, lockNameOf(plan));
    if (existsSync13(lockPath)) {
      const lock = readRulesLock(lockPath);
      const expected = plan.rules.map((r) => r.id).sort();
      const actual = lock.rules.map((r) => r.id).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push({
          stage: "post-validate",
          reason: `${lockNameOf(plan)} rules drift: lock=${JSON.stringify(actual)} plan=${JSON.stringify(expected)}`
        });
      }
    }
  } catch (err) {
    failures.push({
      stage: "post-validate",
      reason: err instanceof RulesLockSchemaError ? err.message : `${lockNameOf(plan)} failed to parse: ${err.message}`
    });
  }
  return { ok: failures.length === 0, failures };
}
function install(plan, opts) {
  const outputDir = outputDirOf(opts.consumerRoot);
  const expectedArtifacts = artifactsOf(plan).map((n) => resolve14(outputDir, n));
  const preValidation = validate(plan);
  if (plan.framework !== null && !FRAMEWORK_SLUG.test(plan.framework)) {
    return {
      ok: false,
      installed: false,
      artifacts: [],
      preValidation,
      failures: [
        {
          stage: "pre-validate",
          reason: `framework ${JSON.stringify(plan.framework)} is not a stack slug (${FRAMEWORK_SLUG.source}); refusing to build a lock path from it`
        }
      ]
    };
  }
  if (!preValidation.ok) {
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [
        {
          stage: "pre-validate",
          reason: `L4 validation failed before install \u2014 ${JSON.stringify(preValidation.gates)}`
        }
      ]
    };
  }
  const lockPath = resolve14(outputDir, lockNameOf(plan));
  if (!opts.dryRun && !opts.force && existsSync13(lockPath)) {
    let schemaStaleFound = null;
    try {
      readRulesLock(lockPath);
    } catch (err) {
      if (err instanceof RulesLockSchemaError) schemaStaleFound = err.found;
    }
    const failure = schemaStaleFound !== null ? {
      stage: "schema-stale",
      reason: `${lockNameOf(plan)} at ${lockPath} is schemaVersion ${schemaStaleFound} (this installer is v2-aware); regenerate the lock (delete it and re-run the install, or pass force: true, to emit a v2 lock)`
    } : {
      stage: "lock-collision",
      reason: `${lockNameOf(plan)} already exists at ${lockPath}; pass force: true to overwrite`
    };
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [failure]
    };
  }
  if (opts.dryRun) {
    return {
      ok: true,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: []
    };
  }
  try {
    mkdirSync3(outputDir, { recursive: true });
    emit2(plan, outputDir);
    const lock = buildLock(plan, (/* @__PURE__ */ new Date()).toISOString());
    writeFileSync3(lockPath, JSON.stringify(lock, null, 2) + "\n");
  } catch (err) {
    return {
      ok: false,
      installed: false,
      artifacts: expectedArtifacts,
      preValidation,
      failures: [{ stage: "emit", reason: err.message }]
    };
  }
  const postChecks = postInstallChecks(plan, outputDir);
  const postValidation = validate(plan);
  return {
    ok: postChecks.ok && postValidation.ok,
    installed: true,
    artifacts: expectedArtifacts,
    preValidation,
    postValidation,
    failures: postChecks.failures
  };
}
var OUTPUT_SUBPATH, SHARED_ARTIFACTS, FRAMEWORK_SLUG, RulesLockSchemaError;
var init_install = __esm({
  "packages/core/installer/install.ts"() {
    "use strict";
    init_emit();
    init_validate();
    init_tier();
    OUTPUT_SUBPATH = [".ai-factory", "synthesizer-output"];
    SHARED_ARTIFACTS = [
      "rules-manifest-additions.json",
      "RULES-additions.md",
      "eslint-rules-snippet.json"
    ];
    FRAMEWORK_SLUG = /^[a-z][a-z0-9-]*$/;
    RulesLockSchemaError = class extends Error {
      constructor(path, found) {
        super(
          `${path}: rules-lock schema version ${found} is no longer supported; regenerate the lock (delete it and re-run the install to emit a v2 lock)`
        );
        this.path = path;
        this.found = found;
        this.name = "RulesLockSchemaError";
      }
      path;
      found;
    };
  }
});

// packages/core/synthesizer/merge-eslint-config.ts
function isRestrictedImportsTuple(value) {
  return Array.isArray(value) && value.length >= 1;
}
function mergeNoRestrictedImports(a, b, sources, newSource) {
  if (!isRestrictedImportsTuple(a) || !isRestrictedImportsTuple(b)) {
    throw new RuleCollisionError(
      "no-restricted-imports",
      [...sources, newSource],
      'one or both recipes use a non-tuple shape; semantic merge requires the standard ["error", { paths: [...] }] form'
    );
  }
  const [sevA, optsA] = a;
  const [sevB, optsB] = b;
  const dedup = /* @__PURE__ */ new Map();
  for (const p of optsA?.paths ?? []) dedup.set(p.name, p);
  for (const p of optsB?.paths ?? []) {
    if (!dedup.has(p.name)) dedup.set(p.name, p);
  }
  const severity = sevA === "error" || sevB === "error" ? "error" : sevA;
  return [severity, { paths: Array.from(dedup.values()) }];
}
function restrictedSyntaxSelector(entry) {
  return typeof entry === "string" ? entry : entry.selector;
}
function mergeNoRestrictedSyntax(a, b, sources, newSource) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new RuleCollisionError(
      "no-restricted-syntax",
      [...sources, newSource],
      'one or both recipes use a non-tuple shape; semantic merge requires the standard ["error", ...selectorEntries] form'
    );
  }
  const [sevA, ...entriesA] = a;
  const [sevB, ...entriesB] = b;
  const dedup = /* @__PURE__ */ new Map();
  for (const e of entriesA) dedup.set(restrictedSyntaxSelector(e), e);
  for (const e of entriesB) {
    const key = restrictedSyntaxSelector(e);
    if (!dedup.has(key)) dedup.set(key, e);
  }
  const severity = sevA === "error" || sevB === "error" ? "error" : sevA;
  return [severity, ...Array.from(dedup.values())];
}
function mergeEslintRuleConfig(acc, next, newSource, ruleSources) {
  for (const [ruleName, ruleConfig] of Object.entries(next)) {
    const existingSources = ruleSources.get(ruleName) ?? [];
    if (!(ruleName in acc)) {
      acc[ruleName] = ruleConfig;
      ruleSources.set(ruleName, [...existingSources, newSource]);
      continue;
    }
    if (ruleName === "no-restricted-imports") {
      acc[ruleName] = mergeNoRestrictedImports(
        acc[ruleName],
        ruleConfig,
        existingSources,
        newSource
      );
      ruleSources.set(ruleName, [...existingSources, newSource]);
      continue;
    }
    if (RESTRICTED_SYNTAX_SHAPED.has(ruleName)) {
      acc[ruleName] = mergeNoRestrictedSyntax(
        acc[ruleName],
        ruleConfig,
        existingSources,
        newSource
      );
      ruleSources.set(ruleName, [...existingSources, newSource]);
      continue;
    }
    throw new RuleCollisionError(
      ruleName,
      [...existingSources, newSource],
      "rule has no defined merge strategy \u2014 disambiguate recipes or add a strategy in merge-eslint-config.ts"
    );
  }
}
var RESTRICTED_SYNTAX_SHAPED, RuleCollisionError;
var init_merge_eslint_config = __esm({
  "packages/core/synthesizer/merge-eslint-config.ts"() {
    "use strict";
    init_compile_declarative_md();
    RESTRICTED_SYNTAX_SHAPED = /* @__PURE__ */ new Set([
      "no-restricted-syntax",
      ESLINT_RESTRICTED_RULE_NAME
    ]);
    RuleCollisionError = class extends Error {
      constructor(ruleName, sources, detail) {
        super(
          `eslintRuleConfig collision on '${ruleName}' across recipes [${sources.join(", ")}]: ${detail}`
        );
        this.ruleName = ruleName;
        this.sources = sources;
        this.name = "RuleCollisionError";
      }
      ruleName;
      sources;
    };
  }
});

// packages/core/backends/npm/from-node.ts
function isValidParams2(params) {
  const selector = params["selector"];
  const presence = params["presence"];
  if (typeof selector !== "string" || selector.length === 0) return false;
  if (typeof presence !== "string" || !VALID_PRESENCE.includes(presence)) return false;
  return true;
}
function missingOrInvalidField2(params) {
  const selector = params["selector"];
  if (typeof selector !== "string" || selector.length === 0) return "selector";
  const presence = params["presence"];
  if (typeof presence !== "string" || !VALID_PRESENCE.includes(presence)) return "presence";
  return "unknown";
}
function nodeToSynthesizedRule(node, enrichment) {
  if (node.selectorClass !== "syntax") {
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} has selectorClass '${node.selectorClass}', only 'syntax' maps to a declarative rule`
    );
  }
  if (node.relational !== void 0) {
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} carries a relational tree; only non-relational syntax nodes map to a declarative rule (route to the ast-grep backend, #212 \u2014 routing must gate this)`
    );
  }
  if (!isValidParams2(node.params)) {
    throw new Error(
      `nodeToSynthesizedRule(): node ${node.id} params fail the npm declarative contract (missing/invalid ${missingOrInvalidField2(node.params)})`
    );
  }
  const params = node.params;
  const rule = {
    id: node.id,
    title: node.claim,
    // claim -> title (spec §4: message/title is ALWAYS node.claim)
    stack: enrichment.stack,
    ...enrichment.appliesTo !== void 0 ? { "applies-to": enrichment.appliesTo } : {},
    check: {
      type: "declarative",
      engine: "eslint-restricted",
      selector: params.selector,
      presence: params.presence,
      message: node.claim,
      ...params.messageId !== void 0 ? { messageId: params.messageId } : {}
    },
    examples: {
      bad: node.pairedExamples.negative,
      // negative example = the violating code
      good: node.pairedExamples.positive
      // positive example = the conforming code
    },
    research: { entryId: node.id, provenance: node.provenance }
  };
  return rule;
}
var VALID_PRESENCE;
var init_from_node = __esm({
  "packages/core/backends/npm/from-node.ts"() {
    "use strict";
    init_registry();
    init_render_outcome();
    VALID_PRESENCE = ["forbid", "require"];
  }
});

// packages/core/synthesizer/to-node.ts
function isSyntaxDeclarative(check) {
  return check.type === "declarative" && (check.engine === void 0 || check.engine === "eslint-restricted");
}
function buildNode(rule, entryId, provenance) {
  const params = {};
  if (rule.check.type === "declarative") {
    params["selector"] = rule.check.selector;
    params["presence"] = rule.check.presence;
  }
  return {
    id: entryId,
    claim: rule.title,
    anchors: [],
    // For a declarative-syntax rule this is a REAL classification ('syntax' — the adapter
    // renders it). For a non-syntax rule (eslint/command/script/manual) the node exists ONLY
    // to stand the grammar gate in the flow (T15/N4) and is then discarded — wireRuleThroughNode
    // returns the original rule unchanged before the adapter is ever reached, so this value is
    // NEVER consumed. 'dep-graph' is a throwaway placeholder here, NOT a real dependency-graph
    // classification of the rule. (Latent trap guard: if a future stage feeds these gate-only
    // nodes to the npm router in from-node.ts, 'dep-graph' would be refused FF7001 with a
    // misleading "dependency-level ban" note — at that point give non-syntax nodes a truthful
    // class or route them away before the router, do not let this placeholder leak.)
    selectorClass: isSyntaxDeclarative(rule.check) ? "syntax" : "dep-graph",
    params,
    defaultSeverity: DEFAULT_NODE_SEVERITY,
    provenance,
    pairedExamples: {
      // negative example = the violating code; positive = the conforming code (spec §4)
      negative: rule.examples.bad,
      positive: rule.examples.good
    }
  };
}
function wireRuleThroughNode(rule) {
  const entryId = rule.research.entryId;
  const provenance = rule.research.provenance;
  const node = buildNode(rule, entryId, provenance);
  const gate = runGrammarGate([node]);
  if (gate.status !== "pass") {
    throw new GrammarGateError(node.id, gate.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; "));
  }
  if (!isSyntaxDeclarative(rule.check)) {
    return rule;
  }
  const enrichment = {
    stack: rule.stack,
    ...rule["applies-to"] !== void 0 ? { appliesTo: rule["applies-to"] } : {}
  };
  const projected = nodeToSynthesizedRule(node, enrichment);
  return mergeEnrichment(projected, rule);
}
function mergeEnrichment(projected, original) {
  const resolve16 = (key) => {
    switch (key) {
      case "title":
        return projected.title;
      // node backbone owns the claim -> title
      case "examples":
        return original.examples.safeForms !== void 0 ? { ...projected.examples, safeForms: original.examples.safeForms } : projected.examples;
      case "stack":
        return projected.stack;
      // adapter re-emits from enrichment.stack (round-trip used)
      case "applies-to":
        return projected["applies-to"];
      // adapter re-emits from enrichment.appliesTo
      case "check":
        return mergeCheck(projected.check, original.check);
      default:
        return original[key];
    }
  };
  const merged = {};
  for (const key of Object.keys(original)) {
    merged[key] = resolve16(key);
  }
  return merged;
}
function mergeCheck(projectedCheck, originalCheck) {
  if (originalCheck.type !== "declarative" || projectedCheck.type !== "declarative") {
    return originalCheck;
  }
  const rebuilt = {};
  for (const key of Object.keys(originalCheck)) {
    if (key === "selector") {
      rebuilt[key] = projectedCheck.selector;
    } else if (key === "presence") {
      rebuilt[key] = projectedCheck.presence;
    } else {
      rebuilt[key] = originalCheck[key];
    }
  }
  return rebuilt;
}
var GrammarGateError, DEFAULT_NODE_SEVERITY;
var init_to_node = __esm({
  "packages/core/synthesizer/to-node.ts"() {
    "use strict";
    init_from_node();
    init_grammar();
    GrammarGateError = class extends Error {
      constructor(nodeId, diagnostics) {
        super(`Grammar gate rejected node ${nodeId}: ${diagnostics}`);
        this.nodeId = nodeId;
        this.diagnostics = diagnostics;
        this.name = "GrammarGateError";
      }
      nodeId;
      diagnostics;
    };
    DEFAULT_NODE_SEVERITY = "error";
  }
});

// packages/core/synthesizer/generate.ts
async function synthesizeGenerate(plan, client) {
  const candidates = plan.patterns.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    bestPractices: entry.bestPractices,
    antiPatterns: entry.antiPatterns
  }));
  const menu = {
    framework: plan.framework,
    version: plan.version,
    candidates
  };
  const selection = await client.generate(menu);
  const rules2 = [];
  const mdFragments = [];
  const mergedEslintConfig = {};
  const ruleSources = /* @__PURE__ */ new Map();
  let nextId = 1;
  for (const candidate of selection.rules) {
    const entry = plan.patterns.find((p) => p.id === candidate.entryId);
    if (!entry) continue;
    const id = `G${nextId++}`;
    const hasEslintConfig = candidate.eslintConfig !== void 0 && Object.keys(candidate.eslintConfig).length > 0;
    let check;
    if (candidate.presence === "forbid" && candidate.selector) {
      check = {
        type: "declarative",
        presence: "forbid",
        selector: candidate.selector,
        message: candidate.message ?? "forbidden construct",
        engine: candidate.engine ?? "eslint-restricted"
      };
    } else if (hasEslintConfig) {
      check = { type: "eslint", rule: candidate.ruleId };
    } else {
      check = {
        type: "manual",
        rationale: `Plugin rule '${candidate.ruleId}' \u2014 L4 harness KNOWN_PLUGINS only registers rules-as-tests; roundtrip not supported for this rule`
      };
    }
    const stampedProv = stampProvenanceTier(entry.provenance);
    const composed = {
      id,
      title: candidate.title,
      stack: candidate.stack,
      check,
      examples: candidate.examples,
      research: { entryId: entry.id, provenance: stampedProv, tier: weakestTier(stampedProv) }
    };
    if (candidate.negativeTest && (check.type === "declarative" || check.type === "eslint")) {
      composed["negative-test"] = candidate.negativeTest;
    }
    const rule = wireRuleThroughNode(composed);
    rules2.push(rule);
    if (check.type === "declarative") {
      mdFragments.push(compileDeclarativeMd(rule));
    } else {
      mdFragments.push(
        `## ${id} \u2014 ${candidate.title}

**Check:** ${hasEslintConfig ? `\`${candidate.ruleId}\`` : "Manual review"}
`
      );
    }
    if (check.type === "declarative" && (!check.engine || check.engine === "eslint-restricted")) {
      mergeEslintRuleConfig(
        mergedEslintConfig,
        {
          [ESLINT_RESTRICTED_RULE_NAME]: declarativeRestrictedConfigEntry(check)
        },
        candidate.ruleId,
        ruleSources
      );
    } else if (hasEslintConfig && candidate.eslintConfig) {
      mergeEslintRuleConfig(
        mergedEslintConfig,
        candidate.eslintConfig,
        candidate.ruleId,
        ruleSources
      );
    }
  }
  return {
    framework: plan.framework,
    version: plan.version,
    rules: rules2,
    rulesMd: mdFragments.join("\n"),
    eslintConfigSnippet: JSON.stringify(mergedEslintConfig, null, 2)
  };
}
var init_generate = __esm({
  "packages/core/synthesizer/generate.ts"() {
    "use strict";
    init_compile_declarative_md();
    init_merge_eslint_config();
    init_tier();
    init_to_node();
  }
});

// packages/core/synthesizer/generate-cli.ts
async function runGeneratePath(plan, client) {
  const synthPlan = await synthesizeGenerate(plan, client);
  const report = validate(synthPlan);
  if (report.ok) return { mode: "synthesis", plan: synthPlan };
  return { mode: "research-only", plan };
}
var init_generate_cli = __esm({
  "packages/core/synthesizer/generate-cli.ts"() {
    "use strict";
    init_generate();
    init_validate();
  }
});

// packages/core/synthesizer/rule-research-port.ts
var _NEXT_IMAGE_PLAN, stubRuleResearch;
var init_rule_research_port = __esm({
  "packages/core/synthesizer/rule-research-port.ts"() {
    "use strict";
    _NEXT_IMAGE_PLAN = {
      framework: "react-next",
      version: null,
      patterns: [
        {
          id: "next-image-no-raw-img",
          summary: "Next.js components must render images via the next/image <Image> component instead of a raw <img> element. next/image provides automatic optimisation (lazy-loading, responsive srcset, CLS-safe sizing) that a raw <img> lacks.",
          bestPractices: [
            "Import Image from 'next/image' and render <Image> with explicit width/height (or fill)",
            "Configure remote hosts via images.remotePatterns in next.config instead of bypassing the optimiser",
            "Always provide an alt attribute for accessibility"
          ],
          antiPatterns: [
            "Rendering a raw <img> element in a Next.js component",
            "Omitting width/height on images, causing cumulative layout shift (CLS)"
          ],
          provenance: [
            {
              url: "https://nextjs.org/docs/app/api-reference/components/image",
              allowlistKey: "nextjs.org",
              fetchedAt: "2026-06-28T00:00:00.000Z"
            }
          ]
        }
      ],
      missing: [],
      drift: null
    };
    stubRuleResearch = {
      async research(_detection) {
        return _NEXT_IMAGE_PLAN;
      }
    };
  }
});

// packages/core/synthesizer/rule-bootstrap.ts
var rule_bootstrap_exports = {};
__export(rule_bootstrap_exports, {
  runRuleBootstrap: () => runRuleBootstrap,
  stubGenerateNextImage: () => stubGenerateNextImage
});
async function runRuleBootstrap(opts) {
  const researchClient = opts.researchClient ?? stubRuleResearch;
  const generateClient = opts.generateClient ?? stubGenerateNextImage;
  const plan = await researchClient.research(STUB_DETECTION);
  const result = await runGeneratePath(plan, generateClient);
  if (result.mode === "research-only") {
    return { mode: "research-only", plan: result.plan };
  }
  const report = install(result.plan, {
    consumerRoot: opts.consumerRoot,
    force: opts.force ?? true
  });
  return { mode: "synthesis", install: report };
}
var stubGenerateNextImage, STUB_DETECTION;
var init_rule_bootstrap = __esm({
  "packages/core/synthesizer/rule-bootstrap.ts"() {
    "use strict";
    init_install();
    init_generate_cli();
    init_rule_research_port();
    stubGenerateNextImage = {
      async generate(_menu) {
        return {
          rules: [
            {
              entryId: "next-image-no-raw-img",
              ruleId: "no-raw-img",
              title: "Use next/image <Image> instead of a raw <img> element",
              stack: ["react-next"],
              presence: "forbid",
              selector: "JSXOpeningElement[name.name='img']",
              message: "Use next/image <Image> instead of a raw <img> element.",
              examples: {
                bad: "<img src={src} />",
                good: "<Image src={src} />"
              },
              negativeTest: {
                input: ["<img src={src} />"],
                "expect-violation": "no-restricted-syntax"
              }
            }
          ]
        };
      }
    };
    STUB_DETECTION = {
      stack: "react-next",
      framework: { name: "next", version: null, major: null },
      runtime: { name: "node", major: null },
      confidence: "high",
      severity: "pass",
      weight: 2,
      source: "rule-bootstrap-stub",
      rules: { applicable: [], skipped: [] }
    };
  }
});

// packages/core/install/rule-bootstrap-cli.ts
import process3 from "node:process";
import {
  existsSync as existsSync14,
  mkdirSync as mkdirSync4,
  readdirSync as readdirSync4,
  readFileSync as readFileSync16,
  realpathSync as realpathSync2,
  statSync as statSync3,
  writeFileSync as writeFileSync4
} from "node:fs";
import { join as join9, relative as relative2, resolve as resolve15, sep as sep2 } from "node:path";
import { fileURLToPath as fileURLToPath7 } from "node:url";

// packages/core/synthesizer/file-clients.ts
import { readFileSync as readFileSync10 } from "node:fs";
import process2 from "node:process";

// packages/core/research/validate-plan.ts
init_internal_validators();

// packages/core/research/gates/shape.ts
init_ajv();
init_internal_validators();
function runShapeGate(plan) {
  const shapeOk = validateResearchPlanShape(plan);
  if (shapeOk) {
    return { status: "pass", diagnostics: [] };
  }
  return {
    status: "fail",
    diagnostics: ajvErrorsToDiagnostics(validateResearchPlanShape.errors)
  };
}

// packages/core/research/gates/provenance.ts
init_allowlist_resolver();
init_allowlist();
function maybePatternsOf(plan) {
  return plan !== null && typeof plan === "object" && Array.isArray(plan.patterns) ? plan.patterns : void 0;
}
function provenanceDiagFromTier0Only(p) {
  const v = validateProvenance2(p);
  if (v.ok) return null;
  const tier0Only2 = resolveAllowedSources();
  return validateProvenance(p, tier0Only2);
}
function runProvenanceGate(plan, ctx, entryIdOut) {
  const resolved = ctx ? resolveAllowedSources(ctx) : void 0;
  const maybePatterns = maybePatternsOf(plan);
  if (!maybePatterns) {
    return { status: "pass", diagnostics: [] };
  }
  const diagnostics = [];
  for (const entry of maybePatterns) {
    const provenance = Array.isArray(entry?.["provenance"]) ? entry["provenance"] : [];
    const entryId = typeof entry?.["id"] === "string" ? entry["id"] : "<unknown>";
    const entryPackage = typeof entry?.["package"] === "string" ? entry["package"] : void 0;
    for (const p of provenance) {
      const d = resolved ? validateProvenance(p, resolved, { entryPackage }) : provenanceDiagFromTier0Only(p);
      if (d !== null) {
        const withPath = { ...d, path: d.path ?? `/patterns/${entryId}/provenance` };
        diagnostics.push(withPath);
        entryIdOut?.set(withPath, entryId);
      }
    }
  }
  if (diagnostics.length > 0) return { status: "fail", diagnostics };
  return { status: "pass", diagnostics: [] };
}

// packages/core/research/gates/report.ts
function hasUniterablePatterns(plan) {
  return !(plan !== null && typeof plan === "object" && Array.isArray(plan.patterns));
}
function runResearchValidation(plan, ctx, entryIdOut) {
  const shape = runShapeGate(plan);
  const provenanceOutcome = runProvenanceGate(plan, ctx, entryIdOut);
  const provenance = hasUniterablePatterns(plan) && provenanceOutcome.status === "pass" ? { status: "skip", diagnostics: [] } : provenanceOutcome;
  const ok = shape.status !== "fail" && provenance.status !== "fail";
  return {
    ok,
    gates: { shape, provenance }
  };
}

// packages/core/research/validate-plan.ts
var ResearchPlanError = class extends Error {
  constructor(errors, diagnostics = []) {
    super(`Invalid ResearchPlan: ${errors}`);
    this.errors = errors;
    this.diagnostics = diagnostics;
    this.name = "ResearchPlanError";
  }
  errors;
  diagnostics;
};
function checkResearchPlan(plan, ctx, entryIdOut) {
  const report = runResearchValidation(plan, ctx, entryIdOut);
  const diagnostics = [
    ...report.gates.shape.diagnostics,
    ...report.gates.provenance.diagnostics
  ];
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, plan, diagnostics: [] };
}
function validateResearchPlan(plan, resolveCtx) {
  const entryIds = /* @__PURE__ */ new WeakMap();
  const result = checkResearchPlan(plan, resolveCtx, entryIds);
  if (!result.ok) {
    const first = result.diagnostics[0];
    if (first === void 0) {
      throw new ResearchPlanError("unknown validation failure", result.diagnostics);
    }
    const message = first.code === "FF1001" ? errorsText2(validateResearchPlanShape.errors) : `pattern[${entryIds.get(first) ?? "<unknown>"}] provenance violation \u2014 ${first.message}`;
    throw new ResearchPlanError(message, result.diagnostics);
  }
}

// packages/core/detector/index.ts
import { resolve as resolve7 } from "node:path";

// packages/core/detector/read-aif.ts
import { existsSync, readFileSync as readFileSync3, readdirSync, statSync } from "node:fs";
import { resolve as resolve2, join as join2 } from "node:path";

// packages/core/detector/confidence.ts
function toConfidence(priority) {
  if (priority <= 3) return { severity: "pass", weight: 2, confidence: "high" };
  if (priority === 4) return { severity: "warn", weight: 1, confidence: "medium" };
  return { severity: "info", weight: 0, confidence: "low" };
}

// packages/core/detector/version-aware.ts
var import_semver = __toESM(require_semver2(), 1);
function extractMajor(versionRange) {
  if (!versionRange) return null;
  const coerced = import_semver.default.coerce(versionRange);
  return coerced ? coerced.major : null;
}
function extractVersion(versionRange) {
  if (!versionRange) return null;
  const coerced = import_semver.default.coerce(versionRange);
  return coerced ? coerced.version : null;
}

// packages/core/detector/read-aif.ts
var FRAMEWORK_PATTERNS = [
  { name: "next", re: /\b(next\.js|nextjs|next js)\b/i, stack: "react-next" },
  { name: "react", re: /\breact\b/i, stack: "react-next" }
];
var VERSION_RE = /\b(?:next\.js|nextjs|next js|next|react)[\s@v]*([0-9]+(?:\.[0-9]+){0,2})\b/i;
function parseAifMarkdown(content) {
  const hasCanonicalHeading = /^#\s+(Description|Architecture|Stack|Project)/im.test(content) || /^##?\s+(Stack|Tech\s*Stack|Framework|Runtime|Technology)/im.test(content);
  if (!hasCanonicalHeading) return null;
  const versionMatch = content.match(VERSION_RE);
  const versionRaw = versionMatch ? versionMatch[1] : null;
  for (const { name, re, stack } of FRAMEWORK_PATTERNS) {
    if (re.test(content)) {
      return {
        stack,
        framework: {
          name,
          version: extractVersion(versionRaw),
          major: extractMajor(versionRaw)
        }
      };
    }
  }
  return {
    stack: "ts-server",
    framework: { name: null, version: null, major: null }
  };
}
function tryReadFile(absPath) {
  if (!existsSync(absPath)) return null;
  try {
    return readFileSync3(absPath, "utf8");
  } catch {
    return null;
  }
}
function listSkillContextFiles(projectRoot) {
  const dir = resolve2(projectRoot, ".ai-factory/skill-context");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const skillMd = join2(dir, entry, "SKILL.md");
    if (existsSync(skillMd)) out.push(skillMd);
  }
  return out;
}
function emit(signals, source, priority) {
  const tuple = toConfidence(priority);
  return {
    stack: signals.stack,
    framework: signals.framework,
    runtime: { name: "node", major: null },
    ...tuple,
    source,
    rules: { applicable: [], skipped: [] }
  };
}
var AifSchemaError = class extends Error {
  constructor(filePath, reason) {
    super(`AIF schema validation failed for ${filePath}: ${reason}`);
    this.name = "AifSchemaError";
  }
};
function readAif(projectRoot) {
  const descPath = resolve2(projectRoot, ".ai-factory/DESCRIPTION.md");
  const desc = tryReadFile(descPath);
  if (desc !== null) {
    const signals = parseAifMarkdown(desc);
    if (signals === null) {
      throw new AifSchemaError(
        ".ai-factory/DESCRIPTION.md",
        "no canonical heading (# Description / ## Stack / etc.) found"
      );
    }
    return emit(signals, ".ai-factory/DESCRIPTION.md", 1);
  }
  const archPath = resolve2(projectRoot, ".ai-factory/ARCHITECTURE.md");
  const arch = tryReadFile(archPath);
  if (arch !== null) {
    const signals = parseAifMarkdown(arch);
    if (signals === null) {
      throw new AifSchemaError(
        ".ai-factory/ARCHITECTURE.md",
        "no canonical heading (# Architecture / ## Stack / etc.) found"
      );
    }
    return emit(signals, ".ai-factory/ARCHITECTURE.md", 2);
  }
  const skillFiles = listSkillContextFiles(projectRoot).sort();
  for (const file of skillFiles) {
    const content = tryReadFile(file);
    if (content === null) continue;
    const signals = parseAifMarkdown(content);
    if (signals === null) {
      throw new AifSchemaError(file, "no canonical heading found");
    }
    const rel = file.slice(projectRoot.length + 1);
    return emit(signals, rel, 3);
  }
  return null;
}

// packages/core/detector/read-manifest.ts
import { existsSync as existsSync2, readFileSync as readFileSync4 } from "node:fs";
import { resolve as resolve3 } from "node:path";

// packages/core/detector/known-packages.ts
var KNOWN_PACKAGES = [
  "@opentelemetry/api",
  "@playwright/test",
  "vitest",
  "@storybook/nextjs",
  "@storybook/nextjs-vite",
  "tailwindcss"
];
function computeMissing(deps) {
  return KNOWN_PACKAGES.filter((p) => !deps.has(p));
}

// packages/core/detector/read-manifest.ts
function readPkg(projectRoot) {
  const pkgPath = resolve3(projectRoot, "package.json");
  if (!existsSync2(pkgPath)) return null;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync4(pkgPath, "utf8"));
  } catch {
    return null;
  }
  const allDeps = {
    ...pkg.dependencies ?? {},
    ...pkg.devDependencies ?? {}
  };
  return { pkg, allDeps };
}
function readAllDepsSet(projectRoot) {
  const result = readPkg(projectRoot);
  if (!result) return /* @__PURE__ */ new Set();
  return new Set(Object.keys(result.allDeps));
}
function readManifest(projectRoot) {
  const result = readPkg(projectRoot);
  if (!result) return null;
  const { allDeps } = result;
  const tuple = toConfidence(4);
  const source = "package.json";
  const baseRules = { applicable: [], skipped: [] };
  const missing = computeMissing(new Set(Object.keys(allDeps)));
  if ("next" in allDeps) {
    const range = allDeps.next;
    return {
      stack: "react-next",
      framework: { name: "next", version: extractVersion(range), major: extractMajor(range) },
      runtime: { name: "node", major: null },
      ...tuple,
      source,
      rules: baseRules,
      missing
    };
  }
  if ("react" in allDeps || "@types/react" in allDeps) {
    const range = allDeps.react ?? allDeps["@types/react"];
    return {
      stack: "react-next",
      framework: { name: "react", version: extractVersion(range), major: extractMajor(range) },
      runtime: { name: "node", major: null },
      ...tuple,
      source,
      rules: baseRules,
      missing
    };
  }
  return {
    stack: "ts-server",
    framework: { name: null, version: null, major: null },
    runtime: { name: "node", major: null },
    ...tuple,
    source,
    rules: baseRules,
    missing
  };
}

// packages/core/detector/read-python-cargo.ts
import { existsSync as existsSync5 } from "node:fs";
import { resolve as resolve5 } from "node:path";

// packages/core/research/ecosystem-python.ts
import { existsSync as existsSync4, readFileSync as readFileSync5, readdirSync as readdirSync2 } from "node:fs";
import { join as join3 } from "node:path";

// packages/core/research/research-path-guards.ts
import { existsSync as existsSync3, realpathSync } from "node:fs";
import { resolve as resolve4, sep } from "node:path";
function isUnsafeDepName(name, mode = "strictest") {
  if (name.includes("..")) return true;
  if (mode === "go-feed-raw") return name.includes("\\");
  return name.includes("/") || name.includes(sep) || name.includes("\\");
}
function isWithinRoot(candidateAbs, root) {
  const base = root.endsWith(sep) ? root : root + sep;
  return candidateAbs === root || candidateAbs.startsWith(base);
}
function resolvedWithinRoot(root, ...segments) {
  const candidate = resolve4(root, ...segments);
  if (!isWithinRoot(candidate, root)) return null;
  if (!existsSync3(candidate)) return null;
  let real;
  let realRoot;
  try {
    real = realpathSync(candidate);
    realRoot = realpathSync(root);
  } catch {
    return null;
  }
  return isWithinRoot(real, realRoot) ? candidate : null;
}

// packages/core/research/ecosystem-python.ts
function normalizePep503(name) {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}
function extractPep508Name(spec) {
  const s = spec.trim();
  if (s === "") return null;
  if (/^[><=~!]/.test(s)) return null;
  if (s.includes("(")) return null;
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  if (m === null) return null;
  const afterName = s.slice(m[1].length).trimStart();
  if (afterName.startsWith("@")) return null;
  return normalizePep503(m[1]);
}
function stripComments(text) {
  return text.split("\n").map((line) => {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "#" && !inQuotes) return line.slice(0, i);
    }
    return line;
  }).join("\n");
}
function parsePyproject(text) {
  const empty = { sections: /* @__PURE__ */ new Map() };
  try {
    const stripped = stripComments(text);
    const sections = /* @__PURE__ */ new Map();
    let current = "";
    for (const rawLine of stripped.split("\n")) {
      const line = rawLine.trim();
      if (line === "") continue;
      const headerMatch = /^\[([^\]]+)\]$/.exec(line);
      if (headerMatch) {
        current = headerMatch[1].trim();
        if (!sections.has(current)) sections.set(current, []);
        continue;
      }
      if (current === "") continue;
      sections.get(current).push(line);
    }
    return { sections };
  } catch {
    return empty;
  }
}
function extractPep621Deps(sectionBody) {
  const names = /* @__PURE__ */ new Set();
  for (const line of sectionBody) {
    const arr = /^\s*([A-Za-z0-9_.-]+)\s*=\s*\[((?:[^"\]]|"[^"]*")*)\]\s*$/.exec(line);
    if (arr) {
      const inner = arr[2];
      for (const quoted of inner.match(/"([^"]*)"/g) ?? []) {
        const spec = quoted.slice(1, -1);
        const name = extractPep508Name(spec);
        if (name !== null) names.add(name);
      }
    }
  }
  return names;
}
function collectArrayLines(body, start) {
  const lines = [];
  let depth = 0;
  let inQuotes = false;
  for (let i = start; i < body.length; i++) {
    const line = body[i];
    lines.push(line);
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (inQuotes) continue;
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
    }
    if (depth <= 0 && !inQuotes) return { lines, next: i + 1 };
  }
  return null;
}
function extractPoetryDeps(sectionBody) {
  const names = /* @__PURE__ */ new Set();
  for (const line of sectionBody) {
    const bare = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line);
    if (bare) {
      const key = bare[1];
      if (key === "python") continue;
      const afterEq = line.slice(bare[0].length);
      if (afterEq.includes("{") && !afterEq.includes("}")) continue;
      names.add(normalizePep503(key));
    }
  }
  return names;
}
function readMetadataName(text) {
  for (const line of text.split("\n")) {
    if (line === "") break;
    const m = /^Name:\s*(.*)$/.exec(line);
    if (m) return m[1].trim();
  }
  return null;
}
function readHomepageFromMetadata(text) {
  const lines = text.split("\n");
  let homePage;
  let projectUrlHomepage;
  const isFolded = (i) => {
    const next = lines[i + 1];
    return next !== void 0 && next !== "" && /^[ \t]/.test(next);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") break;
    const hp = /^Home-page:\s*(.*)$/.exec(line);
    if (hp) {
      if (!isFolded(i)) homePage = hp[1].trim();
      continue;
    }
    const pu = /^Project-URL:\s*Homepage\s*,\s*(.*)$/i.exec(line);
    if (pu) {
      if (!isFolded(i)) projectUrlHomepage = pu[1].trim();
      continue;
    }
  }
  return projectUrlHomepage ?? homePage;
}
function readDocumentationFromMetadata(text) {
  const lines = text.split("\n");
  let projectUrlDocumentation;
  const isFolded = (i) => {
    const next = lines[i + 1];
    return next !== void 0 && next !== "" && /^[ \t]/.test(next);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") break;
    const pu = /^Project-URL:\s*Documentation\s*,\s*(.*)$/i.exec(line);
    if (pu) {
      if (!isFolded(i)) projectUrlDocumentation = pu[1].trim();
      continue;
    }
  }
  return projectUrlDocumentation;
}
var pipAdapter = {
  ecosystem: "pip",
  listDirectDeps(root) {
    const pyprojectPath = join3(root, "pyproject.toml");
    if (!existsSync4(pyprojectPath)) return /* @__PURE__ */ new Set();
    let text;
    try {
      text = readFileSync5(pyprojectPath, "utf8");
    } catch {
      return /* @__PURE__ */ new Set();
    }
    const parsed = parsePyproject(text);
    const names = /* @__PURE__ */ new Set();
    for (const [header, body] of parsed.sections) {
      if (header === "project") {
        for (let i = 0; i < body.length; ) {
          if (!/^\s*dependencies\s*=\s*\[/.test(body[i])) {
            i++;
            continue;
          }
          const acc = collectArrayLines(body, i);
          if (acc === null) break;
          for (const n of extractPep621Deps([acc.lines.join(" ")])) names.add(n);
          i = acc.next;
        }
      } else if (header === "project.optional-dependencies") {
        for (const n of extractPep621Deps(body)) names.add(n);
      } else if (header === "tool.poetry.dependencies" || /^tool\.poetry\.group\.[A-Za-z0-9_-]+\.dependencies$/.test(header)) {
        for (const n of extractPoetryDeps(body)) names.add(n);
      }
    }
    return names;
  },
  readInstalledMeta(root, pkg) {
    if (isUnsafeDepName(pkg)) return null;
    const normalizedPkg = normalizePep503(pkg);
    for (const venvName of [".venv", "venv"]) {
      const venvLib = resolvedWithinRoot(root, venvName, "lib");
      if (venvLib === null) continue;
      let pythonDirs;
      try {
        pythonDirs = readdirSync2(venvLib, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("python")).map((e) => e.name);
      } catch {
        continue;
      }
      for (const pyDir of pythonDirs) {
        const sitePackages = resolvedWithinRoot(root, venvName, "lib", pyDir, "site-packages");
        if (sitePackages === null) continue;
        let distInfoDirs;
        try {
          distInfoDirs = readdirSync2(sitePackages, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.endsWith(".dist-info")).map((e) => e.name);
        } catch {
          continue;
        }
        for (const diName of distInfoDirs) {
          const metadataPath = resolvedWithinRoot(root, venvName, "lib", pyDir, "site-packages", diName, "METADATA");
          if (metadataPath === null) continue;
          let text;
          try {
            text = readFileSync5(metadataPath, "utf8");
          } catch {
            continue;
          }
          const nameField = readMetadataName(text);
          if (nameField === null) continue;
          if (normalizePep503(nameField) !== normalizedPkg) continue;
          return {
            homepage: readHomepageFromMetadata(text),
            documentation: readDocumentationFromMetadata(text),
            repository: void 0
          };
        }
      }
    }
    return null;
  }
};

// packages/core/detector/read-python-cargo.ts
var PYTHON_FRAMEWORKS = ["fastapi", "django", "flask", "sqlalchemy"];
function detectPythonFramework(projectRoot) {
  const deps = pipAdapter.listDirectDeps(projectRoot);
  for (const fw of PYTHON_FRAMEWORKS) {
    if (deps.has(fw)) return fw;
  }
  return null;
}
function readPythonCargo(projectRoot) {
  const tuple = toConfidence(4);
  const baseRules = { applicable: [], skipped: [] };
  if (existsSync5(resolve5(projectRoot, "pyproject.toml"))) {
    const fw = detectPythonFramework(projectRoot);
    return {
      stack: "python",
      framework: { name: fw, version: null, major: null },
      runtime: { name: "python", major: null },
      ...tuple,
      source: "pyproject.toml",
      rules: baseRules,
      // JS known-packages (known-packages.ts) do not apply to a python stack —
      // set explicitly so index.ts does not fall back to the JS missing[] list.
      missing: []
    };
  }
  if (existsSync5(resolve5(projectRoot, "Cargo.toml"))) {
    return {
      stack: "cargo",
      framework: { name: null, version: null, major: null },
      runtime: { name: "cargo", major: null },
      ...tuple,
      source: "Cargo.toml",
      rules: baseRules,
      missing: []
    };
  }
  if (existsSync5(resolve5(projectRoot, "go.mod"))) {
    return {
      stack: "go",
      framework: { name: null, version: null, major: null },
      runtime: { name: "go", major: null },
      ...tuple,
      source: "go.mod",
      rules: baseRules,
      missing: []
    };
  }
  return null;
}

// packages/core/detector/read-config.ts
import { existsSync as existsSync6 } from "node:fs";
import { resolve as resolve6 } from "node:path";
var NEXT_CONFIGS = ["next.config.ts", "next.config.js", "next.config.mjs", "next.config.cjs"];
function readConfig(projectRoot) {
  const tuple = toConfidence(5);
  const baseRules = { applicable: [], skipped: [] };
  for (const cfg of NEXT_CONFIGS) {
    if (existsSync6(resolve6(projectRoot, cfg))) {
      return {
        stack: "react-next",
        framework: { name: "next", version: null, major: null },
        runtime: { name: "node", major: null },
        ...tuple,
        source: cfg,
        rules: baseRules
      };
    }
  }
  if (existsSync6(resolve6(projectRoot, "tsconfig.json"))) {
    return {
      stack: "ts-server",
      framework: { name: null, version: null, major: null },
      runtime: { name: "node", major: null },
      ...tuple,
      source: "tsconfig.json",
      rules: baseRules
    };
  }
  return null;
}

// packages/core/detector/patterns.ts
import { existsSync as existsSync7, readdirSync as readdirSync3, readFileSync as readFileSync6 } from "node:fs";
import { join as join4 } from "node:path";
function hasServerDirectives(projectRoot) {
  const srcDir = join4(projectRoot, "src");
  if (!existsSync7(srcDir)) return false;
  try {
    const entries = readdirSync3(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const content = readFileSync6(join4(srcDir, entry.name), "utf8");
      if (content.includes("'use server'") || content.includes('"use server"') || content.includes("'use client'") || content.includes('"use client"')) {
        return true;
      }
    }
  } catch {
  }
  return false;
}
function isTailwindV3Config(projectRoot) {
  const configFiles = ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs"];
  if (!configFiles.some((f) => existsSync7(join4(projectRoot, f)))) return false;
  const pkgPath = join4(projectRoot, "package.json");
  if (!existsSync7(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync6(pkgPath, "utf8"));
    const allDeps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
    const range = allDeps["tailwindcss"];
    if (!range) return false;
    const major = extractMajor(range);
    return major !== null && major < 4;
  } catch {
    return false;
  }
}
function hasTailwindV4Tokens(projectRoot) {
  const srcDir = join4(projectRoot, "src");
  if (!existsSync7(srcDir)) return false;
  try {
    const entries = readdirSync3(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
      const content = readFileSync6(join4(srcDir, entry.name), "utf8");
      if (content.includes("@theme")) return true;
    }
  } catch {
  }
  return false;
}
function detectPatterns(projectRoot) {
  const detected = [];
  if (existsSync7(join4(projectRoot, "app")) || existsSync7(join4(projectRoot, "src", "app"))) {
    detected.push("nextjs-app-router");
  }
  if (existsSync7(join4(projectRoot, "pages")) || existsSync7(join4(projectRoot, "src", "pages"))) {
    detected.push("nextjs-pages-router");
  }
  if (hasServerDirectives(projectRoot)) {
    detected.push("react-server-components");
  }
  if (isTailwindV3Config(projectRoot)) {
    detected.push("tailwind-v3-config");
  }
  if (hasTailwindV4Tokens(projectRoot)) {
    detected.push("tailwind-v4-css-tokens");
  }
  return detected;
}

// packages/core/detector/index.ts
function detectStack(projectRoot, opts = {}) {
  const root = resolve7(projectRoot);
  const partial = (() => {
    if (!opts.skipAif) {
      const aif = readAif(root);
      if (aif) return aif;
    }
    const manifest = readManifest(root);
    if (manifest) return manifest;
    const pythonCargo = readPythonCargo(root);
    if (pythonCargo) return pythonCargo;
    const config = readConfig(root);
    if (config) return config;
    const tuple = toConfidence(5);
    return {
      stack: "unknown",
      framework: { name: null, version: null, major: null },
      runtime: { name: "node", major: null },
      ...tuple,
      source: "",
      rules: { applicable: [], skipped: [] }
    };
  })();
  return {
    ...partial,
    patterns: detectPatterns(root),
    missing: partial.missing ?? computeMissing(readAllDepsSet(root))
  };
}
var moduleUrl = new URL(new URL("../detector/index.ts", import.meta.url).href).pathname;
if (process.argv[1] && resolve7(process.argv[1]) === resolve7(moduleUrl)) {
  const root = process.argv[2] ?? process.cwd();
  const result = detectStack(root);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

// packages/core/research/ecosystem-npm.ts
import { existsSync as existsSync8, readFileSync as readFileSync7 } from "node:fs";
import { join as join5 } from "node:path";
function isUnsafeDepName2(name) {
  if (name.includes("..")) return true;
  const segments = name.startsWith("@") ? name.split("/") : [name];
  if (name.startsWith("@") && segments.length !== 2) return true;
  return segments.some((s) => s.includes("/") || s.includes("\\"));
}
function installedPkgJsonPath(root, name) {
  if (isUnsafeDepName2(name)) return null;
  const segments = name.startsWith("@") ? name.split("/") : [name];
  return join5(root, "node_modules", ...segments, "package.json");
}
function readInstalledPkgJson(root, name) {
  const p = installedPkgJsonPath(root, name);
  if (p === null) return null;
  if (!existsSync8(p)) return null;
  try {
    return JSON.parse(readFileSync7(p, "utf8"));
  } catch {
    return null;
  }
}
var npmAdapter = {
  ecosystem: "npm",
  listDirectDeps(root) {
    const pkgJsonPath = join5(root, "package.json");
    if (!existsSync8(pkgJsonPath)) return /* @__PURE__ */ new Set();
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync7(pkgJsonPath, "utf8"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
    const deps = pkgJson["dependencies"] ?? {};
    const devDeps = pkgJson["devDependencies"] ?? {};
    const declared = /* @__PURE__ */ new Set([...Object.keys(deps), ...Object.keys(devDeps)]);
    const direct = /* @__PURE__ */ new Set();
    for (const name of declared) {
      if (readInstalledPkgJson(root, name) !== null) {
        direct.add(name);
      }
    }
    return direct;
  },
  readInstalledMeta(root, pkg) {
    const json = readInstalledPkgJson(root, pkg);
    if (json === null) return null;
    const homepage = typeof json["homepage"] === "string" ? json["homepage"] : void 0;
    const repository = json["repository"];
    return { homepage, repository };
  }
};

// packages/core/research/ecosystem-cargo.ts
import { readFileSync as readFileSync8, existsSync as existsSync9 } from "node:fs";
import { join as join6 } from "node:path";
var DEP_TABLE_HEADERS = ["dependencies", "dev-dependencies", "build-dependencies"];
function stripComments2(text) {
  return text.split("\n").map((line) => {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "#" && !inQuotes) {
        return line.slice(0, i);
      }
    }
    return line;
  }).join("\n");
}
function extractInlineTableStringField(inlineTable, field) {
  const re = new RegExp(`\\b${field}\\s*=\\s*"([^"]*)"`);
  const m = inlineTable.match(re);
  return m?.[1];
}
function parseCargoToml(text) {
  const empty = {
    packageFields: /* @__PURE__ */ new Map(),
    depNames: /* @__PURE__ */ new Set(),
    depPathOverride: /* @__PURE__ */ new Map(),
    workspaceMembers: []
  };
  try {
    const stripped = stripComments2(text);
    const lines = stripped.split("\n");
    const sections = [];
    let current = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === "") continue;
      const headerMatch = /^\[([^\]]+)\]$/.exec(line);
      if (headerMatch) {
        current = { header: headerMatch[1].trim(), bodyLines: [] };
        sections.push(current);
        continue;
      }
      if (current) current.bodyLines.push(line);
    }
    const packageFields = /* @__PURE__ */ new Map();
    const depNames = /* @__PURE__ */ new Set();
    const depPathOverride = /* @__PURE__ */ new Map();
    const workspaceMembers = [];
    let packageTableCount = 0;
    for (const section of sections) {
      if (section.header === "package") {
        packageTableCount++;
        if (packageTableCount > 1) {
          packageFields.clear();
          continue;
        }
        for (const line of section.bodyLines) {
          const kv = /^([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"$/.exec(line);
          if (kv) {
            packageFields.set(kv[1], kv[2]);
            continue;
          }
        }
        continue;
      }
      if (DEP_TABLE_HEADERS.includes(section.header)) {
        for (const line of section.bodyLines) {
          const bare = /^([A-Za-z0-9_.-]+)\s*=\s*"[^"]*"$/.exec(line);
          if (bare) {
            depNames.add(bare[1]);
            continue;
          }
          const inline = /^([A-Za-z0-9_.-]+)\s*=\s*\{(.*)\}\s*$/.exec(line);
          if (inline) {
            const name = inline[1];
            depNames.add(name);
            const pathVal = extractInlineTableStringField(inline[2], "path");
            if (pathVal !== void 0) depPathOverride.set(name, pathVal);
            continue;
          }
        }
        continue;
      }
      if (section.header === "workspace") {
        const membersLine = section.bodyLines.find((l) => /^members\s*=/.test(l));
        if (membersLine) {
          const arrMatch = /\[(.*)\]/.exec(membersLine);
          if (arrMatch) {
            const items = arrMatch[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0).map((s) => {
              const strMatch = /^"([^"]*)"$/.exec(s);
              return strMatch?.[1];
            }).filter((s) => s !== void 0);
            workspaceMembers.push(...items);
          }
        }
        continue;
      }
    }
    return { packageFields, depNames, depPathOverride, workspaceMembers };
  } catch {
    return empty;
  }
}
function readManifest2(path) {
  if (!existsSync9(path)) return null;
  let text;
  try {
    text = readFileSync8(path, "utf8");
  } catch {
    return null;
  }
  return parseCargoToml(text);
}
function resolveDepManifestPath(root, pkg, parsedRoot) {
  if (isUnsafeDepName(pkg)) return null;
  const vendorPath = resolvedWithinRoot(root, "vendor", pkg, "Cargo.toml");
  if (vendorPath !== null) {
    const vendorParsed = readManifest2(vendorPath);
    if (vendorParsed?.packageFields.get("name") === pkg) return vendorPath;
  }
  const pathOverride = parsedRoot.depPathOverride.get(pkg);
  if (pathOverride !== void 0) {
    const candidate = resolvedWithinRoot(root, pathOverride, "Cargo.toml");
    if (candidate !== null) {
      const pathParsed = readManifest2(candidate);
      if (pathParsed?.packageFields.get("name") === pkg) return candidate;
    }
  }
  for (const memberDir of parsedRoot.workspaceMembers) {
    const memberManifestPath = resolvedWithinRoot(root, memberDir, "Cargo.toml");
    if (memberManifestPath === null) continue;
    const memberParsed = readManifest2(memberManifestPath);
    if (memberParsed?.packageFields.get("name") === pkg) return memberManifestPath;
  }
  return null;
}
var cargoAdapter = {
  ecosystem: "cargo",
  listDirectDeps(root) {
    const rootManifestPath = join6(root, "Cargo.toml");
    const parsedRoot = readManifest2(rootManifestPath);
    if (parsedRoot === null) return /* @__PURE__ */ new Set();
    const direct = /* @__PURE__ */ new Set();
    for (const name of parsedRoot.depNames) {
      if (resolveDepManifestPath(root, name, parsedRoot) !== null) {
        direct.add(name);
      }
    }
    return direct;
  },
  readInstalledMeta(root, pkg) {
    if (isUnsafeDepName(pkg)) return null;
    const rootManifestPath = join6(root, "Cargo.toml");
    const parsedRoot = readManifest2(rootManifestPath);
    if (parsedRoot === null) return null;
    const depManifestPath = resolveDepManifestPath(root, pkg, parsedRoot);
    if (depManifestPath === null) return null;
    const depParsed = readManifest2(depManifestPath);
    if (depParsed === null) return null;
    if (!depParsed.packageFields.has("name")) return null;
    const homepage = depParsed.packageFields.get("homepage");
    const repository = depParsed.packageFields.get("repository");
    return { homepage, repository };
  }
};

// packages/core/research/ecosystem-go.ts
import { existsSync as existsSync10, readFileSync as readFileSync9 } from "node:fs";
import { join as join7 } from "node:path";
function stripLineComment(raw) {
  const idx = raw.indexOf("//");
  if (idx < 0) return { code: raw.trim(), indirect: false };
  const comment = raw.slice(idx);
  return { code: raw.slice(0, idx).trim(), indirect: /\bindirect\b/.test(comment) };
}
function parseGoModDirectDeps(text) {
  const names = /* @__PURE__ */ new Set();
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const { code: line, indirect: lineIndirect } = stripLineComment(lines[i]);
    i++;
    if (line === "") continue;
    const single = /^require\s+(\S+)\s+(\S+)/.exec(line);
    if (single) {
      if (single[1] === "(") continue;
      if (!lineIndirect) {
        names.add(single[1]);
      }
      continue;
    }
    if (/^require\s*\($/.test(line)) {
      const blockBuf = /* @__PURE__ */ new Set();
      let closed = false;
      while (i < lines.length) {
        const bRaw = lines[i];
        i++;
        const { code: bLine, indirect: bIndirect } = stripLineComment(bRaw);
        if (bLine === ")") {
          closed = true;
          break;
        }
        if (bLine === "") continue;
        const m = /^(\S+)\s+(\S+)/.exec(bLine);
        if (m && !bIndirect) {
          blockBuf.add(m[1]);
        }
      }
      if (closed) {
        for (const name of blockBuf) names.add(name);
      }
    }
  }
  return names;
}
var goAdapter = {
  ecosystem: "go",
  listDirectDeps(root) {
    const goModPath = join7(root, "go.mod");
    if (!existsSync10(goModPath)) return /* @__PURE__ */ new Set();
    let text;
    try {
      text = readFileSync9(goModPath, "utf8");
    } catch {
      return /* @__PURE__ */ new Set();
    }
    return parseGoModDirectDeps(text);
  },
  readInstalledMeta(_root, pkg) {
    if (isUnsafeDepName(pkg, "go-feed-raw")) return null;
    const url = `https://${pkg}`;
    return { homepage: url, repository: url };
  }
};

// packages/core/synthesizer/resolve-ctx.ts
function resolveCtxForRoot(root) {
  const { stack } = detectStack(root, { skipAif: true });
  if (stack === "python") return { root, adapter: pipAdapter };
  if (stack === "cargo") return { root, adapter: cargoAdapter };
  if (stack === "go") return { root, adapter: goAdapter };
  return { root, adapter: npmAdapter };
}

// packages/core/synthesizer/file-clients.ts
var FileResearchClient = class {
  constructor(planPath) {
    this.planPath = planPath;
  }
  planPath;
  async research(_detection) {
    const raw = readFileSync10(this.planPath, "utf8");
    const parsed = JSON.parse(raw);
    validateResearchPlan(parsed, resolveCtxForRoot(process2.cwd()));
    return parsed;
  }
};
var FileGenerateClient = class {
  constructor(selectionPath) {
    this.selectionPath = selectionPath;
  }
  selectionPath;
  async generate(_menu) {
    const raw = readFileSync10(this.selectionPath, "utf8");
    return JSON.parse(raw);
  }
};
function routesToManual(c) {
  const declarative = c.presence === "forbid" && Boolean(c.selector);
  const hasEslintConfig = c.eslintConfig !== void 0 && Object.keys(c.eslintConfig).length > 0;
  return !declarative && !hasEslintConfig;
}
function withManualDrop(inner, log = (m) => process2.stderr.write(m + "\n")) {
  return {
    async generate(menu) {
      const selection = await inner.generate(menu);
      const rules2 = [];
      for (const c of selection.rules) {
        if (routesToManual(c)) {
          log(
            `[rule-bootstrap] practice '${c.entryId}' researched but not L4-expressible (no forbid-selector, no eslintConfig) \u2014 recorded as research-only, NOT shipped as a rule.`
          );
          continue;
        }
        rules2.push(c);
      }
      return { rules: rules2 };
    }
  };
}

// packages/core/synthesizer/render-researched-astgrep.ts
import {
  existsSync as existsSync11,
  mkdirSync,
  readFileSync as readFileSync12,
  writeFileSync
} from "node:fs";
import { dirname as dirname4, join as join8, relative, resolve as resolve9 } from "node:path";
import { fileURLToPath as fileURLToPath4, pathToFileURL } from "node:url";

// packages/core/backends/astgrep/render-astgrep.ts
init_registry();
init_render_outcome();
var VALID_KINDS = ["call", "attribute", "import"];
var BACKEND_NAME = "astgrep-python-yaml";
var SEVERITY_TO_ASTGREP = {
  error: "error",
  warning: "warning",
  note: "hint"
};
function isValidParams(params) {
  const kind = params["kind"];
  const pattern = params["pattern"];
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind)) return false;
  if (typeof pattern !== "string" || pattern.length === 0) return false;
  return true;
}
function missingOrInvalidField(params) {
  const kind = params["kind"];
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind)) return "kind";
  const pattern = params["pattern"];
  if (typeof pattern !== "string" || pattern.length === 0) return "pattern";
  return "unknown";
}
function yamlDq(s) {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
var HEADER = "# generated by getff astgrep backend v0 \u2014 do not edit by hand";
function renderAstgrep(nodes) {
  const outcomes = /* @__PURE__ */ new Map();
  const entries = [];
  for (const n of nodes) {
    if (n.selectorClass === "type-aware" || n.selectorClass === "dep-graph") {
      const note = n.selectorClass === "type-aware" ? "type-aware bans need a type checker; route to the mypy backend (deferred, post-v0)" : "dependency-graph bans need import analysis; route to the import-linter backend (deferred, post-v0)";
      outcomes.set(n.id, { kind: "refused", code: "FF7001", note });
      diag("FF7001", { backend: BACKEND_NAME, selectorClass: n.selectorClass, nodeId: n.id });
      continue;
    }
    if (!isValidParams(n.params)) {
      const missing = missingOrInvalidField(n.params);
      outcomes.set(n.id, {
        kind: "refused",
        code: "FF7002",
        note: `params contract violation: missing/invalid ${missing}`
      });
      diag("FF7002", { backend: BACKEND_NAME, nodeId: n.id, missing });
      continue;
    }
    const params = n.params;
    entries.push({
      id: n.id,
      severity: SEVERITY_TO_ASTGREP[n.defaultSeverity],
      message: n.claim,
      // message is ALWAYS node.claim — params carry no message (spec §4).
      kind: params.kind,
      pattern: params.pattern,
      ...params.replacement !== void 0 ? { replacement: params.replacement } : {},
      // OWNER-FORK-1 Option B (ir-unfreeze S2): carry the optional relational tree through
      // untouched. astgrep NEVER refuses a well-formed relational node (ast-grep IS the
      // relational vocabulary) — every relational tree renders; see renderRelationalArm.
      ...n.relational !== void 0 ? { relational: n.relational } : {}
    });
    outcomes.set(n.id, { kind: "rendered", surfaces: [{ surface: "rule", content: n.id }] });
  }
  assertEveryNodeResolved(
    nodes.map((n) => n.id),
    outcomes
  );
  const yaml = renderYaml(entries);
  return { yaml, outcomes };
}
function renderRule(e) {
  const lines = [
    `id: ${yamlDq(e.id)}`,
    "language: python",
    `severity: ${e.severity}`,
    `message: ${yamlDq(e.message)}`,
    "metadata:",
    `  kind: ${e.kind}`,
    "rule:",
    `  pattern: ${yamlDq(e.pattern)}`
  ];
  if (e.relational !== void 0) {
    lines.push(...renderRelationalNode(e.relational, "  "));
  }
  if (e.replacement !== void 0) {
    lines.push(`fix: ${yamlDq(e.replacement)}`);
  }
  return lines.join("\n");
}
function assertNever(x) {
  throw new Error(`unexpected relational op: ${JSON.stringify(x)}`);
}
function renderRelationalNode(rule, indent) {
  const inner = indent + "  ";
  switch (rule.op) {
    case "has": {
      const lines = [`${indent}has:`];
      if (rule.kind !== void 0) lines.push(`${inner}kind: ${yamlDq(rule.kind)}`);
      lines.push(`${inner}pattern: ${yamlDq(rule.pattern)}`);
      lines.push(`${inner}stopBy: end`);
      return lines;
    }
    case "not": {
      if (rule.children.length === 1) {
        const only = rule.children[0];
        if (only === void 0) throw new Error('renderRelationalNode(): "not" child unexpectedly undefined');
        return [`${indent}not:`, ...renderRelationalNode(only, inner)];
      }
      return [`${indent}not:`, `${inner}any:`, ...renderRelationalList(rule.children, inner + "  ")];
    }
    case "all":
      return [`${indent}all:`, ...renderRelationalList(rule.children, inner)];
    case "any":
      return [`${indent}any:`, ...renderRelationalList(rule.children, inner)];
    default:
      return assertNever(rule);
  }
}
function renderRelationalList(children, itemIndent) {
  const out = [];
  for (const child of children) {
    const childLines = renderRelationalNode(child, itemIndent + "  ");
    const first = childLines[0];
    if (first === void 0) continue;
    out.push(`${itemIndent}- ${first.slice((itemIndent + "  ").length)}`);
    out.push(...childLines.slice(1));
  }
  return out;
}
function renderYaml(entries) {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const docs = [HEADER + "\n" + sorted.map(renderRule).join("\n---\n")];
  const body = sorted.length === 0 ? HEADER : docs[0];
  return body + "\n";
}

// packages/core/synthesizer/research-to-node.ts
init_grammar();
init_allowlist_resolver();
var EXPRESSIBLE_KINDS = ["call", "attribute", "import"];
function isSinglePatternExpressible(p) {
  return p.presence === "forbid" && typeof p.pattern === "string" && p.pattern.length > 0 && typeof p.kind === "string" && EXPRESSIBLE_KINDS.includes(p.kind);
}
function researchedPracticeToNode(practice, ctx) {
  if (!isSinglePatternExpressible(practice)) {
    return {
      status: "research-only",
      entryId: practice.entryId,
      reason: "not-expressible",
      detail: `not single-pattern call/attribute/import-ban expressible (kind=${String(practice.kind)}, presence=${String(practice.presence)}, pattern=${practice.pattern ? "present" : "absent"}) \u2014 \xA7Qb frozen-IR ceiling`
    };
  }
  const resolved = resolveAllowedSources(ctx);
  const provReject = firstProvenanceRejection(practice.provenance, resolved);
  if (provReject !== null) {
    return {
      status: "research-only",
      entryId: practice.entryId,
      reason: "provenance-rejected",
      detail: provReject
    };
  }
  const node = buildAstgrepNode(practice);
  const gate = runGrammarGate([node]);
  if (gate.status !== "pass") {
    return {
      status: "research-only",
      entryId: practice.entryId,
      reason: "gate-failed",
      detail: gate.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; ")
    };
  }
  return { status: "node", node };
}
var DEFAULT_SEVERITY = "error";
function buildAstgrepNode(practice) {
  const params = {
    kind: practice.kind,
    pattern: practice.pattern
  };
  if (practice.replacement !== void 0) {
    params["replacement"] = practice.replacement;
  }
  return {
    id: practice.entryId,
    claim: practice.title,
    anchors: [],
    selectorClass: "syntax",
    params,
    defaultSeverity: practice.defaultSeverity ?? DEFAULT_SEVERITY,
    provenance: practice.provenance,
    pairedExamples: {
      negative: practice.examples.bad,
      positive: practice.examples.good
    }
  };
}
function firstProvenanceRejection(provenance, resolved) {
  if (provenance.length === 0) {
    return "no provenance record \u2014 cannot resolve a trusted documentation source";
  }
  for (const p of provenance) {
    const opts = p.packageName !== void 0 ? { entryPackage: p.packageName } : void 0;
    const d = validateProvenance(p, resolved, opts);
    if (d !== null) return d.message;
  }
  return null;
}

// packages/core/synthesizer/render-researched-astgrep.ts
var HERE3 = dirname4(fileURLToPath4(new URL("../synthesizer/render-researched-astgrep.ts", import.meta.url).href));
var LIVE_GEN_DIR = resolve9(HERE3, "fixtures/live-generation");
var PRACTICE_RECORDS = [
  "getff-researched-no-yaml-load.practice.json"
];
function renderedRulePath(ruleId) {
  return join8("firing", "rules", `${ruleId}.yml`);
}
function loadPracticeRecord(absPath) {
  return JSON.parse(readFileSync12(absPath, "utf8"));
}
function planResearchedAstgrep(practices, ctx) {
  const rendered = [];
  const researchOnly = [];
  for (const practice of practices) {
    const result = researchedPracticeToNode(practice, ctx);
    if (result.status !== "node") {
      researchOnly.push({
        entryId: result.entryId,
        reason: result.reason,
        detail: result.detail
      });
      continue;
    }
    const { yaml, outcomes } = renderAstgrep([result.node]);
    const outcome = outcomes.get(result.node.id);
    if (outcome?.kind !== "rendered") {
      throw new Error(
        `planResearchedAstgrep(): ${result.node.id} passed the bridge but renderAstgrep ${outcome?.kind ?? "produced no outcome for"} it`
      );
    }
    rendered.push({
      entryId: result.node.id,
      path: renderedRulePath(result.node.id),
      yaml
    });
  }
  const seenIds = /* @__PURE__ */ new Set();
  const seenPaths = /* @__PURE__ */ new Set();
  for (const rule of rendered) {
    if (seenIds.has(rule.entryId) || seenPaths.has(rule.path)) {
      throw new Error(
        `planResearchedAstgrep(): duplicate rendered entryId "${rule.entryId}" \u2192 ${rule.path} (two practices render to the same committed artifact; writeResearchedAstgrep would clobber one)`
      );
    }
    seenIds.add(rule.entryId);
    seenPaths.add(rule.path);
  }
  return { rendered, researchOnly };
}
function planFromCommittedRecords(liveGenDir = LIVE_GEN_DIR) {
  const practices = PRACTICE_RECORDS.map(
    (r) => loadPracticeRecord(join8(liveGenDir, r))
  );
  return planResearchedAstgrep(practices);
}
function writeResearchedAstgrep() {
  const plan = planFromCommittedRecords();
  for (const rule of plan.rendered) {
    const abs = join8(LIVE_GEN_DIR, rule.path);
    mkdirSync(dirname4(abs), { recursive: true });
    writeFileSync(abs, rule.yaml);
  }
  return plan;
}
function checkResearchedAstgrepDrift(liveGenDir = LIVE_GEN_DIR) {
  const plan = planFromCommittedRecords(liveGenDir);
  const findings = [];
  for (const rule of plan.rendered) {
    const abs = join8(liveGenDir, rule.path);
    if (!existsSync11(abs)) {
      findings.push({ path: rule.path, reason: "missing" });
      continue;
    }
    if (readFileSync12(abs, "utf8") !== rule.yaml) {
      findings.push({ path: rule.path, reason: "byte-mismatch" });
    }
  }
  return findings;
}
function runRenderCli(config) {
  const check = process.argv.includes("--check");
  const plan = config.plan(!check);
  for (const finding of plan.researchOnly) {
    process.stderr.write(
      `research-only (${finding.reason}): ${finding.entryId} \u2014 ${finding.detail}
`
    );
  }
  if (check) {
    const drift = config.drift();
    if (drift.length === 0) {
      process.stdout.write(`researched ${config.backend} artifacts up-to-date
`);
      process.exit(0);
    }
    process.stderr.write(`\u274C researched ${config.backend} artifact drift detected:
`);
    for (const d of drift) process.stderr.write(`  ${d.reason}: ${d.path}
`);
    process.stderr.write(
      `Run: npx tsx packages/core/synthesizer/render-researched-${config.backend}.ts
`
    );
    process.exit(1);
  }
  process.stdout.write(config.summary(plan));
  process.exit(0);
}
function main() {
  runRenderCli({
    backend: "astgrep",
    plan: (write) => write ? writeResearchedAstgrep() : planFromCommittedRecords(),
    drift: () => checkResearchedAstgrepDrift(),
    summary: (plan) => `rendered ${plan.rendered.length} researched rule(s), ${plan.researchOnly.length} research-only finding(s) under ${relative(resolve9(HERE3, "../.."), LIVE_GEN_DIR)}/
` + plan.rendered.map((rule) => `  ${rule.path}
`).join("")
  });
}
var isMain = Boolean(process.argv[1]) && new URL("../synthesizer/render-researched-astgrep.ts", import.meta.url).href === pathToFileURL(process.argv[1]).href;
if (isMain) main();

// packages/core/install/rule-bootstrap-cli.ts
init_tier();
function parseArgs(argv) {
  const args = { consumerRoot: process3.cwd(), force: true, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--consumer-root") args.consumerRoot = argv[++i] ?? args.consumerRoot;
    else if (a === "--no-force") args.force = false;
    else if (a === "--strict") args.strict = true;
    else if (a === "--from-research") args.fromResearch = argv[++i];
    else if (a === "--from-selection") args.fromSelection = argv[++i];
    else if (a === "--from-practice") args.fromPractice = argv[++i];
    else if (a === "-h" || a === "--help") {
      process3.stdout.write(
        "Usage: rule-bootstrap-cli [--consumer-root <path>] [--from-research <plan.json>] [--from-selection <sel.json>] [--from-practice <rec.practice.json|dir>] [--no-force] [--strict]\n"
      );
      process3.exit(0);
    } else if (!a.startsWith("-")) args.consumerRoot = a;
  }
  return args;
}
function rulesResearchDirOf(consumerRoot) {
  return join9(consumerRoot, ".getff", "rules-research");
}
var PracticeEntryIdError = class extends Error {
  constructor(entryId, why) {
    super(
      `unsafe practice entryId ${JSON.stringify(entryId)}: ${why}. entryId must be a rule-id slug (^[a-z][a-z0-9-]*$, e.g. 'getff-researched-no-yaml-load') \u2014 it becomes the rendered rule's filename, so path separators, '..', absolute paths and other non-slug characters are refused.`
    );
    this.name = "PracticeEntryIdError";
  }
};
var PracticeJoinError = class extends Error {
  constructor(entryId, found) {
    super(
      `S1b PF-1 park: rendered entryId '${entryId}' must join exactly 1 practice record, found ${found}. Known shape: two *.practice.json files sharing an entryId where only one is expressible (the plan-time dup guard sees rendered entries only). Rename one record's entryId. Nothing was written.`
    );
    this.name = "PracticeJoinError";
  }
};
var RULE_ID_SLUG = /^[a-z][a-z0-9-]*$/;
function safeRenderedPath(rulesResearchDir, entryId) {
  if (typeof entryId !== "string" || entryId.length === 0) {
    throw new PracticeEntryIdError(String(entryId), "empty or non-string");
  }
  if (!RULE_ID_SLUG.test(entryId)) {
    throw new PracticeEntryIdError(entryId, "not a rule-id slug (^[a-z][a-z0-9-]*$)");
  }
  const outPath = resolve15(rulesResearchDir, `${entryId}.yml`);
  const base = rulesResearchDir.endsWith(sep2) ? rulesResearchDir : rulesResearchDir + sep2;
  const rel = relative2(rulesResearchDir, outPath);
  if (!outPath.startsWith(base) || rel.startsWith("..") || rel.includes(sep2)) {
    throw new PracticeEntryIdError(entryId, `resolved path escapes ${rulesResearchDir}`);
  }
  return outPath;
}
function loadPracticeRecords(src) {
  if (!existsSync14(src)) {
    throw new Error(`practice input not found: ${src}`);
  }
  if (statSync3(src).isDirectory()) {
    const files = readdirSync4(src).filter((f) => f.endsWith(".practice.json")).sort();
    if (files.length === 0) {
      throw new Error(`no *.practice.json practice records in directory: ${src}`);
    }
    return files.map(
      (f) => JSON.parse(readFileSync16(join9(src, f), "utf8"))
    );
  }
  return [JSON.parse(readFileSync16(src, "utf8"))];
}
function runPracticeRender(opts) {
  const log = opts.log ?? ((m) => process3.stderr.write(m + "\n"));
  const records = loadPracticeRecords(opts.fromPractice);
  const ctx = resolveCtxForRoot(opts.consumerRoot);
  const plan = planResearchedAstgrep(records, ctx);
  for (const finding of plan.researchOnly) {
    log(
      `[rule-bootstrap] practice '${finding.entryId}' researched but not rendered (${finding.reason}): ${finding.detail} \u2014 recorded as research-only, NOT shipped as a rule.`
    );
  }
  const outDir = rulesResearchDirOf(opts.consumerRoot);
  const targets = plan.rendered.map((rule) => {
    const matches2 = records.filter((r) => r.entryId === rule.entryId);
    if (matches2.length !== 1) throw new PracticeJoinError(rule.entryId, matches2.length);
    return { rule, outPath: safeRenderedPath(outDir, rule.entryId), record: matches2[0] };
  });
  const rendered = [];
  for (const { rule, outPath } of targets) {
    mkdirSync4(outDir, { recursive: true });
    writeFileSync4(outPath, rule.yaml);
    rendered.push({ entryId: rule.entryId, path: outPath });
  }
  const fragDir = resolve15(
    opts.consumerRoot,
    ".ai-factory",
    "synthesizer-output",
    "generation-context",
    "python"
  );
  for (const { rule, record } of targets) {
    const stampedProv = stampProvenanceTier(record.provenance);
    const ruleTier = weakestTier(stampedProv);
    const fragment = { id: rule.entryId, provenance: stampedProv, tier: ruleTier };
    mkdirSync4(fragDir, { recursive: true });
    writeFileSync4(resolve15(fragDir, `${rule.entryId}.json`), JSON.stringify(fragment) + "\n");
    log(
      `[rule-bootstrap] wrote generation-context/python/${rule.entryId}.json (tier=${ruleTier}, ${stampedProv.length} provenance source(s))`
    );
  }
  return { mode: "practice-render", rendered, researchOnly: plan.researchOnly };
}
async function main2() {
  const args = parseArgs(process3.argv.slice(2));
  if (args.fromPractice && (args.fromResearch || args.fromSelection)) {
    process3.stderr.write(
      "rule-bootstrap-cli: --from-practice cannot be combined with --from-research/--from-selection\n"
    );
    process3.exit(args.strict ? 1 : 0);
  }
  const oneOnly = Boolean(args.fromResearch) !== Boolean(args.fromSelection);
  if (oneOnly) {
    process3.stderr.write(
      "rule-bootstrap-cli: --from-research and --from-selection must be passed together\n"
    );
    process3.exit(args.strict ? 1 : 0);
  }
  if (args.fromPractice) {
    try {
      const result = runPracticeRender({
        consumerRoot: args.consumerRoot,
        fromPractice: args.fromPractice
      });
      process3.stdout.write(JSON.stringify(result, null, 2) + "\n");
      if (args.strict && result.rendered.length === 0) process3.exit(1);
      return;
    } catch (err) {
      if (err instanceof PracticeEntryIdError) {
        process3.stderr.write(`[rule-bootstrap] REFUSED \u2014 ${err.message}
`);
        process3.exit(1);
      }
      if (err instanceof PracticeJoinError) {
        process3.stderr.write(`[rule-bootstrap] ${err.message}
`);
        process3.exit(1);
      }
      process3.stderr.write(
        `[rule-bootstrap] practice record invalid or unreadable \u2014 ${err.message}
[rule-bootstrap] a valid input is an AstgrepResearchedPractice JSON record (schema: packages/core/synthesizer/research-to-node.ts; committed example: packages/core/synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json) \u2014 fix or re-author it, then re-run --from-practice.
`
      );
      process3.exit(args.strict ? 1 : 0);
    }
  }
  const live = Boolean(args.fromResearch && args.fromSelection);
  const clients = live ? {
    researchClient: new FileResearchClient(args.fromResearch),
    generateClient: withManualDrop(new FileGenerateClient(args.fromSelection))
  } : {};
  const { runRuleBootstrap: runRuleBootstrap2 } = await Promise.resolve().then(() => (init_rule_bootstrap(), rule_bootstrap_exports));
  try {
    const result = await runRuleBootstrap2({
      consumerRoot: args.consumerRoot,
      force: args.force,
      ...clients
    });
    process3.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (args.strict) {
      const ok = result.mode === "synthesis" && result.install.ok;
      if (!ok) process3.exit(1);
    }
  } catch (err) {
    const why = err instanceof ResearchPlanError ? err.message : err.message;
    process3.stderr.write(
      `[rule-bootstrap] live research artefact invalid or unreadable \u2014 ${why}
[rule-bootstrap] run the rule-research protocol (agents/rule-researcher.md or the rule-research skill) to (re)author the two files, then re-run ./setup --full.
`
    );
    process3.exit(args.strict ? 1 : 0);
  }
}
function isDirectRun(argv1, metaUrl) {
  if (!argv1) return false;
  const metaPath = fileURLToPath7(metaUrl);
  try {
    return realpathSync2(argv1) === realpathSync2(metaPath);
  } catch {
    return metaPath === argv1;
  }
}
if (isDirectRun(process3.argv[1], import.meta.url)) {
  main2().catch((err) => {
    process3.stderr.write(`rule-bootstrap-cli failed: ${err.message}
`);
    process3.exit(1);
  });
}
export {
  PracticeEntryIdError,
  PracticeJoinError,
  isDirectRun,
  rulesResearchDirOf,
  runPracticeRender,
  safeRenderedPath
};
