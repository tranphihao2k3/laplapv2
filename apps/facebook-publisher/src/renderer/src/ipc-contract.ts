/**
 * Renderer-facing re-export.
 *
 * Renderer chỉ nên `import type { PublisherApi, IpcResult } from "@shared/publisher-api"`.
 * File này chỉ làm alias cho `@shared` alias của renderer.
 */
export type { PublisherApi, IpcResult } from "../../shared/publisher-api";
