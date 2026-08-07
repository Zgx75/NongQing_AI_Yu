import { ConfigurableOpenDataProvider } from "./base-provider";
export const agriculturalPriceProvider = new ConfigurableOpenDataProvider("agricultural-price", "Agricultural Price Data Source", "AGRICULTURAL_PRICE_API_BASE_URL", { prices: [] });
