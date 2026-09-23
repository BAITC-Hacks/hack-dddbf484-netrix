import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('form validates input, sends exact values to the service, blocks repeats and resets', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Event: globalThis.Event,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
  let root;
  let vendorService;
  let originalSearch;
  try {
    const { default: SearchPage } = await vite.ssrLoadModule('/src/pages/SearchPage.tsx');
    ({ vendorService } = await vite.ssrLoadModule('/src/services/vendorService.ts'));
    const { activeDemoRequest } = await vite.ssrLoadModule('/src/services/vendorService.ts');
    const { demoScenarios } = await vite.ssrLoadModule('/src/mocks/scenarios.ts');
    const { createMockVendorService } = await vite.ssrLoadModule('/src/services/mockVendorService.ts');
    originalSearch = createMockVendorService(demoScenarios.three_cards).search;
    const calls = [];
    vendorService.search = async (request) => {
      calls.push(request);
      return originalSearch(request);
    };

    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(SearchPage)); });
    const form = document.querySelector('form.search-form');
    assert(form, 'options should load through getOptions()');
    const field = (name) => form.elements.namedItem(name);
    const set = async (name, value) => {
      await act(async () => {
        const element = field(name);
        const descriptor = Object.getOwnPropertyDescriptor(
          element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype
            : element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype
              : dom.window.HTMLInputElement.prototype,
          'value',
        );
        descriptor.set.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      });
    };
    const submit = async () => act(async () => {
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });

    await set('event_date', '2026-09-22');
    await set('budget', '0');
    await set('duration_minutes', '-1');
    await submit();
    assert.equal(calls.length, 0);
    assert.match(document.querySelector('#date-error')?.textContent ?? '', /23\.09\.2026/);
    assert.match(document.querySelector('#budget-error')?.textContent ?? '', /положительный/);
    assert.match(document.querySelector('#duration-error')?.textContent ?? '', /положительное/);

    await set('event_date', activeDemoRequest.event_date);
    await set('budget', String(activeDemoRequest.budget));
    await set('duration_minutes', '');
    await submit();
    assert.deepEqual(calls, [activeDemoRequest]);
    assert.equal(document.querySelectorAll('.vendor-card').length, 3);

    await act(async () => {
      [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Сбросить')).click();
    });
    assert.equal(field('city').value, '');
    assert.equal(field('category').value, '');
    assert.equal(field('event_date').value, '');
    assert.equal(field('budget').value, '');
    assert.equal(document.querySelectorAll('.vendor-card').length, 0);
    await submit();
    assert.equal(calls.length, 1);
    assert(document.querySelector('#city-error'));

    await set('city', activeDemoRequest.city);
    await set('category', activeDemoRequest.category);
    await set('event_date', '2026-12-31');
    await set('budget', '100');
    await set('event_format', activeDemoRequest.event_format);
    const selectedLanguage = field('language').options[1].value;
    await set('language', selectedLanguage);
    await set('duration_minutes', '180');
    await set('wishes', '  Тёплая атмосфера  ');
    await submit();
    assert.deepEqual(calls[1], {
      city: activeDemoRequest.city,
      category: activeDemoRequest.category,
      event_date: '2026-12-31',
      budget: 100,
      event_format: activeDemoRequest.event_format,
      language: selectedLanguage,
      duration_minutes: 180,
      wishes: 'Тёплая атмосфера',
    });

    await set('event_date', activeDemoRequest.event_date);
    await set('budget', String(activeDemoRequest.budget));
    await set('language', '');
    await set('duration_minutes', '');
    await set('wishes', '');
    let finishSearch;
    vendorService.search = (request) => {
      calls.push(request);
      return new Promise((resolve) => { finishSearch = resolve; });
    };
    await act(async () => {
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(calls.length, 3, 'loading blocks a duplicate submission');
    assert.equal(form.querySelector('fieldset').disabled, true);
    await act(async () => {
      [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Сбросить')).click();
    });
    await act(async () => { finishSearch(await originalSearch(activeDemoRequest)); });
    assert.equal(document.querySelectorAll('.vendor-card').length, 0, 'late response does not restore a cleared result');
    assert.equal(field('city').value, '');
  } finally {
    if (vendorService && originalSearch) vendorService.search = originalSearch;
    if (root) await act(async () => { root.unmount(); });
    await vite.close();
    Object.assign(globalThis, previous);
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
    dom.window.close();
  }
});
