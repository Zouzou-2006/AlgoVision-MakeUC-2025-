
# agent.md — Code-Structure Visualizer (v1)

## Objective
Build a **client-only** web app that parses **Python** and **C#** with **Tree-sitter (WASM)** in a **Web Worker**, constructs a language-agnostic **IR**, and renders **Mermaid** diagrams (**flowchart CFG**, **call graph**, **class diagram**). No backend.

**Out of scope (v1):** type/semantic resolution, project-wide graphs, refactors, overload/type binding.

---

## Tech stack
- App: **React + Vite + TypeScript**
- Editor: **Monaco**
- Parsing: **web-tree-sitter**, grammars: **tree-sitter-python**, **tree-sitter-c-sharp**
- Diagrams: **Mermaid**
- Optional: File System Access API (Chrome/Edge)

---

## Repo layout (create exactly)
```

app/
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ ui/
│  │  ├─ App.tsx
│  │  ├─ Editor.tsx
│  │  ├─ OutlinePanel.tsx
│  │  ├─ Diagram.tsx
│  │  └─ Toolbar.tsx
│  ├─ core/
│  │  ├─ ir.ts
│  │  ├─ renderers.ts
│  │  ├─ escape.ts
│  │  └─ selection.ts
│  ├─ workers/
│  │  ├─ parser.worker.ts
│  │  ├─ ts-init.ts
│  │  ├─ lang-python.ts
│  │  └─ lang-csharp.ts
│  └─ assets/samples/
└─ vite.config.ts

````

---

## Non-negotiable rules (follow exactly)
1. **All ranges are 1-based line/column** in IR and diagnostics. Worker converts from byte offsets once.
2. Implement **init + incremental parse + cancel**:
   - `init` preloads grammars/WASM and returns `coldStartMs`.
   - Edits use `tree.edit()` and `parser.parse(prevTree)`.
   - `requestId` for `analyze`; **last-writer-wins**; send `cancelled` for superseded requests.
3. **Escape all labels** for Mermaid, and **sanitize node IDs**. Never inject raw code/HTML.
4. Enforce **render cap**: if diagram nodes > **300**, skip render and emit diagnostic; still provide “Export Mermaid”.
5. Performance targets apply to **warm runs** only; report `coldStartMs` separately.

---

## Public protocol (copy exactly)

### Requests (UI → Worker)
```ts
type InitRequest = { kind: "init" };

type OpenDocRequest = {
  kind: "openDoc";
  docId: string;
  language: "python" | "csharp";
  text: string;
  version: number;
};

type ApplyEditsRequest = {
  kind: "applyEdits";
  docId: string;
  version: number;
  edits: Array<{ range: { startLine: number; startColumn: number; endLine: number; endColumn: number }; text: string; }>;
  analyze?: boolean;
  options?: AnalyzeOptions;
};

type AnalyzeRequest = {
  kind: "analyze";
  docId: string;
  requestId: string;
  options?: AnalyzeOptions;
};

type CancelRequest = { kind: "cancel"; requestId: string };
type CloseDocRequest = { kind: "closeDoc"; docId: string };

type AnalyzeOptions = {
  maxNodes?: number;                // default 2000
  includeClassDiagram?: boolean;
  includeCallGraph?: boolean;
};
````

### Responses (Worker → UI)

```ts
type InitDone = { kind: "init:done"; coldStartMs: number };

type AnalyzeResponse = {
  kind: "result";
  requestId: string;
  docId: string;
  language: "python" | "csharp";
  ir: IRDocument;
  diagnostics: Diagnostic[];
  perf: { parseMs: number; irMs: number; renderCapHit?: boolean; totalMs: number };
};

type Cancelled = { kind: "cancelled"; requestId: string };

type Diagnostic = {
  severity: "info" | "warn" | "error";
  code: "TS_PARSE_ERROR" | "NODE_CAP_REACHED" | "UNSUPPORTED_CONSTRUCT" | "MERMAID_ESCAPE" | "RENDER_CAP_REACHED" | "CANCELLED" | "INTERNAL";
  message: string;
  range?: IRRange;
  details?: Record<string, unknown>;
};
```

---

## IR types (copy exactly into `src/core/ir.ts`)

