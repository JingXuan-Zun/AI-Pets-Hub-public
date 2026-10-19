import { fetchWeatherReport, type WeatherDay } from '../services/weatherService';
import { numberArg, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability } from './platformCapabilityTypes';

// The weather the hub card shows, now readable by the character (“今天要带伞吗”“明天杭州冷不冷”).

const DAY_NAMES = ['今天', '明天', '后天'];

function dayLine(day: WeatherDay, index: number) {
  const name = DAY_NAMES[index] ?? day.date.slice(5);
  const rain = day.rainChance === null ? '' : `，降水概率 ${day.rainChance}%`;
  return `${name}：${day.label}，${day.low}–${day.high}°C${rain}`;
}

const getWeather: PlatformCapability = {
  args: [
    { description: '城市名，例如“杭州”；不写就是用户当前所在地（按网络位置估计）', key: 'city', type: 'string' },
    { description: '看几天，1-7，默认 3', key: 'days', type: 'number' },
  ],
  description: 'Current weather and the next days’ forecast (temperature, rain chance). Prefer this over web search for weather questions.',
  describe: (args) => `查看${stringArg(args, 'city') || '当地'}天气`,
  group: '天气',
  id: 'weather.get',
  risk: 'read',
  run: async (_context, args) => {
    try {
      const report = await fetchWeatherReport({ city: stringArg(args, 'city'), days: numberArg(args, 'days') ?? 3 });
      return {
        ok: true,
        text: [`${report.place}现在${report.current.label}，${report.current.temperature}°C。`, ...report.days.map(dayLine)].join('\n'),
      };
    } catch (error) {
      return { ok: false, text: `查不到天气：${error instanceof Error ? error.message : String(error)}。可以改用联网搜索。` };
    }
  },
  title: '查看天气',
};

export const WEATHER_CAPABILITIES: PlatformCapability[] = [getWeather];
