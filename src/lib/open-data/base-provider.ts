import { cached } from "./cache";
import type { OpenDataProvider, OpenDataResult } from "./provider";

export class ConfigurableOpenDataProvider<TQuery extends object, TResult> implements OpenDataProvider<TQuery, TResult> {
  constructor(public providerName: string, private sourceName: string, private envKey: string, private mockData: TResult) {}
  async fetch(query: TQuery): Promise<OpenDataResult<TResult, TQuery>> {
    const isMock = process.env.OPEN_DATA_MODE !== "live"; const url = process.env[this.envKey];
    if (!isMock && !url) return { success: false, provider: this.providerName, sourceName: this.sourceName, query, data: null, fetchedAt: new Date().toISOString(), errorMessage: "Data is unavailable because the data source is not configured.", isMock: false };
    try {
      const result = await cached(`${this.providerName}:${JSON.stringify(query)}`, 15 * 60_000, async () => {
        if (isMock) return this.mockData;
        const endpoint = new URL(url!); Object.entries(query).forEach(([k,v]) => endpoint.searchParams.set(k, String(v)));
        const response = await fetch(endpoint); if (!response.ok) throw new Error("upstream unavailable"); return await response.json() as TResult;
      });
      return { success: true, provider: this.providerName, sourceName: this.sourceName, query, data: result.data, fetchedAt: new Date().toISOString(), errorMessage: null, isMock, cacheHit: result.cacheHit };
    } catch { return { success: false, provider: this.providerName, sourceName: this.sourceName, query, data: null, fetchedAt: new Date().toISOString(), errorMessage: "Data is temporarily unavailable.", isMock }; }
  }
}
