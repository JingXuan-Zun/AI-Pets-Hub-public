import { describeWeatherCode } from '../components/chat/hub/useHubWeather';

// Weather for the character (“今天要带伞吗”). Same free, key-less sources as the hub weather
// card: Open-Meteo for the forecast, its place search for a named city, and IP-based location
// (ipapi.co, sends the public IP — as the card already does) when no city is given.

const REQUEST_TIMEOUT_MS = 8000;

export interface WeatherDay {
  date: string;
  high: number;
  label: string;
  low: number;
  rainChance: number | null;
}

export interface WeatherReport {
  current: { label: string; temperature: number };
  days: WeatherDay[];
  place: string;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
}

async function locate(city: string, signal: AbortSignal) {
  if (city) {
    const search = await fetchJson<{ results?: Array<{ admin1?: string; country?: string; latitude: number; longitude: number; name: string }> }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`,
      signal,
    );
    const place = search.results?.[0];
    if (!place) throw new Error(`没找到地点“${city}”`);
    return { latitude: place.latitude, longitude: place.longitude, place: [place.name, place.admin1].filter(Boolean).join('，') };
  }
  const location = await fetchJson<{ city?: string; latitude?: number; longitude?: number }>('https://ipapi.co/json/', signal);
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') throw new Error('定位不到当前位置');
  return { latitude: location.latitude, longitude: location.longitude, place: location.city ?? '当前位置' };
}

export async function fetchWeatherReport(options: { city?: string; days?: number; signal?: AbortSignal | null } = {}): Promise<WeatherReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const location = await locate(options.city?.trim() ?? '', controller.signal);
    const days = Math.min(7, Math.max(1, Math.round(options.days ?? 3)));
    const forecast = await fetchJson<{
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: { precipitation_probability_max?: Array<number | null>; temperature_2m_max?: number[]; temperature_2m_min?: number[]; time?: string[]; weather_code?: number[] };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}`
        + '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
        + `&timezone=auto&forecast_days=${days}`,
      controller.signal,
    );
    const temperature = forecast.current?.temperature_2m;
    const code = forecast.current?.weather_code;
    if (typeof temperature !== 'number' || typeof code !== 'number') throw new Error('天气数据不可用');
    const daily = forecast.daily;
    return {
      current: { label: describeWeatherCode(code).label, temperature: Math.round(temperature) },
      days: (daily?.time ?? []).map((date, index) => ({
        date,
        high: Math.round(daily?.temperature_2m_max?.[index] ?? NaN),
        label: describeWeatherCode(daily?.weather_code?.[index] ?? 0).label,
        low: Math.round(daily?.temperature_2m_min?.[index] ?? NaN),
        rainChance: daily?.precipitation_probability_max?.[index] ?? null,
      })),
      place: location.place,
    };
  } finally {
    clearTimeout(timer);
  }
}
