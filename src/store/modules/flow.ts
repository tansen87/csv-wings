import { defineStore } from "pinia";
import type { Node, Edge } from "@vue-flow/core";
import { message } from "@/utils/message";

export function getNodesInEdgeOrder(nodes: Node[], edges: Edge[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const graph = new Map<string, string[]>();

  edges.forEach(edge => {
    if (edge.source && edge.target) {
      if (!graph.has(edge.source)) graph.set(edge.source, []);
      graph.get(edge.source)!.push(edge.target);
    }
  });

  const visited = new Set<string>();
  const result: Node[] = [];

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) result.push(node);

    const neighbors = graph.get(id) || [];
    neighbors.forEach(neighbor => dfs(neighbor));
  }

  const startNodes = nodes.filter(
    n =>
      edges.some(e => e.source === n.id) && !edges.some(e => e.target === n.id)
  );

  startNodes.forEach(n => dfs(n.id));

  return result;
}

// Flow must start with the <Start> node
export function isValidExecutionPath(
  nodes: Node[],
  edges: Edge[]
): { isValid: boolean; path: Node[]; reason?: string } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const graph = new Map<string, string[]>();
  const reverseGraph = new Map<string, string[]>();

  edges.forEach(edge => {
    if (edge.source && edge.target) {
      if (!graph.has(edge.source)) graph.set(edge.source, []);
      graph.get(edge.source)!.push(edge.target);

      if (!reverseGraph.has(edge.target)) reverseGraph.set(edge.target, []);
      reverseGraph.get(edge.target)!.push(edge.source);
    }
  });

  const startNodes = nodes.filter(n => n.type === "start");
  if (startNodes.length === 0) {
    return { isValid: false, path: [], reason: "no_start" };
  }
  if (startNodes.length > 1) {
    return { isValid: false, path: [], reason: "multi_start" };
  }

  const startNode = startNodes[0];

  const leafNodes = nodes.filter(node => {
    if (node.id === startNode.id && !graph.has(node.id)) return true;
    return !graph.has(node.id) && node.type !== "start";
  });

  if (leafNodes.length === 0) {
    return { isValid: false, path: [], reason: "no_leaf_node" };
  }

  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = [];
  queue.push({ id: startNode.id, path: [startNode.id] });
  visited.add(startNode.id);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    const neighbors = graph.get(id) || [];
    if (neighbors.length === 0) {
      const fullPath = path.map(pid => nodeMap.get(pid)!).filter(Boolean);
      return { isValid: true, path: fullPath };
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return { isValid: false, path: [], reason: "no_path" };
}

interface Store {
  selectStore: { selects: Array<any> };
  filterStore: { filters: Array<any> };
  strStore: { strs: Array<any> };
  renameStore: { renames: Array<any> };
}

