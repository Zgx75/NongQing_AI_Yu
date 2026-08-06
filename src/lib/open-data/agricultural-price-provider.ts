import { ConfigurableOpenDataProvider } from "./base-provider";
export const agriculturalPriceProvider = new ConfigurableOpenDataProvider("agricultural-price", "農產品價格資料來源", "AGRICULTURAL_PRICE_API_BASE_URL", { prices: [] });
