/**
 * Shared types cho Groups / Group Sets — GRP-001 + GRP-002.
 */
import type { PostingMode } from "./db-types";

export type { PostingMode };

export type GroupRecord = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  locale: string | null;
  notes: string | null;
  maxImages: number;
  allowLink: boolean;
  postingMode: PostingMode;
  createdAt: string;
  updatedAt: string | null;
};

export type GroupSetRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type GroupSetWithMembers = {
  set: GroupSetRecord;
  members: GroupRecord[];
};

export type GroupUpsert = {
  name: string;
  url: string;
  enabled?: boolean;
  locale?: string | null;
  notes?: string | null;
  maxImages?: number;
  allowLink?: boolean;
  postingMode?: PostingMode;
};