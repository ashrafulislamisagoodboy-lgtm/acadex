import { BookOpen, CalendarDays, Home, Settings, Crown, User } from 'lucide-react';

export const sections = [
  { path: '/', label: 'Desk', icon: Home, tint: '#2b7894' },
  { path: '/leaderboard', label: 'Ranks', icon: Crown, tint: '#8266ac' },
  { path: '/quiz', label: 'Quiz', icon: BookOpen, tint: '#5849a7' },
  { path: '/social', label: 'Calendar', icon: CalendarDays, tint: '#a84c64' },
  { path: '/admin', label: 'Admin', icon: Settings, tint: '#386352' },
  { path: '/profile', label: 'Profile', icon: User, tint: '#485b93' },
] as const;
