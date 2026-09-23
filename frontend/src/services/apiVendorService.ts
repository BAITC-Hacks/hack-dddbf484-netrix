import profiles from '../mocks/profiles.json';
import type {
  SearchOptions,
  SearchRequest,
  SearchResponse,
  VendorService,
} from './contracts';

type Profile = (typeof profiles)[number];

type BackendResponse = {
  status: 'matched' | 'no_category_in_city' | 'no_matches';
  message: string;
  total_matches: number;
  exclusions: {
    busy_date: number;
    event_format: number;
    over_budget: number;
    language: number;
    duration: number;
  };
  recommendations: Array<{
    id: string;
    anon_name: string;
    category: string;
    city: string;
    price_from_kzt: number;
    synthetic: boolean;
    city_imputed: boolean;
    price_imputed: boolean;
    explanation: string;
  }>;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
const profilesById = new Map<string, Profile>(profiles.map((profile) => [profile.id, profile]));

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'ru'));
}

const options: SearchOptions = {
  cities: unique(profiles.map((profile) => profile.city)),
  categories: unique(profiles.flatMap((profile) => profile.categories)),
  event_formats: unique(profiles.flatMap((profile) => profile.event_formats)),
  languages: unique(profiles.flatMap((profile) => profile.languages)),
  currency: 'KZT',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Не удалось связаться с сервером. Проверьте, что бэкенд запущен.');
  }

  if (!response.ok) {
    if (response.status === 422) {
      throw new Error('Сервер отклонил запрос. Проверьте дату и параметры поиска.');
    }
    throw new Error(`Ошибка сервера (${response.status}). Попробуйте ещё раз.`);
  }
  return response.json() as Promise<T>;
}

function mapResponse(data: BackendResponse): SearchResponse {
  const exclusion_summary = {
    busy: data.exclusions.busy_date,
    budget: data.exclusions.over_budget,
    event_format: data.exclusions.event_format,
    language: data.exclusions.language,
    duration: data.exclusions.duration,
  };

  return {
    status: data.status === 'matched' ? 'matches' : data.status,
    cards: data.recommendations.map((recommendation) => {
      const profile = profilesById.get(recommendation.id);
      if (!profile) throw new Error('Сервер вернул анкету, которой нет в каталоге. Обновите данные.');
      return {
        id: recommendation.id,
        name: recommendation.anon_name,
        city: recommendation.city,
        category: recommendation.category,
        price_from: recommendation.price_from_kzt,
        currency: 'KZT',
        price_unit: null,
        event_formats: profile.event_formats,
        description_detail: profile.description,
        explanations: [recommendation.explanation],
        synthetic: recommendation.synthetic,
        city_imputed: recommendation.city_imputed,
        price_imputed: recommendation.price_imputed,
      };
    }),
    total_matches: data.total_matches,
    excluded_busy: exclusion_summary.busy,
    exclusion_summary,
    shortfall_reason: data.status !== 'matched' || data.total_matches < 3 ? data.message : null,
  };
}

export const apiVendorService: VendorService = {
  async getOptions() {
    return options;
  },
  async search(searchRequest: SearchRequest) {
    const body = {
      city: searchRequest.city,
      event_date: searchRequest.event_date,
      event_format: searchRequest.event_format,
      category: searchRequest.category,
      budget_kzt: Math.floor(searchRequest.budget),
      ...(searchRequest.language && { language: searchRequest.language }),
      // The backend accepts whole hours. Round up so a fractional extra hour
      // cannot pass a vendor's availability limit by being rounded down.
      ...(searchRequest.duration_minutes !== undefined && {
        duration_hours: Math.ceil(searchRequest.duration_minutes / 60),
      }),
    };
    const data = await request<BackendResponse>('/match', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapResponse(data);
  },
};
