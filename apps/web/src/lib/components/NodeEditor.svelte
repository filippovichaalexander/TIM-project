<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js';
  import 'litegraph.js/css/litegraph.css';

  let container: HTMLDivElement;
  let graph: LGraph;
  let canvas: LGraphCanvas;

  onMount(() => {
    LiteGraph.clearRegisteredTypes();

    function registerNode(type: string, title: string, inputs: string[], outputs: string[]) {
      function NodeClass(this: { addInput: (n: string, t: string) => void; addOutput: (n: string, t: string) => void; properties: Record<string, unknown> }) {
        inputs.forEach(n => this.addInput(n, '*'));
        outputs.forEach(n => this.addOutput(n, '*'));
        this.properties = {};
      }
      NodeClass.title = title;
      NodeClass.desc = `BIM node: ${title}`;
      LiteGraph.registerNodeType(type, NodeClass as unknown as typeof LiteGraph.LGraphNode);
    }

    registerNode('bim/box', 'Box', [], ['geometry']);
    registerNode('bim/extrude', 'Extrude', ['profile', 'height'], ['geometry']);
    registerNode('bim/wall', 'Create Wall', ['start', 'end', 'height'], ['element']);
    registerNode('bim/column', 'Create Column', ['position', 'height'], ['element']);
    registerNode('bim/subtract', 'Subtract', ['a', 'b'], ['geometry']);
    registerNode('bim/union', 'Union', ['a', 'b'], ['geometry']);
    registerNode('bim/move', 'Move', ['geometry', 'vector'], ['geometry']);
    registerNode('bim/collision', 'Collision Check', ['elements'], ['collisions']);

    graph = new LGraph();
    canvas = new LGraphCanvas(container, graph);
    canvas.background_image = '';

    const wall = LiteGraph.createNode('bim/wall');
    wall.pos = [100, 100];
    graph.add(wall);

    const col = LiteGraph.createNode('bim/column');
    col.pos = [100, 250];
    graph.add(col);

    const collision = LiteGraph.createNode('bim/collision');
    collision.pos = [400, 175];
    graph.add(collision);

    graph.start();
  });

  onDestroy(() => {
    graph?.stop();
  });

  function runGraph() {
    graph?.runStep(1);
  }
</script>

<div class="panel node-panel">
  <div class="panel-header">
    Node Editor
    <button class="run-btn" onclick={runGraph}>▶ Run</button>
  </div>
  <div class="graph-container" bind:this={container}></div>
</div>

<style>
  .node-panel { height: 100%; display: flex; flex-direction: column; }
  .graph-container { flex: 1; position: relative; overflow: hidden; }
  .run-btn {
    background: var(--success);
    color: white;
    padding: 3px 10px;
    font-size: 12px;
  }
  :global(.litegraph) { background: var(--bg-primary) !important; }
</style>
