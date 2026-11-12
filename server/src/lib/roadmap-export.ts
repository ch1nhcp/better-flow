import type { RoadmapDetail } from '../db/roadmaps.js';

export function roadmapExportFilename(title: string, extension: 'png' | 'md'): string {
  const basename = [...title.replace(/[<>:"/\\|?*]/g, '-')]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .slice(0, 60)
    .join('')
    .replace(/^[. ]+|[. ]+$/g, '');
  const isReserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(basename);
  return `${isReserved ? '_' : ''}${basename || 'roadmap'}.${extension}`;
}

export function formatRoadmapMarkdown({
  title,
  nodes,
  edges,
}: Pick<RoadmapDetail, 'title' | 'nodes' | 'edges'>): string {
  const steps = nodes.map(({ id, data }) => {
    const heading = `## [${id}] ${data.label}`;
    const description = data.description;
    if (description === undefined) return heading;

    const needsEscape =
      !description ||
      description !== description.trim() ||
      /^(?:[#\\]|\S+\s*(?:->|→))/.test(description);
    return `${heading}\n${needsEscape ? '\\' : ''}${description}`;
  });
  const connections = edges
    .map(
      ({ source, target, animated, type }) =>
        `${source} → ${target}${animated ? ' [animated]' : ''}${type === 'default' ? ' [type=default]' : ''}`,
    )
    .join('\n');

  return [`# ${title}`, ...steps, connections].filter(Boolean).join('\n\n') + '\n';
}
