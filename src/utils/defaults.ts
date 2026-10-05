import { Destination } from '../types';

export interface CityPreset {
  name: string;
  lat: number;
  lon: number;
}

export const IRAN_CITIES: CityPreset[] = [
  { name: '📍 مشهد (بلوار شاهنامه - محل تصویر شما)', lat: 36.4678, lon: 59.5020 },
  { name: 'مشهد (مرکز شهر)', lat: 36.2972, lon: 59.6067 },
  { name: 'تهران', lat: 35.6997, lon: 51.3380 },
  { name: 'اصفهان', lat: 32.6546, lon: 51.6680 },
  { name: 'شیراز', lat: 29.5918, lon: 52.5837 },
  { name: 'تبریز', lat: 38.0800, lon: 46.2919 },
  { name: 'کرج', lat: 35.8400, lon: 50.9391 },
  { name: 'اهواز', lat: 31.3183, lon: 48.6706 },
  { name: 'قم', lat: 34.6401, lon: 50.8764 },
  { name: 'رشت', lat: 37.2809, lon: 49.5924 },
  { name: 'ارومیه', lat: 37.5527, lon: 45.0761 },
  { name: 'یزد', lat: 31.8974, lon: 54.3569 },
  { name: 'کرمان', lat: 30.2839, lon: 57.0788 },
  { name: 'کرمانشاه', lat: 34.3142, lon: 47.0650 },
  { name: 'همدان', lat: 34.7982, lon: 48.5146 },
  { name: 'قزوین', lat: 36.2688, lon: 50.0041 },
];

export const DEFAULT_DESTINATIONS: Destination[] = [
  {
    id: 'dest-boxing',
    name: 'باشگاه بوکس شاهنامه 🥊',
    description: 'بلوار شاهنامه - روبروی شاهنامه ۱۷',
    latitude: 36.4695,
    longitude: 59.5038,
    radiusMeters: 150,
    arrivalRadiusMeters: 20,
    color: '#0284c7', // Sky Blue
    category: 'personal',
    enabled: true,
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'dest-coffee',
    name: 'قهوه شاهنامه ☕',
    description: 'بلوار شاهنامه ۱۴',
    latitude: 36.4662,
    longitude: 59.5002,
    radiusMeters: 150,
    arrivalRadiusMeters: 20,
    color: '#d97706', // Amber
    category: 'shopping',
    enabled: true,
    createdAt: Date.now() - 3600000 * 18,
  },
  {
    id: 'dest-work',
    name: 'محل کار 🏢',
    description: 'محل کار و شرکت',
    latitude: 36.4635,
    longitude: 59.4975,
    radiusMeters: 200,
    arrivalRadiusMeters: 20,
    color: '#2563eb', // Royal Blue
    category: 'work',
    enabled: true,
    createdAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'dest-mom',
    name: 'خانه مامان 🏡❤️',
    description: 'منزل مادری و خانوادگی',
    latitude: 36.4718,
    longitude: 59.5065,
    radiusMeters: 200,
    arrivalRadiusMeters: 20,
    color: '#ec4899', // Pink / Rose
    category: 'personal',
    enabled: true,
    createdAt: Date.now() - 3600000 * 6,
  },
];
