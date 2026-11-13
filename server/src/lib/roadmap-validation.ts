import { z } from 'zod';
import { HttpError } from './http-error.js';

// --- CUSTOM STRING HELPERS ---
const singleLineTrimmedString = (min: number, max: number) =>
  z
    .string()
    .refine((val) => !/[\r\n]/.test(val), 'Không được chứa ký tự xuống dòng.')
    .transform((val) => val.trim())
    .refine((val) => {
      const len = [...val].length;
      return len >= min && len <= max;
    }, `Độ dài phải từ ${min} đến ${max} ký tự.`);

// --- SCHEMAS & INFERRED TYPES ---
export const RoadmapNodeSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Node ID chỉ chấp nhận chữ cái, số, dấu gạch ngang và gạch dưới.')
    .refine((val) => [...val].length >= 1 && [...val].length <= 64, 'Node ID từ 1 đến 64 ký tự.'),
  type: z.literal('default'),
  position: z.strictObject({
    x: z.number().finite().min(-1000000).max(1000000),
    y: z.number().finite().min(-1000000).max(1000000),
  }),
  data: z.strictObject({
    label: singleLineTrimmedString(1, 255),
    description: z
      .string()
      .refine((val) => !/[\r\n]/.test(val), 'Mô tả không được chứa ký tự xuống dòng.')
      .refine((val) => [...val].length <= 2000, 'Mô tả tối đa 2000 ký tự.')
      .optional(),
  }),
});

export const RoadmapEdgeSchema = z.strictObject({
  id: z
    .string()
    .refine((val) => [...val].length >= 1 && [...val].length <= 200, 'Edge ID từ 1 đến 200 ký tự.'),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(['smoothstep', 'default']).default('smoothstep'),
  animated: z.boolean().default(false),
});

export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type RoadmapEdge = z.infer<typeof RoadmapEdgeSchema>;

// Graph integrity validation logic
function refineGraph(
  { nodes, edges }: { nodes: RoadmapNode[]; edges: RoadmapEdge[] },
  ctx: z.RefinementCtx,
): void {
  const nodeIds = new Set<string>();
  nodes.forEach((node, idx) => {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trùng Node ID: ${node.id}`,
        path: ['nodes', idx],
      });
    }
    nodeIds.add(node.id);
  });

  const edgeIds = new Set<string>();
  const edgePairs = new Set<string>();
  edges.forEach((edge, idx) => {
    if (edgeIds.has(edge.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trùng Edge ID: ${edge.id}`,
        path: ['edges', idx],
      });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Edge source không tồn tại: ${edge.source}`,
        path: ['edges', idx, 'source'],
      });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Edge target không tồn tại: ${edge.target}`,
        path: ['edges', idx, 'target'],
      });
    }
    if (edge.source === edge.target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Không chấp nhận cạnh tự trỏ chính nó (self-loop).',
        path: ['edges', idx],
      });
    }

    const pairKey = `${edge.source}->${edge.target}`;
    if (edgePairs.has(pairKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Không chấp nhận hai cạnh cùng source/target.',
        path: ['edges', idx],
      });
    }
    edgePairs.add(pairKey);
  });
}

export const GraphSchema = z
  .strictObject({
    nodes: z.array(RoadmapNodeSchema).max(500, 'Số lượng node tối đa là 500.').default([]),
    edges: z.array(RoadmapEdgeSchema).max(1000, 'Số lượng edge tối đa là 1.000.').default([]),
  })
  .superRefine(refineGraph);

export const CreateRoadmapSchema = z
  .strictObject({
    title: singleLineTrimmedString(1, 255),
    nodes: z.array(RoadmapNodeSchema).max(500, 'Số lượng node tối đa là 500.').default([]),
    edges: z.array(RoadmapEdgeSchema).max(1000, 'Số lượng edge tối đa là 1.000.').default([]),
  })
  .superRefine(refineGraph);

export const UpdateRoadmapSchema = z
  .strictObject({
    title: singleLineTrimmedString(1, 255).optional(),
    nodes: z.array(RoadmapNodeSchema).max(500, 'Số lượng node tối đa là 500.').optional(),
    edges: z.array(RoadmapEdgeSchema).max(1000, 'Số lượng edge tối đa là 1.000.').optional(),
  })
  .refine(
    (b) => b.title !== undefined || b.nodes !== undefined || b.edges !== undefined,
    'Cần ít nhất một trong các trường title, nodes, edges để cập nhật roadmap.',
  )
  .superRefine(({ nodes, edges }, ctx) => {
    if (nodes !== undefined && edges !== undefined) {
      refineGraph({ nodes, edges }, ctx);
    }
  });

export type CreateRoadmapInput = z.infer<typeof CreateRoadmapSchema>;
export type UpdateRoadmapInput = z.infer<typeof UpdateRoadmapSchema>;

export const ShareRoadmapSchema = z.strictObject({
  isPublic: z.boolean({ message: 'Trường isPublic phải là giá trị boolean.' }),
});

export type ShareRoadmapInput = z.infer<typeof ShareRoadmapSchema>;

// --- PARSERS DÙNG CHO CONTROLLER & SERVICE ---
export function parseRoadmapId(id: unknown): number {
  const result = z
    .string()
    .regex(/^[1-9]\d*$/)
    .refine((val) => {
      const num = Number(val);
      return Number.isSafeInteger(num) && num <= 2147483647;
    })
    .transform(Number)
    .safeParse(id);
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Roadmap ID không hợp lệ.');
  return result.data;
}

export function validateCreateRoadmapBody(body: unknown): CreateRoadmapInput {
  const result = CreateRoadmapSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message ?? 'Dữ liệu tạo roadmap không hợp lệ.';
    throw new HttpError(400, 'VALIDATION_ERROR', firstIssue);
  }
  return result.data;
}

export function validateUpdateRoadmapBody(body: unknown): UpdateRoadmapInput {
  const result = UpdateRoadmapSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message ?? 'Dữ liệu cập nhật roadmap không hợp lệ.';
    throw new HttpError(400, 'VALIDATION_ERROR', firstIssue);
  }
  return result.data;
}

export function validateShareRoadmapBody(body: unknown): ShareRoadmapInput {
  const result = ShareRoadmapSchema.safeParse(body);
  if (!result.success) {
    const firstIssue =
      result.error.issues[0]?.message ?? 'Dữ liệu cập nhật trạng thái chia sẻ không hợp lệ.';
    throw new HttpError(400, 'VALIDATION_ERROR', firstIssue);
  }
  return result.data;
}

export function validateAndNormalizeGraph(
  rawNodes: unknown,
  rawEdges: unknown,
): { nodes: RoadmapNode[]; edges: RoadmapEdge[] } {
  const result = GraphSchema.safeParse({ nodes: rawNodes, edges: rawEdges });
  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message ?? 'Dữ liệu graph không hợp lệ.';
    throw new HttpError(400, 'VALIDATION_ERROR', firstIssue);
  }
  return result.data;
}
