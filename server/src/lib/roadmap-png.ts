import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { getBezierPath, getSmoothStepPath, Position } from '@xyflow/system';
import type { RoadmapDetail } from '../db/roadmaps.js';
import type { RoadmapEdge, RoadmapNode } from './roadmap-validation.js';

const fontFiles = [
  [
    'Betterflow Latin',
    import.meta.resolve('@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2'),
  ],
  [
    'Betterflow Latin',
    import.meta.resolve('@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2'),
  ],
  [
    'Betterflow Vietnamese',
    import.meta
      .resolve('@fontsource/ibm-plex-sans/files/ibm-plex-sans-vietnamese-400-normal.woff2'),
  ],
  [
    'Betterflow Vietnamese',
    import.meta
      .resolve('@fontsource/ibm-plex-sans/files/ibm-plex-sans-vietnamese-600-normal.woff2'),
  ],
] as const;

for (const [family, url] of fontFiles) {
  if (!GlobalFonts.registerFromPath(fileURLToPath(url), family)) {
    throw new Error('Roadmap export font could not be loaded.');
  }
}

const fontFamily = '"Betterflow Latin", "Betterflow Vietnamese", sans-serif';
const labelFont = `600 14px ${fontFamily}`;
const descriptionFont = `400 12px ${fontFamily}`;
const labelLineHeight = 19;
const descriptionLineHeight = 17;
const stepWidth = 240;
const stepPaddingX = 17;
const stepPaddingY = 13;
const descriptionGap = 4;
const padding = 24;
const maxImageSide = 8192;
const maxImagePixels = 16_000_000;

interface Step {
  x: number;
  y: number;
  height: number;
  label: string[];
  description: string[];
}

type Bounds = [left: number, top: number, right: number, bottom: number];

function wrapText(ctx: SKRSContext2D, text: string): string[] {
  const maxWidth = stepWidth - 2 * stepPaddingX;
  const lines: string[] = [];
  let line = '';

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }

    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    line = '';
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function measureStep(ctx: SKRSContext2D, node: RoadmapNode): Step {
  ctx.font = labelFont;
  const label = wrapText(ctx, node.data.label);
  ctx.font = descriptionFont;
  const description = wrapText(ctx, node.data.description ?? '');
  const height =
    2 * stepPaddingY +
    label.length * labelLineHeight +
    (description.length ? descriptionGap + description.length * descriptionLineHeight : 0);

  return { ...node.position, height, label, description };
}

function createConnection(edge: RoadmapEdge, source: Step, target: Step) {
  const targetX = target.x + stepWidth / 2;
  const targetY = target.y;
  const getPath = edge.type === 'default' ? getBezierPath : getSmoothStepPath;
  const [path] = getPath({
    sourceX: source.x + stepWidth / 2,
    sourceY: source.y + source.height,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
  });
  return { path: new Path2D(path), targetX, targetY, animated: edge.animated };
}

function drawStep(ctx: SKRSContext2D, step: Step) {
  ctx.beginPath();
  ctx.roundRect(step.x, step.y, stepWidth, step.height, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  const x = step.x + stepPaddingX;
  const y = step.y + stepPaddingY;
  ctx.font = labelFont;
  ctx.fillStyle = '#0f172a';
  step.label.forEach((line, index) => ctx.fillText(line, x, y + index * labelLineHeight));
  ctx.font = descriptionFont;
  ctx.fillStyle = '#64748b';
  const descriptionY = y + step.label.length * labelLineHeight + descriptionGap;
  step.description.forEach((line, index) =>
    ctx.fillText(line, x, descriptionY + index * descriptionLineHeight),
  );
}

export async function renderRoadmapPng({
  nodes,
  edges,
}: Pick<RoadmapDetail, 'nodes' | 'edges'>): Promise<Buffer> {
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  const steps = new Map(nodes.map((node) => [node.id, measureStep(ctx, node)]));
  const connections = edges.flatMap((edge) => {
    const source = steps.get(edge.source);
    const target = steps.get(edge.target);
    return source && target ? [createConnection(edge, source, target)] : [];
  });
  const bounds: Bounds[] = [
    ...Array.from(steps.values(), ({ x, y, height }): Bounds => [x, y, x + stepWidth, y + height]),
    ...connections.map(({ path }) => path.computeTightBounds()),
  ];
  if (!bounds.length) bounds.push([0, 0, 272, 112]);

  const left = Math.min(...bounds.map(([x]) => x)) - padding;
  const top = Math.min(...bounds.map(([, y]) => y)) - padding;
  const width = Math.max(...bounds.map(([, , x]) => x)) + padding - left;
  const height = Math.max(...bounds.map(([, , , y]) => y)) + padding - top;
  const scale = Math.min(
    1,
    maxImageSide / Math.max(width, height),
    Math.sqrt(maxImagePixels / (width * height)),
  );
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);

  ctx.lineWidth = 1.75;
  ctx.strokeStyle = '#94a3b8';
  ctx.fillStyle = '#2563eb';
  for (const { path, animated, targetX, targetY } of connections) {
    ctx.setLineDash(animated ? [5, 5] : []);
    ctx.stroke(path);
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(targetX - 4, targetY - 8);
    ctx.lineTo(targetX + 4, targetY - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.setLineDash([]);
  ctx.textBaseline = 'top';
  for (const step of steps.values()) drawStep(ctx, step);

  if (!steps.size) {
    ctx.font = labelFont;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Roadmap chưa có bước', 136, 56);
  }
  return canvas.encode('png');
}
