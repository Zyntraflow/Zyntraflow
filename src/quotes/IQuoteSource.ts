import type { QuoteRequest, QuoteResponse, QuoteSourceName } from "./types";

export interface IQuoteSource {
  name: QuoteSourceName;
  getQuote(req: QuoteRequest): Promise<QuoteResponse>;
}
