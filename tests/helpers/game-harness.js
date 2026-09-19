import { readFileSync } from "node:fs";
import vm from "node:vm";

// A deliberately small DOM/canvas contract for application wiring tests.
// It does not emulate browser layout, rasterization, focus, or native storage.
export function createHarness(saved = {}) {
  const html = readFileSync(
    new URL("../../index.html", import.meta.url),
    "utf8",
  );
  const listeners = new Map();
  let scheduled,
    now = 1;
  const draws = [],
    stack = [];
  const context2D = new Proxy(
    {
      globalAlpha: 1,
      save() {
        stack.push(this.globalAlpha);
      },
      restore() {
        this.globalAlpha = stack.pop();
      },
      translate(x, y) {
        draws.push({ x, y, alpha: this.globalAlpha });
      },
    },
    { get: (target, key) => (key in target ? target[key] : () => {}) },
  );
  class Element {
    constructor(id) {
      this.id = id;
      this.hidden = id === "curtain";
      this.open = false;
      this.style = {};
      this.dataset = {};
      this.children = [];
      this.attributes = {};
      this.events = {};
      this.textContent = "";
      this.value = "";
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener(type, fn) {
      (this.events[type] ??= []).push(fn);
    }
    dispatch(type, event = {}) {
      for (const fn of this.events[type] || [])
        fn({ target: this, preventDefault() {}, ...event });
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    append(node) {
      this.children.push(node);
    }
    getBoundingClientRect() {
      return { left: 0, top: 66, width: 1280, height: 734 };
    }
    getContext() {
      return context2D;
    }
    focus() {}
    setPointerCapture() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatch("close");
    }
    click() {
      this.onclick?.({ shiftKey: false });
      this.dispatch("click");
    }
  }
  const nodes = new Map(
    [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [
      id,
      new Element(id),
    ]),
  );
  const storage = {
    getItem: (key) => saved[key] ?? null,
    setItem: (key, value) => {
      saved[key] = value;
    },
  };
  const window = {
    localStorage: storage,
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const document = {
    getElementById: (id) => nodes.get(id),
    querySelectorAll: () => [],
    createElement: () => new Element(),
    addEventListener() {},
    hidden: false,
  };
  const sandbox = {
    window,
    document,
    console: { info() {} },
    devicePixelRatio: 1,
    performance: { now: () => now },
    requestAnimationFrame: (fn) => {
      scheduled = fn;
    },
    HTMLSelectElement: class {},
  };
  vm.createContext(sandbox);
  for (const [, source] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    vm.runInContext(source, sandbox);
  return {
    app: window.springheel,
    draws,
    nodes,
    saved,
    storage,
    frame(milliseconds = 1000 / 60) {
      now += milliseconds;
      scheduled(now);
    },
    event(name, event = {}) {
      listeners.get(name)?.({
        code: "",
        target: null,
        preventDefault() {},
        ...event,
      });
    },
  };
}
