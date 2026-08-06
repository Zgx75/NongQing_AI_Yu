import type { ExtractFarmRecordInput, ExtractFarmRecordResult, GenerateBrandCopyInput, GeneratedBrandCopy, GenerateFarmJournalInput, GeneratedDocument, GenerateTraceabilityInput } from "./schemas";

export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  extractFarmRecord(input: ExtractFarmRecordInput): Promise<ExtractFarmRecordResult>;
  generateFarmJournal(input: GenerateFarmJournalInput): Promise<GeneratedDocument>;
  generateTraceabilityDraft(input: GenerateTraceabilityInput): Promise<GeneratedDocument>;
  generateBrandCopy(input: GenerateBrandCopyInput): Promise<GeneratedBrandCopy>;
  getLastRawResponse?(): string;
}
