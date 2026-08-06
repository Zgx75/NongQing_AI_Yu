import { ConfigurableOpenDataProvider } from "./base-provider";
export const weatherProvider = new ConfigurableOpenDataProvider<{ county: string; district?: string }, { summary: string; temperatureC: number | null }>("weather", "天氣資料來源（示範）", "WEATHER_API_BASE_URL", { summary: "示範資料：多雲", temperatureC: null });
