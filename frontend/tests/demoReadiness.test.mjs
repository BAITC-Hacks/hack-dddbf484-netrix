import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('development preview switches the form and service outcome; controls have keyboard semantics', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/preview',
  });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Event: globalThis.Event,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
  let root;
  try {
    const { default: PreviewPage } = await vite.ssrLoadModule('/src/pages/PreviewPage.tsx');
    const { demoScenarios } = await vite.ssrLoadModule('/src/mocks/scenarios.ts');
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(PreviewPage)); });
    const flush = async () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await flush();

    const scenarioSelect = document.getElementById('preview-scenario');
    assert.equal(scenarioSelect.labels[0].textContent, 'Сценарий');
    assert.equal(scenarioSelect.options.length, 6);
    scenarioSelect.focus();
    assert.equal(document.activeElement, scenarioSelect);
    const ids = [...scenarioSelect.options].map((option) => option.value);
    for (const id of ids) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set;
        setter.call(scenarioSelect, id);
        scenarioSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      await flush();
      const scenario = demoScenarios[id];
      const form = document.querySelector('form.search-form');
      assert(form, `form available for ${id}: ${document.body.textContent}`);
      for (const field of ['city', 'category', 'event_date', 'event_format']) {
        assert.equal(form.elements.namedItem(field).value, scenario.request[field], `${id}: ${field}`);
      }
      assert.equal(Number(form.elements.namedItem('budget').value), scenario.request.budget);
      for (const field of ['city', 'category', 'event_date', 'budget', 'event_format', 'language', 'duration_minutes', 'wishes']) {
        const control = form.elements.namedItem(field);
        assert(control.closest('label')?.textContent.trim(), `${field} has a visible label`);
      }
      assert.equal(form.querySelector('button[type="submit"]').textContent.includes('Подобрать подрядчиков'), true);
      assert(form.querySelector('button[type="button"]').textContent.includes('Сбросить'));
      if (scenario.outcome.kind === 'response') {
        assert.equal(document.querySelectorAll('.vendor-card').length, scenario.outcome.response.cards.length);
        assert.equal(document.querySelector('.result-count').textContent, `Найдено: ${scenario.outcome.response.total_matches}`);
        if (scenario.outcome.response.shortfall_reason) {
          assert(document.body.textContent.includes(scenario.outcome.response.shortfall_reason));
        }
      } else {
        assert.equal(document.querySelectorAll('.vendor-card').length, 0);
        assert(document.querySelector('[role="alert"]').textContent.includes(scenario.outcome.message));
      }
    }

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set;
      setter.call(scenarioSelect, 'three_cards');
      scenarioSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await flush();
    const summary = document.querySelector('.vendor-card details summary');
    assert(summary);
    summary.focus();
    assert.equal(document.activeElement, summary);
    assert.equal(summary.parentElement.open, false);
    summary.click();
    assert.equal(summary.parentElement.open, true);
    const contact = document.querySelector('.vendor-card .contact-action button');
    assert.equal(contact.disabled, true);
    assert.equal(contact.getAttribute('aria-describedby'), contact.nextElementSibling.id);
    assert.equal(contact.nextElementSibling.textContent, 'Будет доступно после подключения сервиса');
    assert(!document.body.textContent.includes('Заявка отправлена'));

    const form = document.querySelector('form.search-form');
    await act(async () => {
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(document.querySelectorAll('.vendor-card').length, 3);
    await act(async () => {
      form.querySelector('button[type="button"]').click();
    });
    assert.equal(form.elements.namedItem('city').value, '');
    assert.equal(document.querySelectorAll('.vendor-card').length, 0);

    const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
    for (const selector of ['button:focus-visible', 'summary:focus-visible', 'input:focus-visible', 'select:focus-visible', 'textarea:focus-visible']) {
      assert(css.includes(selector), `${selector} has a visible focus style`);
    }
  } finally {
    if (root) await act(async () => { root.unmount(); });
    await vite.close();
    Object.assign(globalThis, previous);
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
    dom.window.close();
  }
});
