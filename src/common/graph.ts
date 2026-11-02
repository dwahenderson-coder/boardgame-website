/**
 * Generic, immutable/functional-friendly Graph data structure supporting
 * Breadth-First Search (BFS) and Dijkstra's shortest path for route connectivity
 * and network scoring across board games (Ticket to Ride, Catan, Power Grid).
 */

export interface GraphEdge<TMeta = unknown> {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
  readonly metadata?: TMeta;
}

export class Graph<TMeta = unknown> {
  private readonly adjacency: Map<string, GraphEdge<TMeta>[]>;

  constructor(edges: readonly GraphEdge<TMeta>[] = [], directed = false) {
    this.adjacency = new Map();
    for (const edge of edges) {
      this.insertEdge(edge, directed);
    }
  }

  private insertEdge(edge: GraphEdge<TMeta>, directed: boolean): void {
    if (!this.adjacency.has(edge.from)) {
      this.adjacency.set(edge.from, []);
    }
    if (!this.adjacency.has(edge.to)) {
      this.adjacency.set(edge.to, []);
    }

    this.adjacency.get(edge.from)!.push(edge);

    if (!directed && edge.from !== edge.to) {
      const reverseEdge: GraphEdge<TMeta> =
        edge.metadata !== undefined
          ? {
              from: edge.to,
              to: edge.from,
              weight: edge.weight,
              metadata: edge.metadata,
            }
          : {
              from: edge.to,
              to: edge.from,
              weight: edge.weight,
            };
      this.adjacency.get(edge.to)!.push(reverseEdge);
    }
  }

  /**
   * Adds an undirected or directed edge to the graph.
   */
  public addEdge(
    from: string,
    to: string,
    weight = 1,
    metadata?: TMeta,
    directed = false
  ): void {
    const edge: GraphEdge<TMeta> =
      metadata !== undefined
        ? { from, to, weight, metadata }
        : { from, to, weight };
    this.insertEdge(edge, directed);
  }

  /**
   * Returns all registered node keys in the graph.
   */
  public getNodes(): readonly string[] {
    return Array.from(this.adjacency.keys());
  }

  /**
   * Returns all outgoing edges from a node key.
   */
  public getNeighbors(node: string): readonly GraphEdge<TMeta>[] {
    return this.adjacency.get(node) ?? [];
  }

  /**
   * Evaluates whether a valid path exists between `startNode` and `targetNode`
   * using Breadth-First Search (BFS).
   */
  public isConnected(
    startNode: string,
    targetNode: string,
    edgeFilter?: (edge: GraphEdge<TMeta>) => boolean
  ): boolean {
    if (!this.adjacency.has(startNode) || !this.adjacency.has(targetNode)) {
      return false;
    }
    if (startNode === targetNode) {
      return true;
    }

    const visited = new Set<string>([startNode]);
    const queue: string[] = [startNode];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++]!;
      const neighbors = this.adjacency.get(current) ?? [];

      for (const edge of neighbors) {
        if (edgeFilter && !edgeFilter(edge)) {
          continue;
        }
        if (edge.to === targetNode) {
          return true;
        }
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    return false;
  }

  /**
   * Finds the shortest path (minimum total weight) between `startNode` and `targetNode`
   * using Dijkstra's algorithm. Returns `null` if no path exists.
   */
  public shortestPath(
    startNode: string,
    targetNode: string,
    edgeFilter?: (edge: GraphEdge<TMeta>) => boolean
  ): { readonly path: readonly string[]; readonly distance: number } | null {
    if (!this.adjacency.has(startNode) || !this.adjacency.has(targetNode)) {
      return null;
    }
    if (startNode === targetNode) {
      return { path: [startNode], distance: 0 };
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const unvisited = new Set<string>(this.adjacency.keys());

    for (const node of unvisited) {
      distances.set(node, Infinity);
    }
    distances.set(startNode, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest known distance
      let current: string | null = null;
      let smallestDistance = Infinity;

      for (const node of unvisited) {
        const d = distances.get(node) ?? Infinity;
        if (d < smallestDistance) {
          smallestDistance = d;
          current = node;
        }
      }

      if (current === null || smallestDistance === Infinity) {
        break;
      }

      if (current === targetNode) {
        const path: string[] = [];
        let step: string | undefined = targetNode;
        while (step !== undefined) {
          path.unshift(step);
          step = previous.get(step);
        }
        return { path, distance: smallestDistance };
      }

      unvisited.delete(current);

      const neighbors = this.adjacency.get(current) ?? [];
      for (const edge of neighbors) {
        if (edgeFilter && !edgeFilter(edge)) {
          continue;
        }
        if (!unvisited.has(edge.to)) {
          continue;
        }

        const alt = smallestDistance + edge.weight;
        if (alt < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, alt);
          previous.set(edge.to, current);
        }
      }
    }

    return null;
  }
}