```ts
export type IRDocument = {
  outline: IROutlineNode[];
  cfgs: IRCFG[];
  calls: IRCall[];
  classes: IRClass[];
  imports: IRImport[];
};

export type IROutlineNode = {
  id: string; // f:bar@12#1, m:Foo.Bar@37#2, c:Foo@10#1
  kind: "module" | "namespace" | "class" | "struct" | "function" | "method";
  name: string;
  parentId?: string;
  range: IRRange;
  params?: string[];
  visibility?: "public" | "protected" | "private" | "internal";
  genericParams?: string[];
};

export type IRCFG = {
  funcId: string; // outline.id
  nodes: IRNode[];
  edges: IREdge[]; // [fromId, toId, label?]
};

export type IRNode =
  | { id: string; type: "start" | "end" }
  | { id: string; type: "stmt"; label: string; range?: IRRange }
  | { id: string; type: "cond"; label: string; range?: IRRange }
  | { id: string; type: "switch"; label: string; cases: string[]; range?: IRRange };

export type IREdge = [fromId: string, toId: string, label?: string];

export type IRCall = { callerId: string; calleeName: string; kind: "direct" | "member" };

export type IRClass = {
  id: string; name: string; methods: string[]; bases?: string[];
};

export type IRImport = { name: string; alias?: string };

export type IRRange = {
  startLine: number; startCol: number; endLine: number; endCol: number;
};
```

**ID policy:** add `#k` per file to ensure uniqueness when multiple items share a line.

---

## Language mappings (implement in visitors)

### Python (`lang-python.ts`)

* Decls: `class_definition`, `function_definition` (+ implicit module).
* Control: `if_statement` (+ `elif`/`else`), `for_statement`, `while_statement`, `try_statement`, `with_statement`.
* Calls: `call` → last identifier of `identifier`/`attribute` (`a.b.c()` → `c`).
* Imports: `import_name`, `import_from`.
* Extras: `yield` → `stmt`. `match/case` (if grammar supports) → IR `switch` with cases; else emit `UNSUPPORTED_CONSTRUCT`.
* Loops: `continue` → loop test; `break` → node after loop; early `return`/`raise` → edge to `end`.

### C# (`lang-csharp.ts`)

* Namespaces/Types: `namespace_declaration`, `class_declaration`, `struct_declaration`.
* Members: `method_declaration`, `local_function_statement`.
* Control: `if_statement`, `switch_statement` (collect `case_switch_label` / `default_switch_label`), `for_statement`, `foreach_statement`, `while_statement`, `try_statement`, `using_statement`.
* Calls: `invocation_expression` → last identifier from `identifier` or `member_access_expression`.
* Usings: `using_directive`.
* Visibility: map modifiers to `visibility`.
* Fallthrough: honor `goto case` edges; otherwise **no** fallthrough between cases.

**Name resolution (both):** textual only (no alias/overload/type/extension binding). Inter-file matching is out of scope v1.

---

## IR construction rules (implement in both visitors)

* Always emit `start` and `end` in every CFG with edges `start → first`, `last → end`.
* `cond` gets `true/false` edges.
* `switch` gets one edge per case, including `"default"`, with labels `"case: X"` or `"default"`.
* Label policy: trim, collapse whitespace, wrap ~40 chars, cap 80, newline→space, long literals → `…`.
* Caps: stop at `maxNodes` (default 2000). Insert `stmt: "⋯ (truncated)"` and add diagnostic `NODE_CAP_REACHED { skipped }`.

---

## Mermaid rendering (`src/core/renderers.ts`)