export function getExecutionConfig(
  nodes: Node[],
  edges: Edge[],
  stores: Store
) {
  // 安全检查:确保 nodes 和 edges 是数组
  if (!Array.isArray(nodes)) {
    console.warn("nodes is not an array:", nodes);
    return [];
  }

  if (!Array.isArray(edges)) {
    console.warn("edges is not an array:", edges);
    edges = []; // 兜底:设为空数组
  }

  // 找到 start 节点
  const startNode = nodes.find(n => n.type === "start");
  if (!startNode) {
    console.warn("No start node found");
    return [];
  }

  // 按照连接顺序遍历节点（BFS）
  const operations: any[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type === "start" || node.type === "end") {
      // 找到下一个节点
      const nextEdges = edges.filter(e => e.source === nodeId);
      for (const edge of nextEdges) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
      continue;
    }

    // 4. 根据节点类型获取配置
    switch (node.type) {
      case "select": {
        const selectConfig = stores.selectStore.selects.find(
          s => s.id === nodeId
        );
        if (selectConfig) operations.push(selectConfig);
        break;
      }
      case "filter": {
        const filterConfig = stores.filterStore.filters.find(
          f => f.id === nodeId
        );
        if (filterConfig) operations.push(filterConfig);
        break;
      }
      case "str": {
        const strConfig = stores.strStore.strs.find(s => s.id === nodeId);
        if (strConfig) operations.push(strConfig);
        break;
      }
      case "rename": {
        const renameConfig = stores.renameStore.renames.find(
          r => r.id === nodeId
        );
        if (renameConfig) operations.push(renameConfig);
        break;
      }
    }

    // 5. 找到下一个节点
    const nextEdges = edges.filter(e => e.source === nodeId);
    for (const edge of nextEdges) {
      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  const msg: any = operations.map(o => `${o.op}(${o.mode || o.column})`);
  message(`flow oper: ${msg}`);

  return operations;
}

export const useHeaders = defineStore("headers", {
  state: () => ({
    headers: [] as Array<{ label: string; value: string }>
  }),
  actions: {
    setHeaders(headers: Array<{ label: string; value: string }>) {
      this.headers = headers;
    },

    setHeaderForNode(_nodeId: string, label: string) {
      const exists = this.headers.some(h => h.value === label);
      if (!exists) {
        this.headers.push({
          label: label,
          value: label
        });
      }
    },

    clearHeaders() {
      this.headers = [];
    }
  },
  persist: false
});

export const usePath = defineStore("path", {
  state: () => ({
    path: "" as string
  }),
  persist: true
});

export const useNodeStore = defineStore("node", {
  state: () => ({
    nodes: [],
    edges: []
  }),
  actions: {
    addNode(node) {
      this.nodes = node;
    },
    addEdge(edge) {
      this.edges = edge;
    }
  },
  persist: true
});

export const useInput = defineStore("input", {
  state: () => ({
    inputs: [] as Array<{
      id: string;
      path: string;
      isPath: boolean;
      headers: Array<{ label: string; value: string }>;
      tableColumn: Array<{ prop: string; label: string }>;
      tableData: Array<Record<string, any>>;
    }>
  }),
  actions: {
    addInput(data: {
      id: string;
      path: string;
      isPath: boolean;
      headers?: Array<{ label: string; value: string }>;
      tableColumn?: Array<{ prop: string; label: string }>;
      tableData?: Array<Record<string, any>>;
    }) {
      if (!data.id) return;

      const index = this.inputs.findIndex(f => f.id === data.id);
      if (index > -1) {
        // 保留已有数据，只更新变化的字段
        this.inputs[index] = {
          ...this.inputs[index],
          ...data
        };
      } else {
        this.inputs.push(data);
      }
    },

    removeInput(nodeId: string) {
      this.inputs = this.inputs.filter(f => f.id !== nodeId);
    },

    getInput(nodeId: string) {
      return this.inputs.find(f => f.id === nodeId);
    }
  },
  persist: {
    storage: localStorage,
    key: "flow-inputs"
  }
});

export const useFilter = defineStore("filter", {
  state: () => ({
    filters: [] as Array<{
      id: string;
      op: string;
      mode: string;
      column: string;
      value: string;
      logic: string;
    }>
  }),
  actions: {
    addFilter(data: {
      id: string;
      op: string;
      mode: string;
      column: string;
      value: string;
      logic: string;
    }) {
      if (!data.id) return;

      const index = this.filters.findIndex(f => f.id === data.id);
      if (index > -1) {
        this.filters[index] = data;
      } else {
        this.filters.push(data);
      }
    },

    // 清理无效节点
    cleanupFilter(validNodeIds: string[]) {
      this.filters = this.filters.filter(f => validNodeIds.includes(f.id));
    },

    // 移除指定节点
    removeFilter(nodeId: string) {
      this.filters = this.filters.filter(f => f.id !== nodeId);
    }
  },
  persist: {
    storage: localStorage,
    key: "flow-filters"
  }
});

export const useSelect = defineStore("select", {
  state: () => ({
    selects: [] as Array<{
      id: string;
      op: string;
      column: string;
    }>
  }),
  actions: {
    addSelect(data: { id: string; op: string; column: string }) {
      if (!data.id) return;

      const index = this.selects.findIndex(f => f.id === data.id);
      if (index > -1) {
        this.selects[index] = data;
      } else {
        this.selects.push(data);
      }
    },

    // 移除指定节点
    removeSelect(nodeId: string) {
      this.selects = this.selects.filter(s => s.id !== nodeId);
    },

    // 获取指定节点数据
    getSelect(nodeId: string) {
      return this.selects.find(s => s.id === nodeId);
    }
  },
  persist: {
    storage: localStorage,
    key: "flow-selects"
  }
});

export const useStr = defineStore("str", {
  state: () => ({
    strs: [] as Array<{
      id: string;
      op: string;
      mode: string;
      column: string;
      comparand: string;
      replacement: string;
      newcol: string;
    }>
  }),
  actions: {
    addStr(data: {
      id: string;
      op: string;
      mode: string;
      column: string;
      comparand: string;
      replacement: string;
      newcol: string;
    }) {
      if (!data.id) return;

      const index = this.strs.findIndex(s => s.id === data.id);
      if (index > -1) {
        this.strs[index] = data;
      } else {
        this.strs.push(data);
      }
    },

    // 移除指定节点
    removeStr(nodeId: string) {
      this.strs = this.strs.filter(s => s.id !== nodeId);
    },

    // 获取指定节点数据
    getStr(nodeId: string) {
      return this.strs.find(s => s.id === nodeId);
    }
  },
  persist: {
    storage: localStorage,
    key: "flow-strs"
  }
});

export const useRename = defineStore("rename", {
  state: () => ({
    renames: [] as Array<{
      id: string;
      op: string;
      column: string;
      value: string;
    }>
  }),
  actions: {
    addRename(data: { id: string; op: string; column: string; value: string }) {
      if (!data.id) return;

      const index = this.renames.findIndex(s => s.id === data.id);
      if (index > -1) {
        this.renames[index] = data;
      } else {
        this.renames.push(data);
      }
    },

    // 移除指定节点
    removeRename(nodeId: string) {
      this.renames = this.renames.filter(r => r.id !== nodeId);
    },

    // 获取指定节点数据
    getRename(nodeId: string) {
      return this.renames.find(r => r.id === nodeId);
    }
  },
  persist: {
    storage: localStorage,
    key: "flow-renames"
  }
});
