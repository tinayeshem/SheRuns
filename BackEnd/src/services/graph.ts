import type { GraphRow } from "../repositories/graphRepository";

export type Arc = { to: string; seg: number; rev: boolean };
export type Step = { seg: number; rev: boolean };
export type Graph = {
  nodes: Map<string, [number, number]>; // node id -> [lon, lat]
  adj: Map<string, Arc[]>;
  main: Set<string>; // nodes of the largest connected piece
};

class Heap {
  private k: number[] = [];
  private v: string[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: string) {
    this.k.push(key);
    this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, string] {
    const top: [number, string] = [this.k[0], this.v[0]];
    const lk = this.k.pop()!;
    const lv = this.v.pop()!;
    if (this.k.length) {
      this.k[0] = lk;
      this.v[0] = lv;
      let i = 0;
      const n = this.k.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.k[l] < this.k[m]) m = l;
        if (r < n && this.k[r] < this.k[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(i: number, j: number) {
    [this.k[i], this.k[j]] = [this.k[j], this.k[i]];
    [this.v[i], this.v[j]] = [this.v[j], this.v[i]];
  }
}

export function buildGraph(rows: GraphRow[]): Graph {
  const nodes = new Map<string, [number, number]>();
  const adj = new Map<string, Arc[]>();
  const add = (a: string, arc: Arc) => {
    let list = adj.get(a);
    if (!list) {
      list = [];
      adj.set(a, list);
    }
    list.push(arc);
  };

  rows.forEach((r, i) => {
    if (r.source === r.target || r.coords.length < 2) return;
    const first = r.coords[0];
    const last = r.coords[r.coords.length - 1];
    if (!nodes.has(r.source)) nodes.set(r.source, [first[0], first[1]]);
    if (!nodes.has(r.target)) nodes.set(r.target, [last[0], last[1]]);
    add(r.source, { to: r.target, seg: i, rev: false });
    add(r.target, { to: r.source, seg: i, rev: true });
  });

  // keep only the largest connected piece, so no route starts on an island
  const comp = new Map<string, number>();
  const sizes: number[] = [];
  for (const start of adj.keys()) {
    if (comp.has(start)) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    comp.set(start, id);
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const a of adj.get(u) ?? []) {
        if (!comp.has(a.to)) {
          comp.set(a.to, id);
          stack.push(a.to);
        }
      }
    }
    sizes.push(size);
  }
  let best = 0;
  sizes.forEach((s, i) => {
    if (s > sizes[best]) best = i;
  });
  const main = new Set<string>();
  for (const [node, c] of comp) if (c === best) main.add(node);

  return { nodes, adj, main };
}

export function nearestNode(
  g: Graph, lon: number, lat: number, maxMeters = Infinity
) {
  const k = Math.cos((lat * Math.PI) / 180);
  let bestId: string | null = null;
  let bd = Infinity;
  for (const id of g.main) {
    const p = g.nodes.get(id)!;
    const dx = (p[0] - lon) * k;
    const dy = p[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      bestId = id;
    }
  }
  if (!bestId) return null;
  const meters = Math.sqrt(bd) * 111320;
  return meters <= maxMeters ? { id: bestId, meters } : null;
}

export function shortestPath(
  g: Graph, from: string, to: string, cost: (arc: Arc) => number
): Step[] | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { from: string; step: Step }>();
  const done = new Set<string>();
  const heap = new Heap();
  heap.push(0, from);

  while (heap.size) {
    const [d, u] = heap.pop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const arc of g.adj.get(u) ?? []) {
      if (done.has(arc.to)) continue;
      const nd = d + cost(arc);
      if (nd < (dist.get(arc.to) ?? Infinity)) {
        dist.set(arc.to, nd);
        prev.set(arc.to, { from: u, step: { seg: arc.seg, rev: arc.rev } });
        heap.push(nd, arc.to);
      }
    }
  }

  if (!done.has(to)) return null;
  const path: Step[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    path.push(p.step);
    cur = p.from;
  }
  return path.reverse();
}