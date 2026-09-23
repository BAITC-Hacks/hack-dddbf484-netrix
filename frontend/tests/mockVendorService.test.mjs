import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('all six dataset-based service scenarios preserve their request/outcome contract', async () => {
  const original = JSON.parse(await readFile(new URL('../src/mocks/profiles.json', import.meta.url)));
  const mapped = JSON.parse(await readFile(new URL('../src/mocks/vendors.json', import.meta.url)));
  assert.equal(original.length, 66);
  assert.equal(mapped.length, 66);
  assert.equal(new Set(mapped.map((vendor) => vendor.id)).size, 66);
  assert.equal(mapped.filter((vendor) => vendor.synthetic).length, 13);

  const sourceById = new Map(original.map((vendor) => [vendor.id, vendor]));
  for (const vendor of mapped) {
    const source = sourceById.get(vendor.id);
    assert(source, `Unknown id ${vendor.id}`);
    assert.equal(vendor.name, source.anon_name);
    assert.equal(vendor.city, source.city);
    assert.deepEqual(vendor.categories, source.categories);
    assert.equal(vendor.price_from, source.price_from_kzt);
    assert.equal(vendor.currency, 'KZT');
    assert.equal(vendor.price_unit, null);
    assert.deepEqual(vendor.event_formats, source.event_formats);
    assert.deepEqual(vendor.languages, source.languages);
    assert.deepEqual(vendor.busy_dates, source.busy_dates);
    assert.equal(vendor.max_hours, source.max_hours);
    assert.equal(vendor.description_detail, source.description);
    for (const flag of ['synthetic', 'price_imputed', 'city_imputed']) {
      assert.equal(vendor[flag], source[flag]);
      assert.equal(typeof vendor[flag], 'boolean');
    }
  }

  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const { demoScenarios } = await vite.ssrLoadModule('/src/mocks/scenarios.ts');
    const { createMockVendorService } = await vite.ssrLoadModule('/src/services/mockVendorService.ts');
    const { apiVendorService } = await vite.ssrLoadModule('/src/services/apiVendorService.ts');
    const { vendorService, activeDemoRequest } = await vite.ssrLoadModule('/src/services/vendorService.ts');
    const { SearchForm } = await vite.ssrLoadModule('/src/components/SearchForm.tsx');

    const expected = {
      three_cards: ['matches', 3, 0],
      two_cards_with_reason: ['matches', 2, 1],
      one_card: ['matches', 1, 1],
      no_category_in_city: ['no_category_in_city', 0, 0],
      all_candidates_excluded: ['no_matches', 0, 1],
      service_error: ['error', null, null],
    };
    assert.deepEqual(Object.keys(demoScenarios).sort(), Object.keys(expected).sort());
    assert.deepEqual(activeDemoRequest, demoScenarios.three_cards.request);
    const initialForm = renderToStaticMarkup(createElement(SearchForm, {
      options: await vendorService.getOptions(),
      initialValues: activeDemoRequest,
      loading: false,
      onSubmit: () => {},
    }));
    assert(initialForm.includes('value="2026-10-11"'));
    assert(initialForm.includes('value="3000000"'));

    for (const [key, scenario] of Object.entries(demoScenarios)) {
      const [status, cardCount, busyCount] = expected[key];
      assert.equal(scenario.id, key);
      for (const field of ['city', 'category', 'event_date', 'event_format']) {
        assert.equal(typeof scenario.request[field], 'string');
      }
      assert.equal(typeof scenario.request.budget, 'number');
      const service = createMockVendorService(scenario);
      const options = await service.getOptions();
      assert.deepEqual(new Set(options.cities), new Set(original.map((vendor) => vendor.city)));
      assert.deepEqual(new Set(options.categories), new Set(original.flatMap((vendor) => vendor.categories)));
      options.cities.push('changed');
      assert(!(await service.getOptions()).cities.includes('changed'));

      if (status === 'error') {
        assert.equal(scenario.outcome.kind, 'error');
        await assert.rejects(service.search(scenario.request), /Демонстрационная ошибка сервиса/);
      } else {
        assert.equal(scenario.outcome.kind, 'response');
        const result = await service.search(scenario.request);
        assert.deepEqual(result, scenario.outcome.response);
        assert.equal(result.status, status);
        assert.equal(result.cards.length, cardCount);
        assert.equal(result.total_matches, cardCount);
        assert.equal(result.excluded_busy, busyCount);
        assert.equal(result.excluded_busy, result.exclusion_summary.busy);
        const candidates = original.filter(
          (vendor) => vendor.city === scenario.request.city && vendor.categories.includes(scenario.request.category),
        );
        if (status === 'no_category_in_city') assert.equal(candidates.length, 0);
        else assert(candidates.length > 0);
        const busy = candidates.filter((vendor) => vendor.busy_dates.includes(scenario.request.event_date));
        const overBudget = candidates.filter(
          (vendor) => !busy.includes(vendor) && vendor.price_from_kzt > scenario.request.budget,
        );
        const eligible = candidates.filter(
          (vendor) => !busy.includes(vendor) &&
            vendor.price_from_kzt <= scenario.request.budget &&
            vendor.event_formats.includes(scenario.request.event_format),
        );
        assert.equal(result.exclusion_summary.busy, busy.length);
        assert.equal(result.exclusion_summary.budget, overBudget.length);
        assert.deepEqual(new Set(result.cards.map((card) => card.id)), new Set(eligible.map((vendor) => vendor.id)));
        if (key === 'two_cards_with_reason') {
          assert.equal(candidates.length, 3);
          assert.equal(candidates.filter((vendor) => vendor.busy_dates.includes(scenario.request.event_date)).length, 1);
          assert.match(result.shortfall_reason, /HK-11484/);
        }
        if (key === 'all_candidates_excluded') {
          assert.equal(candidates.length, 3);
          assert.equal(result.exclusion_summary.budget, 2);
          assert.match(result.shortfall_reason, /бюджета/);
        }
        for (const card of result.cards) {
          const source = sourceById.get(card.id);
          assert(source);
          assert.equal(card.name, source.anon_name);
          assert.equal(card.description_detail, source.description);
          assert.equal(card.price_from, source.price_from_kzt);
          assert(source.categories.includes(card.category));
          assert.equal(card.city, scenario.request.city);
          assert(!source.busy_dates.includes(scenario.request.event_date));
          assert(source.event_formats.includes(scenario.request.event_format));
          assert(card.price_from <= scenario.request.budget);
          for (const flag of ['synthetic', 'price_imputed', 'city_imputed']) {
            assert.equal(card[flag], source[flag]);
          }
        }
        if (result.cards.length) {
          result.cards[0].explanations.push('mutation');
          assert(!(await service.search(scenario.request)).cards[0].explanations.includes('mutation'));
        }
      }

      await assert.rejects(
        service.search({ ...scenario.request, budget: scenario.request.budget + 1 }),
        /Этот демонстрационный сценарий поддерживает только свой фиксированный запрос/,
      );
      await assert.rejects(
        service.search({ ...scenario.request, unexpected: true }),
        /Этот демонстрационный сценарий поддерживает только свой фиксированный запрос/,
      );
    }

    assert.equal(vendorService, apiVendorService);
    assert.equal((await createMockVendorService(demoScenarios.three_cards).search(activeDemoRequest)).cards.length, 3);
    assert.equal((await createMockVendorService(demoScenarios.one_card, 1).search(demoScenarios.one_card.request)).cards.length, 1);
    assert.throws(() => createMockVendorService(demoScenarios.one_card, -1), RangeError);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('Unexpected network call'); };
    try {
      assert.equal((await apiVendorService.getOptions()).currency, 'KZT');
      await assert.rejects(apiVendorService.search(activeDemoRequest), /Не удалось связаться с сервером/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await vite.close();
  }
});
