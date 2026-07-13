<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { LGraph, LGraphCanvas, LiteGraph, LGraphNode } from 'litegraph.js';
  import 'litegraph.js/css/litegraph.css';

  let container: HTMLDivElement;
  let graph: LGraph;

  onMount(() => {
    LiteGraph.clearRegisteredTypes();

    function registerNode(type: string, title: string, inputs: string[], outputs: string[]) {
      class NodeClass extends LGraphNode {
        constructor() {
          super(title);
          inputs.forEach(n => this.addInput(n, '*'));
          outputs.forEach(n => this.addOutput(n, '*'));
        }
      }
      LiteGraph.registerNodeType(type, NodeClass);
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

    const canvasEl = document.createElement('canvas');
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    container.appendChild(canvasEl);

    new LGraphCanvas(canvasEl, graph);

    const wall = LiteGraph.createNode('bim/wall');
    if (wall) { wall.pos = [100, 100]; graph.add(wall); }

    const col = LiteGraph.createNode('bim/column');
    if (col) { col.pos = [100, 250]; graph.add(col); }

    const collision = LiteGraph.createNode('bim/collision');
    if (collision) { collision.pos = [400, 175]; graph.add(collision); }

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