* If total nodes > **300**, **do not render**; return empty diagram + diagnostic `RENDER_CAP_REACHED` (UI still offers “Export Mermaid”).
* **escapeForMermaid(label: string)** (in `escape.ts`): escape backticks, quotes, braces, arrows `--`, `-->`, `:::`, backslashes.
* **idSanitizer(id: string)**: stable hashed alnum IDs; keep a map `mermaidId → IRNode.id` for click-back.
* Flowchart: `flowchart TD`; `start/end` rounded; `cond` diamond; `switch` diamond with case edges.
* Call graph: `graph TD` from IR calls; node names from outline.
* Class diagram (C# v1): `classDiagram` with **public methods** (`+`). Optionally include `#/-/~` if present.

---

## UI behavior

* Tabs: **Outline | Flowchart | Call Graph | Class Diagram**.
* Outline click → ask worker to analyze selected symbol’s function/method; highlight Monaco range.
* Diagram node click → map back to IR range → scroll Monaco to **exact 1-based range**.
* Debounce typing **500 ms** or explicit “Analyze”.
* Toolbar: language selector, `maxNodes`, Analyze, Export Mermaid, Copy SVG/PNG.
* Diagnostics: toast + underline in Monaco via `range`.

---

## Performance & metrics

* `init:done` includes `coldStartMs`.
* Warm analyze target (1000 LOC): **parse ≤300 ms**, **IR ≤100 ms**, **render ≤200 ms**.
* Incremental small edit in a function: **≤60 ms** end-to-end.
* `perf` object must be filled in `AnalyzeResponse`.

---

## Security

* No HTML labels in Mermaid.
* All labels escaped; sanitize IDs.
* All parsing in worker; main thread handles sanitized strings only.
* No code execution.

---

## Minimal fixtures (place in `assets/samples/`)

### `sample.py`

```py
class Foo:
    def bar(self, x, y):
        if x > y:
            return x
        for i in range(y):
            if i == 3: break
            x += i
        return x

def baz(z):
    return z*z
```

### `Sample.cs`

```csharp
namespace Demo {
  class Foo {
    public int Bar(int x, int y) {
      switch (x) { case 0: return y; default: break; }
      if (x > y) return x; else return y;
    }
    void LocalUse() {
      int G(int t) { return t+1; } // local function
      G(1);
    }
  }
}
```

---

## Phase plan (generate in order)

### Phase 1 — Bootstrap worker & grammar init

* Files: `workers/parser.worker.ts`, `workers/ts-init.ts`, `vite.config.ts`.
* Implement message loop for `init`, `openDoc`, `applyEdits`, `analyze`, `cancel`, `closeDoc`.
* Track per-doc `{ text, version, tree, language }`.
* **Done when:** `init:done` returns `coldStartMs`; `openDoc` + `analyze` returns empty IR and no errors.

### Phase 2 — IR & escaping

* Files: `core/ir.ts`, `core/escape.ts`, add unit tests (if using vitest).
* Implement `escapeForMermaid`, `idSanitizer`.
* **Done when:** escaping tests pass for backticks/quotes/braces/arrows/backslashes.

### Phase 3 — Python visitor

* File: `workers/lang-python.ts`.
* Implement outline, CFG, calls, imports, loop edges, returns, caps.
* **Done when:** `sample.py` produces outline, one `cond` in `bar`, ≥1 call edge (`bar` or `baz` context), no crashes.

### Phase 4 — C# visitor

* File: `workers/lang-csharp.ts`.
* Implement outline, visibility, `switch` with `default` and `goto case`, local functions in call graph.
* **Done when:** `Sample.cs` flowchart has a `switch` diamond and `default` edge; class diagram lists `Foo` with `+Bar(int,int)`; call edge `LocalUse → G`.

### Phase 5 — Mermaid builders

* File: `core/renderers.ts`.
* Build `cfgToMermaid`, `callsToMermaid`, `classesToMermaid` with caps and escaping.
* **Done when:** rendering large dummy graph triggers `RENDER_CAP_REACHED`.

### Phase 6 — React UI

* Files: `ui/*`, `main.tsx`, `index.html`.
* Monaco editor with language switch; tabs; selection sync both ways.
* Debounce 500 ms applyEdits(analyze:true).
* **Done when:** fixtures render correctly; clicking diagram scrolls to correct Monaco range.

---

## Acceptance tests (manual or automated)

1. **Python fixture**

   * Outline lists module/class/functions with 1-based ranges.
   * Flowchart for `bar` includes `cond`, loop, early `break`, `return`.
   * Call graph has at least one `caller → callee` edge.

2. **C# fixture**

   * Outline lists namespace/class/methods.
   * Flowchart for `Bar` shows `switch` with `case 0` and `default`.
   * Class diagram lists `Foo` with `+Bar(int,int)`.
   * Call graph edge `LocalUse → G`.

3. **Perf (warm)**

   * 1000 LOC synthetic file: parse ≤300 ms, IR ≤100 ms, render ≤200 ms.
   * Report `coldStartMs` at init.

4. **Safety**

   * Labels with special chars render correctly; no Mermaid breakage.
   * Diagrams >300 nodes don’t render; diagnostic shown; “Export Mermaid” still outputs text.

---

## Diagnostics to emit (with examples)

* `TS_PARSE_ERROR`: syntax error; include nearest node’s range.
* `NODE_CAP_REACHED`: `{ skipped: number, maxNodes }`.
* `UNSUPPORTED_CONSTRUCT`: e.g., Python `match/case` if grammar unsupported.
* `MERMAID_ESCAPE`: label sanitized; include `originalLength`.
* `RENDER_CAP_REACHED`: `{ nodeCount }`.
* `CANCELLED`: request superseded.

---

## Code quality

* TypeScript strict mode on.
* No `any` in public types.
* Small pure functions; no side-effects in renderers.
* Unit tests (if available) for escaping and basic builders.

---

## Commit guidance (for multi-step generation)

* One phase per commit with message: `feat(worker): init + protocol`, `feat(py): visitor + CFG`, etc.

---

## Known limitations (document in README)

* Textual call resolution only; no alias/import/overload binding.
* Exceptions modeled linearly; no exceptional edges.
* C# modern features (switch expressions, pattern `when`, records) may emit `UNSUPPORTED_CONSTRUCT`.


