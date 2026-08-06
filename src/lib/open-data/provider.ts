export type OpenDataResult<TResult, TQuery = unknown> = { success: boolean; provider: string; sourceName: string; query: TQuery; data: TResult | null; fetchedAt: string; errorMessage: string | null; isMock: boolean; cacheHit?: boolean };
export interface OpenDataProvider<TQuery, TResult> { providerName: string; fetch(query: TQuery): Promise<OpenDataResult<TResult, TQuery>>; }
