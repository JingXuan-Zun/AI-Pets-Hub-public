import { useEffect, useState } from 'react';

/**
 * 聊天 Hub 右上角的天气。
 * 先用 IP 粗略定位（ipapi.co，会发送本机公网 IP），再向 Open-Meteo 取当前天气；
 * 两个接口都免费、不需要 key。结果缓存 30 分钟，失败时不显示天气。
 */
export type HubWeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface HubWeather {
  city: string;
  kind: HubWeatherKind;
  label: string;
  temperature: number;
}

const WEATHER_CACHE_KEY = 'desktop-pet.hub-weather.v1';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

/** WMO 天气代码 → 图标类别与中文描述。 */
export function describeWeatherCode(code: number): { kind: HubWeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: '晴' };
  if (code <= 2) return { kind: 'cloudy', label: '多云' };
  if (code === 3) return { kind: 'cloudy', label: '阴' };
  if (code === 45 || code === 48) return { kind: 'fog', label: '雾' };
  if (code >= 51 && code <= 67) return { kind: 'rain', label: code >= 61 ? '雨' : '小雨' };
  if (code >= 71 && code <= 77) return { kind: 'snow', label: '雪' };
  if (code >= 80 && code <= 82) return { kind: 'rain', label: '阵雨' };
  if (code >= 85 && code <= 86) return { kind: 'snow', label: '阵雪' };
  if (code >= 95) return { kind: 'storm', label: '雷雨' };
  return { kind: 'cloudy', label: '多云' };
}

function readCache(): HubWeather | null {
  try {
    const cached = JSON.parse(window.localStorage.getItem(WEATHER_CACHE_KEY) ?? 'null') as { at: number; weather: HubWeather } | null;
    return cached && Date.now() - cached.at < WEATHER_CACHE_TTL_MS ? cached.weather : null;
  } catch {
    return null;
  }
}

function writeCache(weather: HubWeather) {
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ at: Date.now(), weather }));
  } catch {
    // 缓存失败只是下次多请求一次。
  }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
}

async function fetchHubWeather(signal: AbortSignal): Promise<HubWeather> {
  const location = await fetchJson<{ city?: string; latitude?: number; longitude?: number }>('https://ipapi.co/json/', signal);
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    throw new Error('location unavailable');
  }
  const forecast = await fetchJson<{ current?: { temperature_2m?: number; weather_code?: number } }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code`,
    signal,
  );
  const temperature = forecast.current?.temperature_2m;
  const code = forecast.current?.weather_code;
  if (typeof temperature !== 'number' || typeof code !== 'number') throw new Error('weather unavailable');
  return { city: location.city ?? '', temperature: Math.round(temperature), ...describeWeatherCode(code) };
}

export function useHubWeather() {
  const [weather, setWeather] = useState<HubWeather | null>(readCache);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    const refresh = () => {
      if (readCache()) return;
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      fetchHubWeather(controller.signal)
        .then((next) => {
          writeCache(next);
          if (!cancelled) setWeather(next);
        })
        .catch(() => {
          // 离线或接口不可用：保持上一次的结果（或不显示）。
        })
        .finally(() => window.clearTimeout(timeout));
    };
    refresh();
    const interval = window.setInterval(refresh, WEATHER_CACHE_TTL_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  return weather;
}
