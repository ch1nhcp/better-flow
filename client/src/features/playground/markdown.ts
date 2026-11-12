import type { RoadmapEdgePayload, RoadmapNodePayload } from '../roadmap-editor/api';

export interface PlaygroundIssue {
  line: number;
  column: number;
  code:
    | 'INVALID_SYNTAX'
    | 'DUPLICATE_NODE_ID'
    | 'UNKNOWN_NODE'
    | 'INVALID_EDGE'
    | 'GRAPH_LIMIT_EXCEEDED'
    | 'LAYOUT_FAILED';
  message: string;
}

export interface ParsedRoadmap {
  title: string;
  nodes: Omit<RoadmapNodePayload, 'position'>[];
  edges: RoadmapEdgePayload[];
}

type ParseResult =
  { graph: ParsedRoadmap; errors?: never } | { graph?: never; errors: PlaygroundIssue[] };
type SourceLine = Pick<PlaygroundIssue, 'line' | 'column'> & { text: string };

const nodeIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const titlePattern = /^#(?:\s+(.*))?$/;
const nodePattern = /^##\s+\[([^\]]*)\](?:\s+(.*))?$/;
const edgeStartPattern = /^\S+\s*(?:->|→)/;
const edgePattern = /^([a-zA-Z0-9_-]+?)\s*(?:->|→)\s*([a-zA-Z0-9_-]+)\s*(.*)$/;

export const sampleMarkdown = [
  '# Onboarding Frontend',
  '',
  '## [setup] Chuẩn bị môi trường',
  'Cài Git, Node.js và cấu hình trình soạn thảo.',
  '',
  '## [ts] Nền tảng TypeScript',
  'Kiểu dữ liệu, interface và generic.',
  '',
  '## [react] React cơ bản',
  'Component, props, state và hooks.',
  '',
  '## [api] Tích hợp API',
  'Gọi REST API và quản lý dữ liệu với TanStack Query.',
  '',
  '## [deploy] Build và triển khai',
  'Kiểm thử, tối ưu bundle và triển khai ứng dụng.',
  '',
  'setup -> ts',
  'ts -> react',
  'react -> api',
  'api -> deploy',
].join('\n');

export function markdownLineKind(text: string) {
  const line = text.trim();
  if (titlePattern.test(line)) return 'title';
  if (line.startsWith('##')) return 'node';
  if (!line.startsWith('\\') && edgeStartPattern.test(line)) return 'edge';
  return 'text';
}

function parseEdges(lines: SourceLine[], nodeIds: Set<string>, errors: PlaygroundIssue[]) {
  const edges: RoadmapEdgePayload[] = [];
  const seen = new Set<string>();

  for (const { line, column, text } of lines) {
    const match = edgePattern.exec(text);
    const source = match?.[1];
    const target = match?.[2];
    const options = match?.[3]?.trim().split(/\s+/).filter(Boolean) ?? [];
    const typeOptions = options.filter((option) => option.startsWith('[type='));
    const invalidOptions =
      new Set(options).size !== options.length ||
      typeOptions.length > 1 ||
      options.some(
        (option) => !['[animated]', '[type=default]', '[type=smoothstep]'].includes(option),
      );

    if (!source || !target || source === target || invalidOptions) {
      errors.push({
        line,
        column,
        code: 'INVALID_EDGE',
        message: 'Khai báo đường nối không hợp lệ.',
      });
      continue;
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      const missing = nodeIds.has(source) ? target : source;
      errors.push({
        line,
        column,
        code: 'UNKNOWN_NODE',
        message: `Chưa khai báo node "${missing}".`,
      });
      continue;
    }

    const id = `edge-${source}:${target}`;
    if (seen.has(id)) {
      errors.push({
        line,
        column,
        code: 'INVALID_EDGE',
        message: 'Đường nối này đã được khai báo.',
      });
      continue;
    }
    seen.add(id);
    edges.push({
      id,
      source,
      target,
      type: options.includes('[type=default]') ? 'default' : 'smoothstep',
      animated: options.includes('[animated]'),
    });
  }

  return edges;
}

export function parsePlaygroundMarkdown(markdown: string): ParseResult {
  const errors: PlaygroundIssue[] = [];
  const nodes: ParsedRoadmap['nodes'] = [];
  const nodeIds = new Set<string>();
  const edgeLines: SourceLine[] = [];
  let title: string | undefined;
  let descriptionNode: ParsedRoadmap['nodes'][number] | undefined;

  for (const [index, raw] of markdown.split(/\r\n?|\n/).entries()) {
    const text = raw.trim();
    if (!text) continue;
    const line = index + 1;
    const column = raw.search(/\S/) + 1;
    const location = { line, column };
    const nodeForDescription = descriptionNode;
    descriptionNode = undefined;

    if (text.includes('\0') || /[\uD800-\uDFFF]/u.test(text)) {
      errors.push({
        ...location,
        code: 'INVALID_SYNTAX',
        message: 'Dòng chứa ký tự không hợp lệ.',
      });
      continue;
    }

    const heading = titlePattern.exec(text);
    if (heading) {
      const value = heading[1]?.trim() ?? '';
      if (title !== undefined || !value || [...value].length > 255) {
        errors.push({
          ...location,
          code: 'INVALID_SYNTAX',
          message: 'Dùng một tiêu đề dài 1 đến 255 ký tự.',
        });
      }
      title ??= value;
      continue;
    }

    if (text.startsWith('#')) {
      const match = nodePattern.exec(text);
      const id = match?.[1] ?? '';
      const label = match?.[2]?.trim() ?? '';
      if (!nodeIdPattern.test(id) || !label || [...label].length > 255) {
        errors.push({
          ...location,
          code: 'INVALID_SYNTAX',
          message: 'Dùng ## [id] Tên node với ID hợp lệ và tên tối đa 255 ký tự.',
        });
      } else if (nodeIds.has(id)) {
        errors.push({
          ...location,
          code: 'DUPLICATE_NODE_ID',
          message: `ID "${id}" đã được sử dụng.`,
        });
      } else {
        descriptionNode = { id, type: 'default', data: { label } };
        nodes.push(descriptionNode);
        nodeIds.add(id);
        if (nodes.length === 501) {
          errors.push({
            ...location,
            code: 'GRAPH_LIMIT_EXCEEDED',
            message: 'Roadmap có tối đa 500 node.',
          });
        }
      }
      continue;
    }

    if (!text.startsWith('\\') && edgeStartPattern.test(text)) {
      edgeLines.push({ ...location, text });
      if (edgeLines.length === 1001) {
        errors.push({
          ...location,
          code: 'GRAPH_LIMIT_EXCEEDED',
          message: 'Roadmap có tối đa 1.000 đường nối.',
        });
      }
      continue;
    }

    if (nodeForDescription) {
      const description = text.startsWith('\\') ? raw.trimStart().slice(1) : text;
      if ([...description].length > 2000) {
        errors.push({
          ...location,
          code: 'INVALID_SYNTAX',
          message: 'Mô tả node có tối đa 2.000 ký tự.',
        });
      } else {
        nodeForDescription.data.description = description;
      }
      continue;
    }

    errors.push({
      ...location,
      code: 'INVALID_SYNTAX',
      message: 'Dòng này không thuộc cú pháp Playground.',
    });
  }

  const edges = parseEdges(edgeLines.slice(0, 1000), nodeIds, errors);
  if (errors.length) return { errors: errors.sort((a, b) => a.line - b.line) };
  return { graph: { title: title ?? 'Roadmap chưa đặt tên', nodes, edges } };
}
