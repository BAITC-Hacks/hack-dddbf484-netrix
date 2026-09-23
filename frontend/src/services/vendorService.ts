import { demoScenarios, type DemoScenarioId } from '../mocks/scenarios';
import type { SearchRequest, VendorService } from './contracts';
import { apiVendorService } from './apiVendorService';
import { createMockVendorService } from './mockVendorService';

export type { VendorService } from './contracts';

/**
 * The only service entry point used by pages.
 * The live page uses the HTTP adapter. The local mock stays available for
 * deterministic preview scenarios during development.
 */
const activeScenario = demoScenarios.three_cards;

export const vendorService: VendorService = apiVendorService;
export const activeDemoRequest = activeScenario.request;

/** Development-only preview metadata; pages still obtain responses through VendorService. */
const previewLabels: Record<DemoScenarioId, string> = {
  three_cards: 'Три карточки',
  two_cards_with_reason: 'Две карточки и причина',
  one_card: 'Одна карточка',
  no_category_in_city: 'Нет категории в городе',
  all_candidates_excluded: 'Все кандидаты исключены',
  service_error: 'Ошибка сервиса',
};

export type PreviewScenario = { id: DemoScenarioId; label: string; request: SearchRequest };

export function getDemoPreviewScenarios(): PreviewScenario[] {
  if (!import.meta.env.DEV) return [];
  return Object.values(demoScenarios).map((scenario) => ({
    id: scenario.id,
    label: previewLabels[scenario.id],
    request: structuredClone(scenario.request),
  }));
}

export function createDemoPreviewService(id: DemoScenarioId): VendorService {
  if (!import.meta.env.DEV) throw new Error('Предпросмотр доступен только в режиме разработки.');
  return createMockVendorService(demoScenarios[id]);
}
