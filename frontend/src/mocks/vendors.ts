import vendors from './vendors.json';
import type { SearchOptions } from '../services/contracts';

/** One mapped row per supplied profile, with all source provenance retained. */
export type MockVendorRecord = {
  id: string;
  name: string;
  categories: string[];
  city: string;
  price_from: number;
  currency: string;
  price_unit: string | null;
  event_formats: string[];
  languages: string[];
  max_hours: number | null;
  busy_dates: string[];
  description_detail: string;
  synthetic: boolean;
  price_imputed: boolean;
  city_imputed: boolean;
};

// Scenario fixtures consume this complete 1:1 mapping, never generated profiles.
export const mockVendors: readonly MockVendorRecord[] = vendors;

const unique = (values: string[]) => [...new Set(values)];

export const mockOptions: SearchOptions = {
  cities: unique(mockVendors.map((vendor) => vendor.city)),
  categories: unique(mockVendors.flatMap((vendor) => vendor.categories)),
  event_formats: unique(mockVendors.flatMap((vendor) => vendor.event_formats)),
  languages: unique(mockVendors.flatMap((vendor) => vendor.languages)),
  currency: 'KZT',
};
