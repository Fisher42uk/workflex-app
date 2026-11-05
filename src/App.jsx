import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Calendar, 
  User, 
  Play, 
  Square, 
  Coffee, 
  Palmtree, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  Download, 
  Upload, 
  RotateCcw, 
  Sparkles,
  Plus,
  Info,
  Save,
  X,
  Briefcase,
  Award
} from 'lucide-react';

// --- HELPER FUNCTIONS ---

// Format date as YYYY-MM-DD in local time
const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Parse YYYY-MM-DD to local Date object at midnight
const parseDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Get Monday of the week for a given Date
const getMonday = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

// Add days to a Date
const addDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

// Get array of 7 Date objects (Mon-Sun) starting from mondayDate
const getWeekDays = (mondayDate) => {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayDate, i));
};

// Map JS getDay() (0=Sun..6=Sat) to our Mon=0..Sun=6 index
const getDayIndex = (date) => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

// Format decimal hours into clean readable string (e.g., 7h 30m or +1h 15m)
const formatHours = (decimalHours, showSign = false) => {
  if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours)) return '0h 00m';
  const isNegative = decimalHours < -0.001;
  const isPositive = decimalHours > 0.001;
  const absVal = Math.abs(decimalHours);
  let totalMinutes = Math.round(absVal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  let sign = '';
  if (showSign) {
    if (isNegative) sign = '-';
    else if (isPositive) sign = '+';
  } else if (isNegative) {
    sign = '-';
  }

  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
};

