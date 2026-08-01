/**
 * Shared campaign types — CMP-001/002/003.
 */
import type { CampaignStatus, JobState } from "./db-types";

export type { CampaignStatus, JobState };

export type CampaignRecord = {
  id: string;
  name: string;
  productId: string;
  variantId: string;
  templateId: string;
  groupSetId: string | null;
  imagePaths: string[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string | null;
};

export type CampaignInput = {
  name: string;
  productId: string;
  variantId: string;
  templateId: string;
  groupSetId?: string | null;
  imagePaths?: string[];
  status?: CampaignStatus;
};

export type EnqueueRequest = {
  campaignId: string;
  imageUrls?: string[];
  imageSha256s?: string[];
};

export type EnqueueResult = {
  campaignId: string;
  jobsCreated: number;
  duplicates: number;
  errors: string[];
};

export type CampaignJobSummary = {
  id: string;
  campaignId: string;
  groupId: string;
  state: JobState;
  fingerprint: string;
  submitClickedAt: string | null;
  postUrl: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
};