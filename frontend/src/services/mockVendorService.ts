import type { SearchRequest, VendorService } from './contracts';
import type { DemoScenario } from '../mocks/scenarios';
import { mockOptions } from '../mocks/vendors';

const requestFields = [
  'city',
  'category',
  'event_date',
  'budget',
  'event_format',
  'language',
  'duration_minutes',
  'wishes',
] as const satisfies readonly (keyof SearchRequest)[];

function sameRequest(actual: SearchRequest, expected: SearchRequest): boolean {
  return Object.keys(actual).every((key) => requestFields.includes(key as keyof SearchRequest)) &&
    requestFields.every((field) => actual[field] === expected[field]);
}

/** Return a single predefined demo outcome only for its exact request. */
export function createMockVendorService(
  scenario: DemoScenario,
  delayMs = 0,
): VendorService {
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError('delayMs must be a non-negative finite number');
  }

  async function delay(): Promise<void> {
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  return {
    async getOptions() {
      await delay();
      return structuredClone(mockOptions);
    },
    async search(request) {
      await delay();
      if (!sameRequest(request, scenario.request)) {
        throw new Error('Этот демонстрационный сценарий поддерживает только свой фиксированный запрос.');
      }
      if (scenario.outcome.kind === 'error') throw new Error(scenario.outcome.message);
      return structuredClone(scenario.outcome.response);
    },
  };
}
