/** Preliminary UI contract. Adapt backend DTOs in services, not in components. */
export type SearchRequest = {
  city: string;
  category: string;
  /** Calendar date in YYYY-MM-DD format, without time or timezone. */
  event_date: string;
  /** Maximum budget in the currency supplied by SearchOptions. */
  budget: number;
  event_format: string;
  language?: string;
  /** Requested working time; never inferred from a priced hour package. */
  duration_minutes?: number;
  wishes?: string;
};

export type SearchStatus = 'matches' | 'no_category_in_city' | 'no_matches';

export type SearchOptions = {
  cities: string[];
  categories: string[];
  event_formats: string[];
  languages: string[];
  /** ISO 4217 code; all search budgets use this currency. */
  currency: string;
};

export type VendorCard = {
  id: string;
  name: string;
  city: string;
  category: string;
  /** Starting price, not a guaranteed quote for the entire event. */
  price_from: number;
  currency: string;
  /** null means the source does not specify a pricing unit. */
  price_unit: string | null;
  event_formats: string[];
  /** An individual detail grounded in the vendor's description. */
  description_detail: string;
  explanations: string[];
  synthetic: boolean;
  city_imputed: boolean;
  price_imputed: boolean;
};

export type ExclusionReason = 'busy' | 'budget' | 'event_format' | 'language' | 'duration';

/** Counts within the selected city/category, one primary reason per vendor. */
export type ExclusionSummary = Record<ExclusionReason, number>;

export type SearchResponse = {
  status: SearchStatus;
  cards: VendorCard[];
  /** Number of matches before any future pagination. */
  total_matches: number;
  /** Equal to exclusion_summary.busy. */
  excluded_busy: number;
  exclusion_summary: ExclusionSummary;
  /** Human-readable reason for a shortfall, or null when there is none. */
  shortfall_reason: string | null;
};

export interface VendorService {
  getOptions(): Promise<SearchOptions>;
  search(request: SearchRequest): Promise<SearchResponse>;
}
