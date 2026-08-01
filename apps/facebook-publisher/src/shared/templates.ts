/**
 * Shared types — templates (TPL-001/TPL-002).
 */
import type { TemplateRow } from "./db-types";

export type TemplateRecord = {
  id: string;
  name: string;
  body: string;
  allowlistedVariables: string[];
  contentText: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type TemplateInput = {
  name: string;
  body: string;
  allowlistedVariables: string[];
  previewContext?: Record<string, unknown>;
  previewLocale?: string;
};

export type TemplatePreviewRequest = {
  body: string;
  context: Record<string, unknown>;
  locale?: string;
};

export type TemplatePreviewResponse = {
  text: string;
};

export type { TemplateRow };