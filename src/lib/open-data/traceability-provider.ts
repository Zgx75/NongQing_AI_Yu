import { ConfigurableOpenDataProvider } from "./base-provider";
export const traceabilityProvider = new ConfigurableOpenDataProvider("traceability", "產銷履歷資料來源", "TRACEABILITY_API_BASE_URL", { records: [] });
