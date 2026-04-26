import { z } from 'zod';

export const currencySchema = z.enum(['USD', 'RUB', 'UZS', 'EUR', '']);
export const fileSourceSchema = z.enum(['backend', 'device']);

export const cellStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  bgColor: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
  currency: currencySchema.optional(),
});

export const cellSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  formula: z.string().optional(),
  display: z.string().optional(),
  style: cellStyleSchema.default({}),
});

export const sheetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cells: z.record(z.string(), cellSchema),
  colWidths: z.record(z.string(), z.number()),
  rowHeights: z.record(z.string(), z.number()),
  visibleRowCount: z.number().int().nonnegative(),
  visibleColumnCount: z.number().int().positive(),
});

export const workbookSchema = z.object({
  sheets: z.array(sheetSchema).min(1),
  activeSheetId: z.string().min(1),
});

export const fileDescriptorSchema = z.object({
  source: fileSourceSchema,
  name: z.string().min(1),
  fileId: z.string().optional().nullable(),
  fileHandleId: z.string().optional().nullable(),
  driveFolderId: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  modifiedAt: z.string().optional().nullable(),
  lastOpenedAt: z.string().optional().nullable(),
});

export const workbookRecordInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  currentFileName: z.string().trim().max(255).nullable(),
  activeFile: fileDescriptorSchema.nullable(),
  workbook: workbookSchema,
});

export const workbookChunkedInitSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(255),
  currentFileName: z.string().trim().max(255).nullable(),
  activeFile: fileDescriptorSchema.nullable(),
  activeSheetId: z.string().min(1),
});

export const workbookChunkRowSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  cells: z.record(z.string(), cellSchema),
});

export const workbookChunkSheetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colWidths: z.record(z.string(), z.number()),
  rowHeights: z.record(z.string(), z.number()),
  visibleRowCount: z.number().int().nonnegative(),
  visibleColumnCount: z.number().int().positive(),
});

export const workbookChunkedSheetPayloadSchema = z.object({
  position: z.number().int().nonnegative(),
  sheet: workbookChunkSheetSchema,
  rows: z.array(workbookChunkRowSchema),
});

export type CellStyle = z.infer<typeof cellStyleSchema>;
export type CellRecord = z.infer<typeof cellSchema>;
export type SheetRecord = z.infer<typeof sheetSchema>;
export type WorkbookRecord = z.infer<typeof workbookSchema>;
export type WorkbookRecordInput = z.infer<typeof workbookRecordInputSchema>;
export type WorkbookChunkedInit = z.infer<typeof workbookChunkedInitSchema>;
export type WorkbookChunkedSheetPayload = z.infer<typeof workbookChunkedSheetPayloadSchema>;