// Format decimal hours as clean decimal (e.g., 37.5h)
const formatDecimal = (val, showSign = false) => {
  const num = Number(val) || 0;
  const sign = showSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}h`;
};

// Calculate hours from HH:MM start, HH:MM end, and break minutes
const calcShiftHours = (startTime, endTime, breakMinutes = 0) => {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) {
    // Handle overnight shift
    endMins += 24 * 60;
  }
  const netMins = Math.max(0, endMins - startMins - (Number(breakMinutes) || 0));
  return netMins / 60;
};

// Format live timer seconds to HH:MM:SS
const formatTimer = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Format timestamp to HH:MM
const timestampToHHMM = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_PROFILE = {
  name: 'Alex Morgan',
  role: 'Product Specialist',
  scheduleMode: 'standard', // 'standard' | 'custom'
  weeklyHours: 37.5,
  workingDaysCount: 5,
  activeDays: [true, true, true, true, true, false, false], // Mon-Fri
  customDailyHours: [7.5, 7.5, 7.5, 7.5, 7.5, 0, 0],
  initialBalanceOffset: 0, // Starting flexi balance in hours
  defaultBreakMinutes: 30,
};

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'timesheet' | 'profile'
  
  // User Profile State
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('wf_profile_v1');
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  // Logs State: keyed by YYYY-MM-DD
  // { [dateStr]: { dateStr, type: 'work'|'leave', startTime: '09:00', endTime: '17:00', breakMinutes: 30, hoursWorked: 7.5, note: '' } }
  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('wf_logs_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Active Clock-in Session State
  const [activeSession, setActiveSession] = useState(() => {
    try {
      const saved = localStorage.getItem('wf_session_v1');
      return saved ? JSON.parse(saved) : {
        isClockedIn: false,
        clockInTime: null, // timestamp
        isOnBreak: false,
        breakStartTime: null, // timestamp
        accumulatedBreakMs: 0,
        manualBreakMinutes: 0,
        note: ''
      };
    } catch {
      return {
        isClockedIn: false,
        clockInTime: null,
        isOnBreak: false,
        breakStartTime: null,
        accumulatedBreakMs: 0,
        manualBreakMinutes: 0,
        note: ''
      };
    }
  });

  // Live current time ticker
  const [now, setNow] = useState(Date.now());

  // Timesheet Week Navigator state (Monday of selected week)
  const [selectedWeekMonday, setSelectedWeekMonday] = useState(() => getMonday(new Date()));

  // Modal State for Editing a Day in Timesheet / Dashboard
  const [editingDateStr, setEditingDateStr] = useState(null);
  const [modalForm, setModalForm] = useState({
    type: 'work', // 'work' | 'leave'
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    manualHours: '',
    useManualHours: false,
    note: ''
  });

  // Toast Notification State
  const [toast, setToast] = useState(null);

  // Confirm Dialog State (Avoiding window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null);

  // --- EFFECTS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('wf_profile_v1', JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem('wf_logs_v1', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save logs', e);
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem('wf_session_v1', JSON.stringify(activeSession));
    } catch (e) {
      console.error('Failed to save session', e);
    }
  }, [activeSession]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // --- SCHEDULE & TARGET CALCULATIONS ---

  // Get expected target hours for a specific day index (0=Mon .. 6=Sun)
  const getExpectedDailyHours = (dayIdx, prof = profile) => {
    if (prof.scheduleMode === 'custom') {
      return Number(prof.customDailyHours[dayIdx]) || 0;
    }
    const activeCount = prof.activeDays.filter(Boolean).length || 1;
    if (!prof.activeDays[dayIdx]) return 0;
    return (Number(prof.weeklyHours) || 0) / activeCount;
  };

  // Get expected target hours for a specific YYYY-MM-DD date string
  const getTargetForDateStr = (dateStr) => {
    const date = parseDateStr(dateStr);
    const dayIdx = getDayIndex(date);
    return getExpectedDailyHours(dayIdx);
  };

  // Total weekly contracted hours
  const weeklyTargetHours = useMemo(() => {
    if (profile.scheduleMode === 'custom') {
      return profile.customDailyHours.reduce((acc, h) => acc + (Number(h) || 0), 0);
    }
    return Number(profile.weeklyHours) || 0;
  }, [profile]);

  // Standard single day hours for display on Profile / Quick Leave button
  const standardDailyHours = useMemo(() => {
    if (profile.scheduleMode === 'custom') {
      const working = profile.customDailyHours.filter((h) => h > 0);
      if (working.length === 0) return 0;
      return working.reduce((a, b) => a + b, 0) / working.length;
    }
    const activeCount = profile.activeDays.filter(Boolean).length || 1;
    return (Number(profile.weeklyHours) || 0) / activeCount;
  }, [profile]);

  // Get effective credited hours for a logged entry
  const getCreditedHoursForLog = (dateStr, logEntry) => {
    if (!logEntry) return 0;
    if (logEntry.type === 'leave') {
      // If annual leave, automatically credit the full daily hours due for that day
      // (If it's a weekend/0-target day, fallback to standardDailyHours so marking leave still credits a full day if requested, or use target if > 0)
      const dayTarget = getTargetForDateStr(dateStr);
      return dayTarget > 0 ? dayTarget : standardDailyHours;
    }
    return Number(logEntry.hoursWorked) || 0;
  };

  // Live session elapsed calculation
  const liveSessionStats = useMemo(() => {
    if (!activeSession.isClockedIn || !activeSession.clockInTime) {
      return { workMs: 0, breakMs: 0, netWorkHours: 0, breakMinutesTotal: 0 };
    }
    const totalElapsedMs = Math.max(0, now - activeSession.clockInTime);
    const currentBreakSegmentMs = activeSession.isOnBreak && activeSession.breakStartTime
      ? Math.max(0, now - activeSession.breakStartTime)
      : 0;
    const totalTrackedBreakMs = (activeSession.accumulatedBreakMs || 0) + currentBreakSegmentMs;
    const additionalManualBreakMs = (Number(activeSession.manualBreakMinutes) || 0) * 60 * 1000;
    const totalBreakMs = totalTrackedBreakMs + additionalManualBreakMs;
    const netWorkMs = Math.max(0, totalElapsedMs - totalBreakMs);

    return {
      workMs: netWorkMs,
      breakMs: totalBreakMs,
      netWorkHours: netWorkMs / (1000 * 60 * 60),
      breakMinutesTotal: Math.round(totalBreakMs / (1000 * 60))
    };
  }, [activeSession, now]);

  const todayStr = useMemo(() => toDateStr(new Date(now)), [now]);
  const currentWeekMonday = useMemo(() => getMonday(new Date(now)), [now]);

  // Calculate stats for any given week (given its Monday Date)
  const calculateWeekSummary = (mondayDate, includeLiveToday = true) => {
    const days = getWeekDays(mondayDate);
    let totalCredited = 0;
    let workedHours = 0;
    let leaveHours = 0;
    let leaveDaysCount = 0;
    let targetSoFar = 0;

    const dayDetails = days.map((d, idx) => {
      const dStr = toDateStr(d);
      const log = logs[dStr];
      const dayTarget = getExpectedDailyHours(idx);
      
      let credited = getCreditedHoursForLog(dStr, log);
      let isLiveToday = false;

      // Add live clocked-in hours if looking at today
      if (includeLiveToday && dStr === todayStr && activeSession.isClockedIn) {
        isLiveToday = true;
        if (!log || log.type !== 'leave') {
          credited += liveSessionStats.netWorkHours;
        }
      }

      totalCredited += credited;
      if (log?.type === 'leave') {
        leaveHours += credited;
        leaveDaysCount += 1;
      } else {
        workedHours += credited;
      }

      if (dStr <= todayStr) {
        targetSoFar += dayTarget;
      }

      return {
        date: d,
        dateStr: dStr,
        dayNameShort: DAY_NAMES_SHORT[idx],
        dayNameFull: DAY_NAMES_FULL[idx],
        log,
        dayTarget,
        credited,
        isLiveToday,
        variance: credited - dayTarget
      };
    });

    const weeklyVariance = totalCredited - weeklyTargetHours;

    return {
      mondayStr: toDateStr(mondayDate),
      days: dayDetails,
      totalCredited,
      workedHours,
      leaveHours,
      leaveDaysCount,
      weeklyTarget: weeklyTargetHours,
      weeklyVariance,
      remainingToTarget: Math.max(0, weeklyTargetHours - totalCredited)
    };
  };

  // Current Week Summary
  const currentWeekSummary = useMemo(
    () => calculateWeekSummary(currentWeekMonday, true),
    [currentWeekMonday, logs, profile, activeSession, liveSessionStats, todayStr]
  );

  // Selected Timesheet Week Summary
  const selectedWeekSummary = useMemo(
    () => calculateWeekSummary(selectedWeekMonday, true),
    [selectedWeekMonday, logs, profile, activeSession, liveSessionStats, todayStr]
  );

  // --- CUMULATIVE RUNNING BALANCE CALCULATION ---
  // Calculates running over/under balance across all recorded history up to today
  const runningBalanceData = useMemo(() => {
    const allLoggedDates = Object.keys(logs).sort();
    
    // If no logs exist yet and not clocked in, running balance is simply the initial offset
    if (allLoggedDates.length === 0 && !activeSession.isClockedIn) {
      return {
        totalNetBalance: Number(profile.initialBalanceOffset) || 0,
        completedDaysBalance: Number(profile.initialBalanceOffset) || 0,
        fullWeekProjectionBalance: Number(profile.initialBalanceOffset) || 0,
        totalLoggedHours: 0,
        totalTargetHours: 0,
        weeksTracked: 0
      };
    }

    // Find earliest Monday from logs (or current week Monday)
    const earliestDateStr = allLoggedDates.length > 0 && allLoggedDates[0] < todayStr
      ? allLoggedDates[0]
      : todayStr;
    const firstMonday = getMonday(parseDateStr(earliestDateStr));

    // Find latest date to evaluate (at least through end of current week or latest logged week)
    const latestDateStr = allLoggedDates.length > 0 && allLoggedDates[allLoggedDates.length - 1] > todayStr
      ? allLoggedDates[allLoggedDates.length - 1]
      : todayStr;
    const lastMonday = getMonday(parseDateStr(latestDateStr));

    // We evaluate day by day from firstMonday up to today (plus any future Annual Leave or logged days)
    // Wait: how do users think about running balance?
    // 1) "Up to Today (Daily Running Total)": compares hours worked/leave against daily targets for all past weeks + days elapsed so far this week (only counting today's target once today has a log or at end of day, or pro-rata).
    // Even clearer: For every PAST week (before currentWeekMonday) that has at least one log (or lies between first logged week and now), variance = Week Credited - Weekly Target.
    // For the CURRENT week, we show both:
    // - Running balance including days completed/logged so far vs their daily targets
    // - End-of-week balance if current week finishes as-is.
    
    let cumulativeCredited = 0;
    let cumulativeTargetUpToToday = 0;
    let weeksCount = 0;

    let cursorMonday = new Date(firstMonday);
    while (cursorMonday <= lastMonday) {
      const weekDays = getWeekDays(cursorMonday);
      const isPastWeek = toDateStr(addDays(cursorMonday, 6)) < todayStr;
      const isCurrentWeek = toDateStr(cursorMonday) === toDateStr(currentWeekMonday);
      
      // Check if this week has any activity or is between first log and current week
      const hasLogsInWeek = weekDays.some(d => Boolean(logs[toDateStr(d)]));

      if (isPastWeek || isCurrentWeek || hasLogsInWeek) {
        weeksCount++;
        weekDays.forEach((d, idx) => {
          const dStr = toDateStr(d);
          const log = logs[dStr];
          const dayTarget = getExpectedDailyHours(idx);
          let credited = getCreditedHoursForLog(dStr, log);

          if (dStr === todayStr && activeSession.isClockedIn && (!log || log.type !== 'leave')) {
            credited += liveSessionStats.netWorkHours;
          }

          cumulativeCredited += credited;

          // When do we count the daily target against the running balance?
          // - Any past day (dStr < todayStr)
          // - Today (dStr === todayStr) IF the user has logged hours, marked annual leave, or clocked in today
          // - Any future day ONLY IF the user has already logged a shift or annual leave on that future day
          if (dStr < todayStr || (dStr === todayStr && (log || activeSession.isClockedIn)) || (dStr > todayStr && log)) {
            cumulativeTargetUpToToday += dayTarget;
          }
        });
      }

      cursorMonday = addDays(cursorMonday, 7);
    }

    const initialOffset = Number(profile.initialBalanceOffset) || 0;
    const netBalance = initialOffset + (cumulativeCredited - cumulativeTargetUpToToday);

    return {
      totalNetBalance: netBalance,
      totalLoggedHours: cumulativeCredited,
      totalTargetHours: cumulativeTargetUpToToday,
      initialOffset,
      weeksTracked: weeksCount
    };
  }, [logs, profile, todayStr, currentWeekMonday, activeSession, liveSessionStats]);

  // Also calculate the running balance up to the end of the selected week in Timesheet
  const selectedWeekRunningTotal = useMemo(() => {
    const selectedSundayStr = toDateStr(addDays(selectedWeekMonday, 6));
    const allLoggedDates = Object.keys(logs).sort();
    const earliestDateStr = allLoggedDates.length > 0 && allLoggedDates[0] < toDateStr(selectedWeekMonday)
      ? allLoggedDates[0]
      : toDateStr(selectedWeekMonday);
    
    const firstMonday = getMonday(parseDateStr(earliestDateStr));
    let cursor = new Date(firstMonday);
    let totalCred = 0;
    let totalTarg = 0;

    while (cursor <= selectedWeekMonday) {
      const wDays = getWeekDays(cursor);
      wDays.forEach((d, idx) => {
        const dStr = toDateStr(d);
        const log = logs[dStr];
        const dayTarget = getExpectedDailyHours(idx);
        let cred = getCreditedHoursForLog(dStr, log);
        if (dStr === todayStr && activeSession.isClockedIn && (!log || log.type !== 'leave')) {
          cred += liveSessionStats.netWorkHours;
        }
        totalCred += cred;
        if (dStr <= todayStr || log) {
          totalTarg += dayTarget;
        }
      });
      cursor = addDays(cursor, 7);
    }

    return (Number(profile.initialBalanceOffset) || 0) + (totalCred - totalTarg);
  }, [selectedWeekMonday, logs, profile, todayStr, activeSession, liveSessionStats]);

  // --- ACTIONS: LIVE CLOCK IN / OUT ---

  const handleClockIn = () => {
    const nowTs = Date.now();
    setActiveSession({
      isClockedIn: true,
      clockInTime: nowTs,
      isOnBreak: false,
      breakStartTime: null,
      accumulatedBreakMs: 0,
      manualBreakMinutes: 0,
      note: ''
    });
    showToast('Clocked in! Have a great shift.');
  };

  const handleToggleBreak = () => {
    if (!activeSession.isClockedIn) return;
    const nowTs = Date.now();
    if (!activeSession.isOnBreak) {
      setActiveSession(prev => ({
        ...prev,
        isOnBreak: true,
        breakStartTime: nowTs
      }));
      showToast('Break started — timer paused.', 'info');
    } else {
      const breakElapsed = Math.max(0, nowTs - (activeSession.breakStartTime || nowTs));
      setActiveSession(prev => ({
        ...prev,
        isOnBreak: false,
        breakStartTime: null,
        accumulatedBreakMs: (prev.accumulatedBreakMs || 0) + breakElapsed
      }));
      showToast('Welcome back from break!');
    }
  };

  const handleClockOut = () => {
    if (!activeSession.isClockedIn) return;
    const nowTs = Date.now();
    const startStr = timestampToHHMM(activeSession.clockInTime);
    const endStr = timestampToHHMM(nowTs);
    const breakMins = liveSessionStats.breakMinutesTotal;
    const netHours = Math.max(0.01, Number(liveSessionStats.netWorkHours.toFixed(2)));

    const existingTodayLog = logs[todayStr];
    const combinedHours = existingTodayLog && existingTodayLog.type === 'work'
      ? Number((existingTodayLog.hoursWorked + netHours).toFixed(2))
      : netHours;

    const newEntry = {
      dateStr: todayStr,
      type: 'work',
      startTime: existingTodayLog?.type === 'work' ? existingTodayLog.startTime : startStr,
      endTime: endStr,
      breakMinutes: (existingTodayLog?.type === 'work' ? (existingTodayLog.breakMinutes || 0) : 0) + breakMins,
      hoursWorked: combinedHours,
      note: activeSession.note || existingTodayLog?.note || 'Clocked shift'
    };

    setLogs(prev => ({
      ...prev,
      [todayStr]: newEntry
    }));

    setActiveSession({
      isClockedIn: false,
      clockInTime: null,
      isOnBreak: false,
      breakStartTime: null,
      accumulatedBreakMs: 0,
      manualBreakMinutes: 0,
      note: ''
    });

    showToast(`Clocked out! Logged ${formatHours(netHours)} for today.`);
  };

  // Quick toggle today (or any date) as Annual Leave
  const handleMarkAnnualLeave = (dateStr = todayStr) => {
    const existing = logs[dateStr];
    if (existing && existing.type === 'leave') {
      // Unmark leave if already on leave
      setLogs(prev => {
        const updated = { ...prev };
        delete updated[dateStr];
        return updated;
      });
      showToast(`Removed Annual Leave for ${dateStr === todayStr ? 'today' : dateStr}.`, 'info');
      return;
    }

    const targetHours = getTargetForDateStr(dateStr);
    const creditHours = targetHours > 0 ? targetHours : standardDailyHours;

    setLogs(prev => ({
      ...prev,
      [dateStr]: {
        dateStr,
        type: 'leave',
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 0,
        hoursWorked: creditHours,
        note: 'Annual Leave'
      }
    }));

    showToast(`Marked as Annual Leave (+${formatHours(creditHours)} credited)`);
  };

  // --- ACTIONS: DAY EDIT MODAL ---
  const openEditModal = (dateStr) => {
    const existing = logs[dateStr];
    const defaultTarget = getTargetForDateStr(dateStr) || standardDailyHours;

    if (existing) {
      setModalForm({
        type: existing.type || 'work',
        startTime: existing.startTime || '09:00',
        endTime: existing.endTime || '17:00',
        breakMinutes: existing.breakMinutes ?? profile.defaultBreakMinutes ?? 30,
        manualHours: String(existing.hoursWorked ?? defaultTarget),
        useManualHours: existing.useManualHours || false,
        note: existing.note || ''
      });
    } else {
      // Calculate a sensible end time based on 09:00 + target hours + default break
      const breakMins = Number(profile.defaultBreakMinutes) || 30;
      const totalMins = Math.round(defaultTarget * 60) + breakMins;
      const endH = Math.min(23, 9 + Math.floor(totalMins / 60));
      const endM = totalMins % 60;
      const defaultEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      setModalForm({
        type: 'work',
        startTime: '09:00',
        endTime: defaultEnd,
        breakMinutes: breakMins,
        manualHours: String(Number(defaultTarget.toFixed(2))),
        useManualHours: false,
        note: ''
      });
    }
    setEditingDateStr(dateStr);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!editingDateStr) return;

    if (modalForm.type === 'leave') {
      const targetH = getTargetForDateStr(editingDateStr);
      const credited = targetH > 0 ? targetH : standardDailyHours;
      setLogs(prev => ({
        ...prev,
        [editingDateStr]: {
          dateStr: editingDateStr,
          type: 'leave',
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 0,
          hoursWorked: credited,
          note: modalForm.note || 'Annual Leave'
        }
      }));
      showToast(`Saved Annual Leave (${formatHours(credited)})`);
    } else {
      const calculatedH = modalForm.useManualHours
        ? Math.max(0, Number(modalForm.manualHours) || 0)
        : calcShiftHours(modalForm.startTime, modalForm.endTime, modalForm.breakMinutes);

      setLogs(prev => ({
        ...prev,
        [editingDateStr]: {
          dateStr: editingDateStr,
          type: 'work',
          startTime: modalForm.startTime,
          endTime: modalForm.endTime,
          breakMinutes: Number(modalForm.breakMinutes) || 0,
          hoursWorked: Number(calculatedH.toFixed(4)),
          useManualHours: modalForm.useManualHours,
          note: modalForm.note
        }
      }));
      showToast(`Saved ${formatHours(calculatedH)} for ${editingDateStr}`);
    }

    setEditingDateStr(null);
  };

  const handleDeleteLog = (dateStr) => {
    setLogs(prev => {
      const next = { ...prev };
      delete next[dateStr];
      return next;
    });
    setEditingDateStr(null);
    showToast('Entry cleared for that day.', 'info');
  };

  // --- DEMO DATA & EXPORT ---
  const handleLoadSampleData = () => {
    const lastWeekMon = addDays(currentWeekMonday, -7);
    const sampleLogs = { ...logs };

    // Populate last week: 4 work days (slightly over/under) + 1 Annual Leave day on Friday
    const lastWeekDays = getWeekDays(lastWeekMon);
    const sampleLastWeek = [
      { start: '08:45', end: '17:00', breakMins: 30, type: 'work', note: 'Morning project kickoff' }, // 7.75h
      { start: '09:00', end: '17:30', breakMins: 30, type: 'work', note: 'Client sprint review' },    // 8.0h
      { start: '09:00', end: '17:00', breakMins: 30, type: 'work', note: 'Regular shift' },           // 7.5h
      { start: '08:30', end: '17:15', breakMins: 30, type: 'work', note: 'Late deployment' },         // 8.25h
      { start: '09:00', end: '17:00', breakMins: 0,  type: 'leave', note: 'Annual Leave - Long Weekend' } // 7.5h
    ];

    sampleLastWeek.forEach((item, idx) => {
      const dStr = toDateStr(lastWeekDays[idx]);
      const hrs = item.type === 'leave'
        ? (getTargetForDateStr(dStr) || standardDailyHours)
        : calcShiftHours(item.start, item.end, item.breakMins);
      sampleLogs[dStr] = {
        dateStr: dStr,
        type: item.type,
        startTime: item.start,
        endTime: item.end,
        breakMinutes: item.breakMins,
        hoursWorked: hrs,
        note: item.note
      };
    });

    // Populate current week days prior to today
    const thisWeekDays = getWeekDays(currentWeekMonday);
    thisWeekDays.forEach((d, idx) => {
      const dStr = toDateStr(d);
      if (dStr < todayStr && idx < 5) {
        const isLeave = idx === 2; // Wednesday leave example if passed
        const start = idx % 2 === 0 ? '08:50' : '09:00';
        const end = idx % 2 === 0 ? '17:10' : '17:00';
        const hrs = isLeave
          ? (getTargetForDateStr(dStr) || standardDailyHours)
          : calcShiftHours(start, end, 30);
        sampleLogs[dStr] = {
          dateStr: dStr,
          type: isLeave ? 'leave' : 'work',
          startTime: start,
          endTime: end,
          breakMinutes: isLeave ? 0 : 30,
          hoursWorked: hrs,
          note: isLeave ? 'Annual Leave' : 'Logged shift'
        };
      }
    });

    setLogs(sampleLogs);
    showToast('Loaded sample shifts & annual leave!');
  };

  const handleExportCSV = () => {
    const sortedDates = Object.keys(logs).sort();
    if (sortedDates.length === 0) {
      showToast('No timesheet entries to export yet.', 'info');
      return;
    }

    const headers = ['Date', 'Day', 'Type', 'Start Time', 'End Time', 'Break (Mins)', 'Credited Hours', 'Daily Target', 'Variance', 'Notes'];
    const rows = sortedDates.map(dStr => {
      const entry = logs[dStr];
      const dateObj = parseDateStr(dStr);
      const dayName = DAY_NAMES_SHORT[getDayIndex(dateObj)];
      const credited = getCreditedHoursForLog(dStr, entry);
      const target = getTargetForDateStr(dStr);
      const variance = credited - target;
      return [
        dStr,
        dayName,
        entry.type === 'leave' ? 'Annual Leave' : 'Work Shift',
        entry.type === 'leave' ? '-' : entry.startTime,
        entry.type === 'leave' ? '-' : entry.endTime,
        entry.type === 'leave' ? 0 : entry.breakMinutes,
        credited.toFixed(2),
        target.toFixed(2),
        variance.toFixed(2),
        `"${(entry.note || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workflex_timesheet_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported timesheet CSV!');
  };

  const handleResetAll = () => {
    setConfirmDialog({
      title: 'Reset All Timesheet Logs?',
      message: 'This will permanently delete all recorded shifts and annual leave logs from this device. Your profile settings will be kept.',
      confirmText: 'Clear Logs',
      onConfirm: () => {
        setLogs({});
        setActiveSession({
          isClockedIn: false,
          clockInTime: null,
          isOnBreak: false,
          breakStartTime: null,
          accumulatedBreakMs: 0,
          manualBreakMinutes: 0,
          note: ''
        });
        setConfirmDialog(null);
        showToast('All logs cleared.', 'info');
      }
    });
  };

  // Today's specific log and target
  const todayLog = logs[todayStr];
  const todayTarget = getTargetForDateStr(todayStr);
  const todayCredited = getCreditedHoursForLog(todayStr, todayLog) + (
    activeSession.isClockedIn && (!todayLog || todayLog.type !== 'leave')
      ? liveSessionStats.netWorkHours
      : 0
  );

  // Progress bar percentage for current week
  const weekProgressPct = weeklyTargetHours > 0
    ? Math.min(100, Math.round((currentWeekSummary.totalCredited / weeklyTargetHours) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start font-sans selection:bg-indigo-500 selection:text-white">
      {/* Mobile Shell Container */}
      <div className="w-full max-w-md min-h-screen bg-slate-900 flex flex-col justify-between relative shadow-2xl border-x border-slate-800/80 pb-24">
        
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">WorkFlex</h1>
                {activeSession.isClockedIn && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[160px]">
                {profile.name} • {formatDecimal(weeklyTargetHours)}/wk
              </p>
            </div>
          </div>

          {/* Quick Running Balance Pill in Header */}
          <button
            onClick={() => setActiveTab('timesheet')}
            className={`px-3 py-1.5 rounded-xl border text-right transition-all active:scale-95 ${
              runningBalanceData.totalNetBalance >= -0.01
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
              Flexi Balance
            </div>
            <div className="text-sm font-bold flex items-center justify-end gap-1">
              {runningBalanceData.totalNetBalance >= -0.01 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              )}
              {formatHours(runningBalanceData.totalNetBalance, true)}
            </div>
          </button>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm pointer-events-none transition-all duration-300">
            <div className={`px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-2.5 text-sm font-medium ${
              toast.type === 'info'
                ? 'bg-slate-800/95 border-slate-700 text-slate-200'
                : 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 px-4 pt-4 space-y-5 overflow-y-auto">
          
          {/* ==========================================
              TAB 1: DASHBOARD / LIVE CLOCK
             ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              
              {/* Today Date & Status Banner */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    {new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  <h2 className="text-lg font-bold text-white">Today's Shift Status</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Daily Target</span>
                  <span className="text-sm font-semibold text-slate-200">{formatHours(todayTarget)}</span>
                </div>
              </div>

              {/* HERO CLOCK-IN / CLOCK-OUT CARD */}
              <div className={`rounded-3xl p-5 border transition-all shadow-xl relative overflow-hidden ${
                activeSession.isClockedIn
                  ? activeSession.isOnBreak
                    ? 'bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-900 border-amber-500/40'
                    : 'bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-emerald-500/40'
                  : todayLog?.type === 'leave'
                  ? 'bg-gradient-to-br from-teal-950/70 via-slate-900 to-slate-900 border-teal-500/40'
                  : 'bg-gradient-to-br from-slate-800/90 via-slate-900 to-slate-900 border-slate-700/70'
              }`}>
                
                {/* Status Badge Row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {activeSession.isClockedIn ? (
                      activeSession.isOnBreak ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Coffee className="w-3.5 h-3.5" /> On Break
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Clocked In
                        </span>
                      )
                    ) : todayLog?.type === 'leave' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        <Palmtree className="w-3.5 h-3.5" /> On Annual Leave
                      </span>
                    ) : todayLog ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Shift Logged Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Ready to Start
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openEditModal(todayStr)}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Today
                  </button>
                </div>

                {/* Live Timer or Credited Today Display */}
                <div className="text-center my-4">
                  {activeSession.isClockedIn ? (
                    <>
                      <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
                        Live Net Worked Time
                      </div>
                      <div className="text-5xl font-extrabold tracking-tight font-mono text-white">
                        {formatTimer(liveSessionStats.workMs / 1000)}
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
                        <span>Started: <strong className="text-slate-200">{timestampToHHMM(activeSession.clockInTime)}</strong></span>
                        <span>•</span>
                        <span>Break: <strong className="text-amber-300">{liveSessionStats.breakMinutesTotal}m</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
                        {todayLog?.type === 'leave' ? 'Annual Leave Credited' : 'Hours Credited Today'}
                      </div>
                      <div className="text-4xl font-extrabold tracking-tight text-white">
                        {formatHours(todayCredited)}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">
                        {todayLog?.type === 'leave'
                          ? `Full daily allowance (${formatDecimal(todayCredited)}) automatically applied`
                          : todayLog
                          ? `Shift: ${todayLog.startTime} – ${todayLog.endTime} (${todayLog.breakMinutes}m break)`
                          : `Standard daily target: ${formatHours(todayTarget)}`}
                      </p>
                    </>
                  )}
                </div>

                {/* Primary Action Buttons */}
                {!activeSession.isClockedIn ? (
                  <div className="space-y-3 mt-5">
                    <button
                      onClick={handleClockIn}
                      disabled={todayLog?.type === 'leave'}
                      className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-[0.98] ${
                        todayLog?.type === 'leave'
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                      }`}
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {todayLog ? 'Clock In Another Shift' : 'Clock In Now'}
                    </button>

                    {/* Quick One-Tap Annual Leave Button */}
                    <button
                      onClick={() => handleMarkAnnualLeave(todayStr)}
                      className={`w-full py-3 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                        todayLog?.type === 'leave'
                          ? 'bg-teal-500/20 border-teal-500/50 text-teal-200'
                          : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <Palmtree className="w-4 h-4 text-teal-400" />
                      {todayLog?.type === 'leave'
                        ? `Annual Leave Active (+${formatHours(todayCredited)}) — Tap to Undo`
                        : `On Annual Leave Today (+${formatHours(todayTarget > 0 ? todayTarget : standardDailyHours)})`}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 mt-5">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleToggleBreak}
                        className={`py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                          activeSession.isOnBreak
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                            : 'bg-slate-800/90 text-amber-300 border-amber-500/30 hover:bg-slate-800'
                        }`}
                      >
                        <Coffee className="w-4 h-4" />
                        {activeSession.isOnBreak ? 'End Break' : 'Take Break'}
                      </button>

                      <button
                        onClick={handleClockOut}
                        className="py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/25 transition-all active:scale-95"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        Clock Out
                      </button>
                    </div>

                    {/* Quick Break Deduction Adjuster while clocked in */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Add/deduct manual break:</span>
                      <div className="flex items-center gap-1.5">
                        {[0, 15, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            onClick={() => setActiveSession(prev => ({ ...prev, manualBreakMinutes: mins }))}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                              activeSession.manualBreakMinutes === mins
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SUMMARY CARD 1: CUMULATIVE RUNNING BALANCE (OVER / UNDER) */}
              <div className={`rounded-3xl p-5 border shadow-lg transition-all ${
                runningBalanceData.totalNetBalance >= -0.01
                  ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30'
                  : 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Running Flexi / Overtime Total
                      </span>
                    </div>
                    <div className={`text-3xl font-extrabold mt-1 flex items-center gap-2 ${
                      runningBalanceData.totalNetBalance >= -0.01 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {formatHours(runningBalanceData.totalNetBalance, true)}
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        runningBalanceData.totalNetBalance >= -0.01
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}>
                        {runningBalanceData.totalNetBalance >= -0.01 ? 'Hours Over' : 'Hours Under'}
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl ${
                    runningBalanceData.totalNetBalance >= -0.01
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {runningBalanceData.totalNetBalance >= -0.01 ? (
                      <TrendingUp className="w-6 h-6" />
                    ) : (
                      <TrendingDown className="w-6 h-6" />
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-800/40 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block uppercase">Total Credited</span>
                    <span className="text-xs font-bold text-slate-200">
                      {formatDecimal(runningBalanceData.totalLoggedHours)}
                    </span>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block uppercase">Target Due</span>
                    <span className="text-xs font-bold text-slate-200">
                      {formatDecimal(runningBalanceData.totalTargetHours)}
                    </span>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block uppercase">Start Offset</span>
                    <span className="text-xs font-bold text-slate-200">
                      {formatDecimal(runningBalanceData.initialOffset, true)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SUMMARY CARD 2: THIS WEEK'S PROGRESS VS WEEKLY CONTRACTED HOURS */}
              <div className="rounded-3xl bg-slate-800/40 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                      This Week's Target Progress
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {formatHours(currentWeekSummary.totalCredited)}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        / {formatHours(weeklyTargetHours)}
                      </span>
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-bold ${
                      currentWeekSummary.weeklyVariance >= -0.01
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {currentWeekSummary.weeklyVariance >= -0.01
                        ? `${formatHours(currentWeekSummary.weeklyVariance, true)} over target`
                        : `${formatHours(currentWeekSummary.remainingToTarget)} left this wk`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      weekProgressPct >= 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                    }`}
                    style={{ width: `${Math.max(4, weekProgressPct)}%` }}
                  />
                </div>

                {/* Mini 7-Day Strip for Current Week */}
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {currentWeekSummary.days.map((d) => {
                    const isToday = d.dateStr === todayStr;
                    const isLeave = d.log?.type === 'leave';
                    const hasWork = d.credited > 0 && !isLeave;
                    return (
                      <button
                        key={d.dateStr}
                        onClick={() => openEditModal(d.dateStr)}
                        className={`p-2 rounded-2xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                          isToday
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : isLeave
                            ? 'bg-teal-500/15 border-teal-500/40 text-teal-200'
                            : hasWork
                            ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase">{d.dayNameShort}</span>
                        <span className="text-xs font-extrabold my-0.5">{d.date.getDate()}</span>
                        {isLeave ? (
                          <Palmtree className="w-3 h-3 text-teal-400 mt-0.5" />
                        ) : (
                          <span className="text-[10px] font-semibold opacity-90">
                            {d.credited > 0 ? `${d.credited.toFixed(1)}h` : '-'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Demo Helper if empty */}
              {Object.keys(logs).length === 0 && !activeSession.isClockedIn && (
                <div className="rounded-2xl bg-indigo-950/30 border border-indigo-500/30 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                    <p className="text-xs text-indigo-200 leading-relaxed">
                      Want to see how weekly targets, flexi balance & annual leave look with data?
                    </p>
                  </div>
                  <button
                    onClick={handleLoadSampleData}
                    className="shrink-0 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all active:scale-95"
                  >
                    Load Demo
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ==========================================
              TAB 2: TIMESHEET & LOG HISTORY
             ========================================== */}
          {activeTab === 'timesheet' && (
            <div className="space-y-4">
              
              {/* Week Navigator Header */}
              <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                <button
                  onClick={() => setSelectedWeekMonday(prev => addDays(prev, -7))}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95"
                  aria-label="Previous Week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {selectedWeekMonday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {addDays(selectedWeekMonday, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {toDateStr(selectedWeekMonday) !== toDateStr(currentWeekMonday) ? (
                    <button
                      onClick={() => setSelectedWeekMonday(currentWeekMonday)}
                      className="text-[11px] font-semibold text-indigo-400 hover:underline mt-0.5"
                    >
                      Jump to Current Week
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-400 block mt-0.5">
                      Current Week
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedWeekMonday(prev => addDays(prev, 7))}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95"
                  aria-label="Next Week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Weekly Breakdown Summary Card */}
              <div className="rounded-3xl bg-slate-800/40 border border-slate-800 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-2.5">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                      Week Credited
                    </span>
                    <span className="text-base font-extrabold text-white mt-0.5 block">
                      {formatHours(selectedWeekSummary.totalCredited)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {selectedWeekSummary.leaveDaysCount > 0
                        ? `Incl. ${selectedWeekSummary.leaveDaysCount}d Leave`
                        : 'Worked hours'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-2.5">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                      Weekly Target
                    </span>
                    <span className="text-base font-extrabold text-slate-200 mt-0.5 block">
                      {formatHours(selectedWeekSummary.weeklyTarget)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Contracted
                    </span>
                  </div>

                  <div className={`border rounded-2xl p-2.5 ${
                    selectedWeekSummary.weeklyVariance >= -0.01
                      ? 'bg-emerald-950/40 border-emerald-500/30'
                      : 'bg-amber-950/30 border-amber-500/30'
                  }`}>
                    <span className="text-[10px] font-semibold uppercase text-slate-300 block">
                      Week +/-
                    </span>
                    <span className={`text-base font-extrabold mt-0.5 block ${
                      selectedWeekSummary.weeklyVariance >= -0.01 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {formatHours(selectedWeekSummary.weeklyVariance, true)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Run: {formatHours(selectedWeekRunningTotal, true)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Log List (Mon - Sun) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Daily Shifts & Annual Leave (Tap to Edit)
                  </span>
                </div>

                {selectedWeekSummary.days.map((day) => {
                  const isToday = day.dateStr === todayStr;
                  const isLeave = day.log?.type === 'leave';
                  const hasLog = Boolean(day.log) || day.isLiveToday;

                  return (
                    <div
                      key={day.dateStr}
                      className={`rounded-2xl p-3.5 border transition-all ${
                        isToday
                          ? 'bg-indigo-950/30 border-indigo-500/50'
                          : isLeave
                          ? 'bg-teal-950/25 border-teal-500/30'
                          : hasLog
                          ? 'bg-slate-800/60 border-slate-700/80'
                          : 'bg-slate-900/40 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Left Date Box + Details */}
                        <div
                          onClick={() => openEditModal(day.dateStr)}
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                          <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center border shrink-0 ${
                            isToday
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : isLeave
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                              : hasLog
                              ? 'bg-slate-800 text-slate-200 border-slate-700'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}>
                            <span className="text-[10px] font-bold uppercase">{day.dayNameShort}</span>
                            <span className="text-sm font-extrabold">{day.date.getDate()}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                {day.dayNameFull}
                              </span>
                              {isToday && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  Today
                                </span>
                              )}
                            </div>

                            {isLeave ? (
                              <div className="text-xs text-teal-300 font-medium flex items-center gap-1 mt-0.5">
                                <Palmtree className="w-3.5 h-3.5 shrink-0" />
                                <span>Annual Leave (Full day credited)</span>
                              </div>
                            ) : day.isLiveToday ? (
                              <div className="text-xs text-emerald-400 font-medium mt-0.5">
                                Live shift in progress...
                              </div>
                            ) : day.log ? (
                              <div className="text-xs text-slate-300 mt-0.5 truncate">
                                {day.log.startTime} – {day.log.endTime}
                                {day.log.breakMinutes > 0 ? ` (${day.log.breakMinutes}m break)` : ''}
                                {day.log.note ? ` • ${day.log.note}` : ''}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {day.dayTarget > 0
                                  ? `Due: ${formatHours(day.dayTarget)} — Tap to log shift`
                                  : 'Non-working day'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Hours + Quick Annual Leave Toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div
                            onClick={() => openEditModal(day.dateStr)}
                            className="text-right cursor-pointer pr-1"
                          >
                            <div className={`text-sm font-extrabold ${
                              isLeave
                                ? 'text-teal-300'
                                : day.credited > 0
                                ? 'text-white'
                                : 'text-slate-500'
                            }`}>
                              {formatHours(day.credited)}
                            </div>
                            {day.dayTarget > 0 && (hasLog || day.dateStr < todayStr) && (
                              <div className={`text-[10px] font-semibold ${
                                day.variance >= -0.01 ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {formatHours(day.variance, true)}
                              </div>
                            )}
                          </div>

                          {/* One-tap Annual Leave toggle button on each row */}
                          <button
                            onClick={() => handleMarkAnnualLeave(day.dateStr)}
                            title="Toggle Annual Leave"
                            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                              isLeave
                                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-500/20'
                                : 'bg-slate-800/90 text-slate-400 hover:text-teal-300 border-slate-700'
                            }`}
                          >
                            <Palmtree className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export & Reset Tools */}
              <div className="rounded-3xl bg-slate-800/30 border border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Data & Backup
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleExportCSV}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    Export CSV
                  </button>
                  <button
                    onClick={handleLoadSampleData}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Load Demo Data
                  </button>
                </div>
                <button
                  onClick={handleResetAll}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear All Recorded Logs
                </button>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB 3: USER PROFILE & WEEKLY HOURS SETUP
             ========================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              
              {/* User Identity Card */}
              <div className="rounded-3xl bg-slate-800/50 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-extrabold text-white shadow-lg">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">User Profile & Contract</h2>
                    <p className="text-xs text-slate-400">
                      Configure your weekly hours and daily annual leave allowance
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Job Title / Department
                    </label>
                    <input
                      type="text"
                      value={profile.role}
                      onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="e.g. Operations Coordinator"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Weekly Contracted Hours & Schedule Configuration */}
              <div className="rounded-3xl bg-slate-800/50 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                      Contracted Schedule
                    </span>
                    <h3 className="text-base font-bold text-white">Weekly Hours & Working Days</h3>
                  </div>
                </div>

                {/* Schedule Mode Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setProfile(prev => ({ ...prev, scheduleMode: 'standard' }))}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      profile.scheduleMode === 'standard'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Equal Daily Hours
                  </button>
                  <button
                    onClick={() => setProfile(prev => ({ ...prev, scheduleMode: 'custom' }))}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      profile.scheduleMode === 'custom'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Custom Per Day
                  </button>
                </div>

                {profile.scheduleMode === 'standard' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        Weekly Contracted Hours
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.25"
                          min="1"
                          max="100"
                          value={profile.weeklyHours}
                          onChange={(e) => setProfile(prev => ({ ...prev, weeklyHours: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-white focus:outline-none focus:border-indigo-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          hrs / week
                        </span>
                      </div>
                      {/* Quick presets */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
                        {[35, 37.5, 40, 42.5].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setProfile(prev => ({ ...prev, weeklyHours: preset }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              Number(profile.weeklyHours) === preset
                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {preset}h
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Working Days Selector */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-2">
                        Normal Working Days ({profile.activeDays.filter(Boolean).length} days/week)
                      </label>
                      <div className="grid grid-cols-7 gap-1.5">
                        {DAY_NAMES_SHORT.map((dayName, idx) => {
                          const isActive = profile.activeDays[idx];
                          return (
                            <button
                              key={dayName}
                              type="button"
                              onClick={() => {
                                const nextDays = [...profile.activeDays];
                                // Prevent unchecking all days
                                if (isActive && nextDays.filter(Boolean).length <= 1) return;
                                nextDays[idx] = !isActive;
                                setProfile(prev => ({
                                  ...prev,
                                  activeDays: nextDays,
                                  workingDaysCount: nextDays.filter(Boolean).length
                                }));
                              }}
                              className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                isActive
                                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            >
                              {dayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-400">
                      Set your exact contracted hours for each day of the week:
                    </p>
                    {DAY_NAMES_FULL.map((dayName, idx) => (
                      <div key={dayName} className="flex items-center justify-between bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800">
                        <span className="text-xs font-semibold text-slate-200">{dayName}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            value={profile.customDailyHours[idx]}
                            onChange={(e) => {
                              const nextCustom = [...profile.customDailyHours];
                              nextCustom[idx] = parseFloat(e.target.value) || 0;
                              setProfile(prev => ({ ...prev, customDailyHours: nextCustom }));
                            }}
                            className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-right text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-xs text-slate-400">hrs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Automatic Daily Annual Leave Credit Callout */}
                <div className="rounded-2xl bg-teal-950/30 border border-teal-500/30 p-3.5 flex items-start gap-3">
                  <Palmtree className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-teal-200 space-y-1">
                    <div className="font-bold text-teal-100">
                      Automatic Annual Leave Credit: {formatHours(standardDailyHours)} / day
                    </div>
                    <p className="text-teal-300/80 leading-relaxed">
                      Whenever you mark a day as Annual Leave, WorkFlex automatically credits you with the full hours due for that day ({formatDecimal(standardDailyHours)}) so your weekly target & running balance stay accurate.
                    </p>
                  </div>
                </div>
              </div>

              {/* Flexi / Overtime Starting Offset & Default Break */}
              <div className="rounded-3xl bg-slate-800/50 border border-slate-800 p-5 space-y-4">
                <h3 className="text-base font-bold text-white">Flexi Balance & Break Defaults</h3>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Starting Flexi / Overtime Balance Offset (Hours)
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Already carrying over hours (e.g. +2.5 or -1.5) before using the app? Enter them here.
                    </p>
                    <input
                      type="number"
                      step="0.25"
                      value={profile.initialBalanceOffset}
                      onChange={(e) => setProfile(prev => ({ ...prev, initialBalanceOffset: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Default Unpaid Break (Minutes)
                    </label>
                    <div className="flex items-center gap-2">
                      {[0, 15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setProfile(prev => ({ ...prev, defaultBreakMinutes: mins }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                            Number(profile.defaultBreakMinutes) === mins
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>

        {/* ==========================================
            MODAL: EDIT DAY SHIFT OR ANNUAL LEAVE
           ========================================== */}
        {editingDateStr && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Edit Day Log
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {parseDateStr(editingDateStr).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingDateStr(null)}
                  className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveModal} className="space-y-4">
                {/* Day Type Selector: Work Shift vs Annual Leave */}
                <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalForm(prev => ({ ...prev, type: 'work' }))}
                    className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      modalForm.type === 'work'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Work Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalForm(prev => ({ ...prev, type: 'leave' }))}
                    className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      modalForm.type === 'leave'
                        ? 'bg-teal-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Palmtree className="w-4 h-4" />
                    Annual Leave
                  </button>
                </div>

                {modalForm.type === 'leave' ? (
                  <div className="rounded-2xl bg-teal-950/40 border border-teal-500/30 p-4 text-center space-y-1.5">
                    <Palmtree className="w-8 h-8 text-teal-400 mx-auto" />
                    <div className="text-sm font-bold text-teal-100">
                      Full Daily Hours Automatically Credited
                    </div>
                    <div className="text-2xl font-extrabold text-teal-300">
                      {formatHours(getTargetForDateStr(editingDateStr) > 0 ? getTargetForDateStr(editingDateStr) : standardDailyHours)}
                    </div>
                    <p className="text-xs text-teal-300/80">
                      Marking this day as Annual Leave credits your full scheduled daily hours so you don't fall under your weekly target.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Toggle between Start/End time and Direct Hours input */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">
                        {modalForm.useManualHours ? 'Enter Total Worked Hours' : 'Clock In & Out Times'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalForm(prev => ({ ...prev, useManualHours: !prev.useManualHours }))}
                        className="text-xs font-semibold text-indigo-400 hover:underline"
                      >
                        {modalForm.useManualHours ? 'Use Start/End Times' : 'Enter Hours Directly'}
                      </button>
                    </div>

                    {!modalForm.useManualHours ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Clock In</label>
                            <input
                              type="time"
                              value={modalForm.startTime}
                              onChange={(e) => setModalForm(prev => ({ ...prev, startTime: e.target.value }))}
                              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Clock Out</label>
                            <input
                              type="time"
                              value={modalForm.endTime}
                              onChange={(e) => setModalForm(prev => ({ ...prev, endTime: e.target.value }))}
                              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Break Deduction (Minutes)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="480"
                              value={modalForm.breakMinutes}
                              onChange={(e) => setModalForm(prev => ({ ...prev, breakMinutes: parseInt(e.target.value, 10) || 0 }))}
                              className="w-24 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                            />
                            <div className="flex gap-1.5 flex-1">
                              {[0, 15, 30, 60].map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setModalForm(prev => ({ ...prev, breakMinutes: m }))}
                                  className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                                    Number(modalForm.breakMinutes) === m
                                      ? 'bg-indigo-600 text-white border-indigo-400'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {m}m
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400">Calculated Shift Total:</span>
                          <span className="text-base font-extrabold text-emerald-400">
                            {formatHours(calcShiftHours(modalForm.startTime, modalForm.endTime, modalForm.breakMinutes))}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Net Hours Worked</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="24"
                          value={modalForm.manualHours}
                          onChange={(e) => setModalForm(prev => ({ ...prev, manualHours: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-base"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    value={modalForm.note}
                    onChange={(e) => setModalForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder={modalForm.type === 'leave' ? 'e.g. Holiday / Time off' : 'e.g. Project overtime'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  {logs[editingDateStr] && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLog(editingDateStr)}
                      className="p-3 rounded-2xl bg-rose-950/60 text-rose-300 border border-rose-500/30 hover:bg-rose-900/60"
                      title="Delete Day Entry"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingDateStr(null)}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/25"
                  >
                    <Save className="w-4 h-4" />
                    Save Day
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmDialog && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">{confirmDialog.title}</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM MOBILE NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/15 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="text-[11px]">Clock & Status</span>
            </button>

            <button
              onClick={() => setActiveTab('timesheet')}
              className={`py-2 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'timesheet'
                  ? 'bg-indigo-600/15 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[11px]">Timesheet</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'profile'
                  ? 'bg-indigo-600/15 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[11px]">Profile & Hours</span>
            </button>
          </div>
        </nav>

      </div>
    </div>
  );
}