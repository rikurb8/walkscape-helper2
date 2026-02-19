import type { ParsedPage } from "./api.js";
import type { ExtractedDocument } from "./extract.js";

export const SUPPORTED_SCRAPE_COMMANDS = ["scrape-skills", "scrape-wiki"] as const;

export type ScrapeCommand = (typeof SUPPORTED_SCRAPE_COMMANDS)[number];

export type ScrapeProgressPhase = "collect" | "write";

export type ScrapeProgressStage = "start" | "progress" | "complete" | "warning";

export interface ScrapeProgressEvent {
  phase: ScrapeProgressPhase;
  stage: ScrapeProgressStage;
  message: string;
  current?: number;
  total?: number;
  sectionTitle?: string;
  pageTitle?: string;
}

export type ScrapeProgressHandler = (event: ScrapeProgressEvent) => void;

export interface ScrapeOptions {
  incremental?: boolean;
  onProgress?: ScrapeProgressHandler;
}

export interface ScrapeRunResult {
  command: ScrapeCommand;
  sectionCount: number;
  summary: Record<string, unknown>;
}

export interface PageRecord {
  sectionSlug: string;
  sectionTitle: string;
  title: string;
  slug: string;
  isRoot: boolean;
  parsed: ParsedPage;
  extracted: ExtractedDocument;
  outputRelpath: string;
}

export interface CollectionResult {
  sectionSlug: string;
  sectionTitle: string;
  rootTitle: string;
  pageRecords: PageRecord[];
  warnings: string[];
}

export interface WriteStats {
  docsWritten: number;
  docsSkipped: number;
  docsRemoved: number;
  rawWritten: number;
  rawSkipped: number;
  rawRemoved: number;
}

export type FetchCache = Map<string, { parsed: ParsedPage; extracted: ExtractedDocument }>;
