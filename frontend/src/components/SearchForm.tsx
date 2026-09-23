import { useState, type FormEvent } from 'react';
import type { SearchOptions, SearchRequest } from '../services/contracts';
import { Button } from './Button';
import { Surface } from './Surface';

export type SearchFormProps = {
  options: SearchOptions;
  initialValues?: SearchRequest;
  loading: boolean;
  onSubmit: (request: SearchRequest) => void;
};

type Props = SearchFormProps & { onReset?: () => void };
type Field = 'city' | 'category' | 'event_date' | 'budget' | 'event_format' | 'language' | 'duration_minutes' | 'wishes';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const firstDate = '2026-09-23';
const lastDate = '2026-12-31';

function initialFields(request?: SearchRequest): Values {
  return {
    city: request?.city ?? '',
    category: request?.category ?? '',
    event_date: request?.event_date ?? '',
    budget: request?.budget === undefined ? '' : String(request.budget),
    event_format: request?.event_format ?? '',
    language: request?.language ?? '',
    duration_minutes: request?.duration_minutes === undefined ? '' : String(request.duration_minutes),
    wishes: request?.wishes ?? '',
  };
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function validate(values: Values, options: SearchOptions): Errors {
  const errors: Errors = {};
  if (!options.cities.includes(values.city)) errors.city = 'Выберите город.';
  if (!options.categories.includes(values.category)) errors.category = 'Выберите категорию.';
  if (!validCalendarDate(values.event_date) || values.event_date < firstDate || values.event_date > lastDate) {
    errors.event_date = 'Выберите дату с 23.09.2026 по 31.12.2026.';
  }
  if (values.budget.trim() === '' || !Number.isFinite(Number(values.budget)) || Number(values.budget) <= 0) {
    errors.budget = 'Укажите положительный бюджет.';
  }
  if (!options.event_formats.includes(values.event_format)) errors.event_format = 'Выберите формат.';
  if (values.language && !options.languages.includes(values.language)) errors.language = 'Выберите язык из списка.';
  if (values.duration_minutes.trim() && (!Number.isSafeInteger(Number(values.duration_minutes)) || Number(values.duration_minutes) <= 0)) {
    errors.duration_minutes = 'Укажите положительное число минут.';
  }
  return errors;
}

export function SearchForm({ options, initialValues, loading, onSubmit, onReset }: Props) {
  const [values, setValues] = useState<Values>(() => initialFields(initialValues));
  const [errors, setErrors] = useState<Errors>({});

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validate(values, options);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({
      city: values.city,
      category: values.category,
      event_date: values.event_date,
      budget: Number(values.budget),
      event_format: values.event_format,
      ...(values.language && { language: values.language }),
      ...(values.duration_minutes.trim() && { duration_minutes: Number(values.duration_minutes) }),
      ...(values.wishes.trim() && { wishes: values.wishes.trim() }),
    });
  }

  function reset() {
    setValues(initialFields());
    setErrors({});
    onReset?.();
  }

  return (
    <Surface className="search-surface">
      <form className="search-form" onSubmit={submit} noValidate aria-labelledby="form-title">
        <div className="form-heading">
          <span className="step-marker">01</span>
          <div>
            <h2 id="form-title">Расскажите о событии</h2>
            <p>Детали помогут найти вашу команду</p>
          </div>
        </div>
        <fieldset disabled={loading}>
          <label>
            Город
            <select name="city" value={values.city} onChange={(event) => change('city', event.target.value)} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'city-error' : undefined}>
              <option value="">Выберите город</option>
              {options.cities.map((city) => <option key={city}>{city}</option>)}
            </select>
            {errors.city && <span className="field-error" id="city-error" role="alert">{errors.city}</span>}
          </label>
          <label>
            Кого ищем?
            <select name="category" value={values.category} onChange={(event) => change('category', event.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'category-error' : undefined}>
              <option value="">Выберите категорию</option>
              {options.categories.map((category) => <option key={category}>{category}</option>)}
            </select>
            {errors.category && <span className="field-error" id="category-error" role="alert">{errors.category}</span>}
          </label>
          <div className="field-row">
            <label>
              Дата события
              <input name="event_date" type="date" min={firstDate} max={lastDate} value={values.event_date} onChange={(event) => change('event_date', event.target.value)} aria-invalid={Boolean(errors.event_date)} aria-describedby={errors.event_date ? 'date-error' : undefined} />
              {errors.event_date && <span className="field-error" id="date-error" role="alert">{errors.event_date}</span>}
            </label>
            <label>
              Бюджет, {options.currency === 'KZT' ? '₸' : options.currency}
              <input name="budget" type="number" min="0.01" step="any" value={values.budget} onChange={(event) => change('budget', event.target.value)} aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'budget-error' : undefined} />
              {errors.budget && <span className="field-error" id="budget-error" role="alert">{errors.budget}</span>}
            </label>
          </div>
          <label>
            Формат события
            <select name="event_format" value={values.event_format} onChange={(event) => change('event_format', event.target.value)} aria-invalid={Boolean(errors.event_format)} aria-describedby={errors.event_format ? 'format-error' : undefined}>
              <option value="">Выберите формат</option>
              {options.event_formats.map((format) => <option key={format}>{format}</option>)}
            </select>
            {errors.event_format && <span className="field-error" id="format-error" role="alert">{errors.event_format}</span>}
          </label>
          <details className="more-options">
            <summary>Дополнительные пожелания <span aria-hidden="true">+</span></summary>
            <div className="additional-fields">
              <label>
                Язык
                <select name="language" value={values.language} onChange={(event) => change('language', event.target.value)} aria-invalid={Boolean(errors.language)} aria-describedby={errors.language ? 'language-error' : undefined}>
                  <option value="">Любой язык</option>
                  {options.languages.map((language) => <option key={language}>{language}</option>)}
                </select>
                {errors.language && <span className="field-error" id="language-error" role="alert">{errors.language}</span>}
              </label>
              <label>
                Длительность, минут
                <input name="duration_minutes" type="number" min="1" step="1" value={values.duration_minutes} onChange={(event) => change('duration_minutes', event.target.value)} placeholder="Например, 180" aria-invalid={Boolean(errors.duration_minutes)} aria-describedby={errors.duration_minutes ? 'duration-error duration-note' : 'duration-note'} />
                {errors.duration_minutes && <span className="field-error" id="duration-error" role="alert">{errors.duration_minutes}</span>}
              </label>
              <p className="field-note" id="duration-note">Длительность округляется вверх до целого часа и учитывается при подборе.</p>
              <label>
                Что для вас важно?
                <textarea name="wishes" rows={3} maxLength={2000} value={values.wishes} onChange={(event) => change('wishes', event.target.value)} placeholder="Атмосфера, стиль, особые моменты…" aria-describedby="wishes-note" />
              </label>
              <p className="field-note" id="wishes-note">Пожелания сохраняются только в этой форме и пока не влияют на подбор.</p>
            </div>
          </details>
          <Button type="submit">
            {loading ? 'Подбираем подрядчиков…' : 'Подобрать подрядчиков'}
            <span aria-hidden="true">↗</span>
          </Button>
        </fieldset>
        <Button type="button" variant="secondary" className="reset-button" onClick={reset}>Сбросить</Button>
        <p className="form-footnote">Без регистрации. С объяснением каждого совпадения.</p>
      </form>
    </Surface>
  );
}
