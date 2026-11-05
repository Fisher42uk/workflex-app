import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  User,
  Play,
  Square,
  Palmtree,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Coffee,
  Edit3,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'Monday', short: 'Mon', jsDay: 1 },
  { key: 'tue', label: 'Tuesday', short: 'Tue', jsDay: 2 },
  { key: 'wed', label: 'Wednesday', short: 'Wed', jsDay: 3 },
  { key: 'thu', label: 'Thursday', short: 'Thu', jsDay: 4 },
  { key: 'fri', label: 'Friday', short: 'Fri', jsDay: 5 },
  { key: 'sat', label: 'Saturday', short: 'Sat', jsDay: 6 },
  { key: 'sun', label: 'Sunday', short: 'Sun', jsDay: 0 },
];

const DEFAULT_PROFILE = {
  name: 'Alex',
  weeklyHours: 37.5,
  useCustomDailyHours: false,
  workingDays: {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  },
  customDailyHours: {
    mon: 7.5,
    tue: 7.5,
    wed: 7.5,
    thu: 7.5,
    fri: 7.5,
    sat: 0,
    sun: 0,
  },
  defaultBreakMins: 30,
  startingBalanceHours: 0,
  trackingStartDate: '',
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getMonday = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const addDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

const formatTimeHHMM = (date) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatDurationHours = (decimalHours, showSign = false) => {
  const isNegative = decimalHours < -0.005;
  const absHours = Math.abs(decimalHours);
  const totalMins = Math.round(absHours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const sign = isNegative ? '-' : showSign && totalMins > 0 ? '+' : '';
  if
