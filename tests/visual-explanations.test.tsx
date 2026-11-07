import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualExplanation } from '../src/components/VisualExplanation';

const steps = [{ label: 'Start', detail: 'Initial state.' }, { label: 'Finish', detail: 'Target state.' }];

describe('task visual renderer', () => {
  it('highlights the illustrated path through a grid', () => {
    const html = renderToStaticMarkup(<VisualExplanation visual={{ kind: 'grid', title: 'Reach the goal', caption: 'Follow legal moves.', steps, diagram: { type: 'grid', cells: [['S', '.'], ['#', 'G']], path: [[0, 0], [0, 1], [1, 1]] } }} />);
    expect(html).toContain('Problem grid; highlighted cells show the illustrated path');
    expect(html.match(/bg-accent\/20/g)).toHaveLength(3);
  });

  it('draws a graph from validated node positions and edges', () => {
    const html = renderToStaticMarkup(<VisualExplanation visual={{ kind: 'graph', title: 'Follow the edges', caption: 'A small graph.', steps, diagram: { type: 'graph', nodes: [{ id: 'a', label: 'A', x: 15, y: 50 }, { id: 'b', label: 'B', x: 85, y: 50 }], edges: [{ from: 'a', to: 'b', label: 'cost 2' }] } }} />);
    expect(html).toContain('<svg');
    expect(html).toContain('cost 2');
    expect(html).toContain('A');
  });
});
