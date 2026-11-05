import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  Calendar,
  User,
  Play,
  Square,
  Coffee,
  Palmtree,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Download,
  Upload,
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

// --- HELPER FUNCTIONS ---
const formatDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatHoursAndMinutes = (decimalHours, showSign = false) => {
  const isNegative = decimalHours < 0;
  const absHours = Math.abs(decimalHours);
  let hours = Math.floor(absHours);
  let minutes = Math.round((absHours - hours) * 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  const sign = isNegative ? '-' : showSign && decimalHours > 0 ? '+' : '';
  return `${sign}${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const formatDurationClock = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const calculateShiftHours = (clockIn, clockOut, breakMinutes = 0) => {
  if (!clockIn || !clockOut) return 0;
  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  let startMins = inH * 60 + inM;
  let endMins = outH * 60 + outM;
  if (endMins < startMins) {
    endMins += 24 * 60; // Support overnight shifts
  }
  const netMins = Math.max(0, endMins - startMins - (Number(breakMinutes) || 0));
  return netMins / 60;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDERED_WEEK_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun

const DEFAULT_PROFILE = {
  name: 'My Work Profile',
  weeklyHours: 37.5,
  workDays: [1, 2, 3, 4, 5], // Mon-Fri
  useCustomDailyHours: false,
  customDailyHours: {
    1: 7.5,
    2: 7.5,
    3: 7.5,
    4: 7.5,
    5: 7.5,
    6: 0,
    0: 0
  },
  defaultBreakMinutes: 30,
  startingFlexiBalance: 0 // in decimal hours
};

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('workflex_profile_v1');
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('workflex_logs_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeShift, setActiveShift] = useState(() => {
    try {
      const saved = localStorage.getItem('workflex_active_shift_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [now, setNow] = useState(Date.now());
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getMonday(new Date()));
  const [editingDateKey, setEditingDateKey] = useState(null);
  const [editModalData, setEditModalData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // --- SAFETY LOCK STATES FOR DATA & BACKUP ---
  const [isDataSectionUnlocked, setIsDataSectionUnlocked] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [pendingImportData, setPendingImportData] = useState(null);
  const fileInputRef = useRef(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('workflex_profile_v1', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('workflex_logs_v1', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    if (activeShift) {
      localStorage.setItem('workflex_active_shift_v1', JSON.stringify(activeShift));
    } else {
      localStorage.removeItem('workflex_active_shift_v1');
    }
  }, [activeShift]);

  // Live timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-lock data controls whenever user leaves the Profile tab
  useEffect(() => {
    if (activeTab !== 'profile') {
      setIsDataSectionUnlocked(false);
      setShowResetConfirm(false);
      setResetConfirmText('');
      setPendingImportData(null);
    }
  }, [activeTab]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- CONTRACTED HOURS HELPERS ---
  const getTargetHoursForDayIndex = (dayIndex) => {
    if (profile.useCustomDailyHours) {
      return Number(profile.customDailyHours?.[dayIndex]) || 0;
    }
    if (profile.workDays.includes(dayIndex)) {
      const count = profile.workDays.length || 1;
      return Number(profile.weeklyHours) / count;
    }
    return 0;
  };

  const getTargetHoursForDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return getTargetHoursForDayIndex(dateObj.getDay());
  };

  const getWorkedHoursForDayLog = (dateStr, dayLog) => {
    if (!dayLog) return 0;
    if (dayLog.isAnnualLeave) {
      return dayLog.leaveHours !== undefined
