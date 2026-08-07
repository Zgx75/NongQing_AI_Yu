import { ConfigurableOpenDataProvider } from "./base-provider";
export const weatherProvider = new ConfigurableOpenDataProvider<{ county: string; district?: string }, { summary: string; temperatureC: number | null }>("weather", "Weather Data Source (Demo)", "WEATHER_API_BASE_URL", { summary: "Demo data: Cloudy", temperatureC: null });
