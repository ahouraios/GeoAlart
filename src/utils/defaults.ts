import { Destination } from '../types';

export const DEFAULT_DESTINATIONS: Destination[] = [
  {
    id: 'dest-1',
    name: 'میدان آزادی',
    description: 'محدوده برج و میدان آزادی تهران',
    latitude: 35.6997,
    longitude: 51.3380,
    radiusMeters: 400,
    arrivalRadiusMeters: 50,
    color: '#06b6d4', // Cyan
    category: 'travel',
    enabled: true,
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'dest-2',
    name: 'برج میلاد',
    description: 'مرکز همایش‌ها و برج میلاد',
    latitude: 35.7448,
    longitude: 51.3753,
    radiusMeters: 500,
    arrivalRadiusMeters: 50,
    color: '#8b5cf6', // Purple
    category: 'work',
    enabled: true,
    createdAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'dest-3',
    name: 'پارک لاله',
    description: 'ورودی بلوار کشاورز',
    latitude: 35.7118,
    longitude: 51.3892,
    radiusMeters: 300,
    arrivalRadiusMeters: 50,
    color: '#10b981', // Emerald
    category: 'personal',
    enabled: true,
    createdAt: Date.now() - 3600000 * 6,
  },
];
