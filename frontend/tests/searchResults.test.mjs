import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('results render every service outcome in service order and keep explanations on their cards', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const { demoScenarios } = await vite.ssrLoadModule('/src/mocks/scenarios.ts');
    const { SearchResults, SearchResultsPlaceholder } = await vite.ssrLoadModule('/src/components/SearchResults.tsx');
    const show = (Component, props) => new JSDOM(renderToStaticMarkup(createElement(Component, props))).window.document;
    const response = (name) => demoScenarios[name].outcome.response;
    const cardsIn = (document) => [...document.querySelectorAll('.vendor-card')];

    const three = response('three_cards');
    const threeDocument = show(SearchResults, { response: three });
    assert.deepEqual(cardsIn(threeDocument).map((card) => card.dataset.vendorId), three.cards.map((card) => card.id));
    assert.match(threeDocument.body.textContent, /Исключено из-за занятости: 0/);
    for (const [index, article] of cardsIn(threeDocument).entries()) {
      const card = three.cards[index];
      assert.equal(article.querySelector('h3').textContent, card.name);
      assert(article.textContent.includes(card.city));
      assert(article.textContent.includes(card.category));
      assert(article.textContent.includes(card.description_detail));
      for (const format of card.event_formats) assert(article.textContent.includes(format));
      assert(article.textContent.includes(new Intl.NumberFormat('ru-KZ', {
        style: 'currency', currency: card.currency, maximumFractionDigits: 2,
      }).format(card.price_from)));
      assert.equal(article.querySelector('details').open, false);
      assert.equal(article.querySelector('details summary').textContent, 'Почему подходит');
      assert.deepEqual([...article.querySelectorAll('details li')].map((item) => item.textContent), card.explanations);
      assert.equal(article.textContent.includes('Демонстрационный профиль'), card.synthetic);
      assert.equal(article.textContent.includes('Оценочная цена'), card.price_imputed);
      assert.equal(article.textContent.includes('Город дополнен'), card.city_imputed);
    }

    const two = response('two_cards_with_reason');
    const twoDocument = show(SearchResults, { response: two });
    assert.equal(cardsIn(twoDocument).length, 2);
    assert(twoDocument.body.textContent.includes(two.shortfall_reason));
    assert.match(twoDocument.body.textContent, /Исключено из-за занятости: 1/);

    const one = response('one_card');
    const oneDocument = show(SearchResults, { response: one });
    assert.equal(cardsIn(oneDocument).length, 1);
    assert(oneDocument.body.textContent.includes(one.shortfall_reason));
    assert.match(oneDocument.querySelector('.vendor-card').textContent, /Оценочная цена/);
    assert.match(oneDocument.querySelector('.vendor-card').textContent, /Город дополнен/);

    const noCategory = response('no_category_in_city');
    const noCategoryDocument = show(SearchResults, { response: noCategory });
    assert.equal(cardsIn(noCategoryDocument).length, 0);
    assert.match(noCategoryDocument.body.textContent, /нет специалистов этой категории в городе/);
    assert(noCategoryDocument.body.textContent.includes(noCategory.shortfall_reason));

    const excluded = response('all_candidates_excluded');
    const excludedDocument = show(SearchResults, { response: excluded });
    assert.equal(cardsIn(excludedDocument).length, 0);
    assert.match(excludedDocument.body.textContent, /Все кандидаты исключены по условиям/);
    assert(excludedDocument.body.textContent.includes(excluded.shortfall_reason));
    assert.match(excludedDocument.body.textContent, /Исключено из-за занятости: 1/);
    assert.deepEqual([...excludedDocument.querySelectorAll('.exclusion-summary li')].map((item) => item.textContent), [
      '1 — заняты на дату', '2 — выше бюджета',
    ]);

    const loadingDocument = show(SearchResultsPlaceholder, { loading: true });
    assert(loadingDocument.querySelector('[role="status"].results-skeleton'));
    assert(loadingDocument.querySelector('.results[aria-busy="true"]'));
    const errorMessage = demoScenarios.service_error.outcome.message;
    const errorDocument = show(SearchResultsPlaceholder, { error: errorMessage });
    assert(errorDocument.querySelector('[role="alert"]').textContent.includes(errorMessage));
    const initialDocument = show(SearchResultsPlaceholder, {});
    assert.match(initialDocument.body.textContent, /Найдём тех, кто вас поймёт/);
    for (const document of [threeDocument, loadingDocument, errorDocument]) {
      assert.match(document.body.textContent, /Демонстрационный режим/);
    }

    const extra = one.cards[0];
    const limited = show(SearchResults, { response: { ...three, cards: [...three.cards, extra], total_matches: 4 } });
    assert.deepEqual(cardsIn(limited).map((card) => card.dataset.vendorId), three.cards.map((card) => card.id));
    assert.match(limited.body.textContent, /Найдено: 4/);

    const mixed = [three.cards[0], one.cards[0], two.cards[0]];
    const mixedDocument = show(SearchResults, { response: { ...three, cards: mixed } });
    for (const [index, article] of cardsIn(mixedDocument).entries()) {
      assert.deepEqual([...article.querySelectorAll('details li')].map((item) => item.textContent), mixed[index].explanations);
    }
  } finally {
    await vite.close();
  }
});
