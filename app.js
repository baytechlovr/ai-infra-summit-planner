/**
 * AI Infra Summit 2026 - Itinerary & Personal Attendance Planner
 * Core Application Logic with Live Summit Website Synchronization
 */

(function () {
  'use strict';

  // State
  const STORAGE_KEY_ATTENDING = 'ai_infra_attending_sessions_v1';
  const STORAGE_KEY_NOTES = 'ai_infra_session_notes_v1';
  const STORAGE_KEY_LAST_SYNC = 'ai_infra_last_sync_v1';

  let sessions = window.SUMMIT_SESSIONS || [];
  let attendingIds = new Set(loadAttending());
  let sessionNotes = loadNotes();

  let state = {
    search: '',
    day: 'all',
    track: 'all',
    format: 'all',
    ticket: 'all',
    timeOfDay: 'all',
    viewMode: 'all', // 'all' | 'my-schedule' | 'conflicts'
    activeModalSessionId: null,
    isSyncing: false,
    lastSyncedText: localStorage.getItem(STORAGE_KEY_LAST_SYNC) || 'Sep 14, 2026 (Initial Extract)'
  };

  // Local Storage Helpers
  function loadAttending() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ATTENDING);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load attending sessions from localStorage', e);
      return [];
    }
  }

  function saveAttending() {
    try {
      localStorage.setItem(STORAGE_KEY_ATTENDING, JSON.stringify(Array.from(attendingIds)));
    } catch (e) {
      console.error('Failed to save attending sessions', e);
    }
  }

  function loadNotes() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_NOTES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to load notes from localStorage', e);
      return {};
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(sessionNotes));
    } catch (e) {
      console.error('Failed to save notes', e);
    }
  }

  // Conflict Detection Engine
  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function getConflictsMap() {
    const conflictMap = new Map();
    const attendingSessions = sessions.filter(s => attendingIds.has(s.id));

    const byDate = {};
    for (const s of attendingSessions) {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    }

    for (const date in byDate) {
      const dayList = byDate[date];
      for (let i = 0; i < dayList.length; i++) {
        for (let j = i + 1; j < dayList.length; j++) {
          const s1 = dayList[i];
          const s2 = dayList[j];

          const start1 = timeToMinutes(s1.start24);
          const end1 = timeToMinutes(s1.end24);
          const start2 = timeToMinutes(s2.start24);
          const end2 = timeToMinutes(s2.end24);

          if (Math.max(start1, start2) < Math.min(end1, end2)) {
            if (!conflictMap.has(s1.id)) conflictMap.set(s1.id, []);
            if (!conflictMap.has(s2.id)) conflictMap.set(s2.id, []);
            conflictMap.get(s1.id).push(s2);
            conflictMap.get(s2.id).push(s1);
          }
        }
      }
    }

    return conflictMap;
  }

  // Toast System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="text-lg">${icon}</span>
      <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Track Color CSS Helper
  function getTrackClass(trackName) {
    const map = {
      'Main Stage': 'track-main-stage',
      'Data & Models': 'track-data-models',
      'Compute': 'track-compute',
      'Data Movement': 'track-data-movement',
      'AI Data Center': 'track-ai-data-center',
      'Physical AI': 'track-physical-ai',
      'Expo Theater 1': 'track-expo-theater-1',
      'Expo Theater 2': 'track-expo-theater-2',
      'Workshops': 'track-workshops',
      'Breakfast Briefings': 'track-breakfast-briefings'
    };
    return map[trackName] || 'track-main-stage';
  }

  // Filtering Logic
  function getFilteredSessions() {
    const conflicts = getConflictsMap();

    return sessions.filter(s => {
      if (state.viewMode === 'my-schedule' && !attendingIds.has(s.id)) {
        return false;
      }
      if (state.viewMode === 'conflicts') {
        if (!attendingIds.has(s.id) || !conflicts.has(s.id)) return false;
      }

      if (state.day !== 'all' && s.day !== state.day) {
        return false;
      }

      if (state.track !== 'all' && s.track !== state.track) {
        return false;
      }

      if (state.format !== 'all' && s.format !== state.format) {
        return false;
      }

      if (state.ticket !== 'all' && s.ticketType !== state.ticket) {
        return false;
      }

      if (state.timeOfDay !== 'all') {
        const startMin = timeToMinutes(s.start24);
        if (state.timeOfDay === 'morning' && startMin >= 12 * 60) return false;
        if (state.timeOfDay === 'afternoon' && (startMin < 12 * 60 || startMin >= 16 * 60)) return false;
        if (state.timeOfDay === 'late' && startMin < 16 * 60) return false;
      }

      if (state.search.trim()) {
        const q = state.search.toLowerCase().trim();
        const inTitle = s.title.toLowerCase().includes(q);
        const inTrack = s.track.toLowerCase().includes(q);
        const inFormat = s.format.toLowerCase().includes(q);
        const inLocation = s.location.toLowerCase().includes(q);
        const inSpeakers = s.speakers.some(sp => 
          sp.name.toLowerCase().includes(q) || sp.role.toLowerCase().includes(q)
        );
        const inNotes = (sessionNotes[s.id] || '').toLowerCase().includes(q);

        if (!inTitle && !inTrack && !inFormat && !inLocation && !inSpeakers && !inNotes) {
          return false;
        }
      }

      return true;
    });
  }

  // Update Summary Metrics
  function updateStats() {
    const attendingSessions = sessions.filter(s => attendingIds.has(s.id));
    const conflicts = getConflictsMap();
    const conflictCount = conflicts.size;

    let totalMinutes = 0;
    const tracksCovered = new Set();
    const dayCounts = { 'Day 1': 0, 'Day 2': 0, 'Day 3': 0 };

    for (const s of attendingSessions) {
      totalMinutes += (s.durationMinutes || 30);
      tracksCovered.add(s.track);
      if (dayCounts[s.day] !== undefined) dayCounts[s.day]++;
    }

    const totalHours = (totalMinutes / 60).toFixed(1);

    const elAttendingCount = document.getElementById('stat-attending-count');
    const elTotalHours = document.getElementById('stat-total-hours');
    const elConflictCount = document.getElementById('stat-conflict-count');
    const elTracksCovered = document.getElementById('stat-tracks-covered');
    const elConflictBanner = document.getElementById('conflict-alert-banner');
    const elConflictBannerText = document.getElementById('conflict-alert-banner-text');
    const elLastSynced = document.getElementById('last-synced-text');

    if (elAttendingCount) elAttendingCount.textContent = attendingSessions.length;
    if (elTotalHours) elTotalHours.textContent = totalHours;
    if (elTracksCovered) elTracksCovered.textContent = tracksCovered.size;

    if (elConflictCount) {
      elConflictCount.textContent = conflictCount;
      if (conflictCount > 0) {
        elConflictCount.parentElement.classList.add('border-amber-500/60', 'bg-amber-500/10');
      } else {
        elConflictCount.parentElement.classList.remove('border-amber-500/60', 'bg-amber-500/10');
      }
    }

    const badgeAll = document.getElementById('badge-all-sessions');
    const badgeMy = document.getElementById('badge-my-schedule');
    const badgeConflicts = document.getElementById('badge-conflicts');

    if (badgeAll) badgeAll.textContent = sessions.length;
    if (badgeMy) badgeMy.textContent = attendingSessions.length;
    if (badgeConflicts) badgeConflicts.textContent = conflictCount;

    if (elLastSynced) {
      elLastSynced.textContent = state.lastSyncedText;
    }

    if (elConflictBanner) {
      if (conflictCount > 0) {
        elConflictBanner.classList.remove('hidden');
        if (elConflictBannerText) {
          elConflictBannerText.textContent = `You have ${conflictCount} overlapping sessions scheduled in your itinerary. Review them to avoid missing talks!`;
        }
      } else {
        elConflictBanner.classList.add('hidden');
      }
    }
  }

  // Toggle Attendance
  function toggleAttendance(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (attendingIds.has(sessionId)) {
      attendingIds.delete(sessionId);
      saveAttending();
      showToast(`Removed "${session.title}" from your itinerary`, 'info');
    } else {
      attendingIds.add(sessionId);
      saveAttending();

      const conflicts = getConflictsMap();
      if (conflicts.has(sessionId)) {
        const conflictingNames = conflicts.get(sessionId).map(c => c.title).join('", "');
        showToast(`Added, but overlaps with: "${conflictingNames}"`, 'warning');
      } else {
        showToast(`Added "${session.title}" to your itinerary!`, 'success');
      }
    }

    updateStats();
    render();
  }

  // Render Session Cards
  function renderSessionCard(s, conflicts) {
    const isAttending = attendingIds.has(s.id);
    const hasConflict = isAttending && conflicts.has(s.id);
    const conflictList = hasConflict ? conflicts.get(s.id) : [];
    const notes = sessionNotes[s.id] || '';
    const trackClass = getTrackClass(s.track);

    const ticketBadge = s.ticketType.includes('Expo')
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Expo Pass Eligible</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">Full-Access & VIP</span>`;

    const speakersHtml = s.speakers && s.speakers.length > 0
      ? `<div class="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2.5 items-center">
          ${s.speakers.map(sp => `
            <div class="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 rounded-lg">
              ${sp.image ? `<img src="${sp.image}" alt="${sp.name}" class="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0" onerror="this.style.display='none'">` : ''}
              <div class="text-xs leading-tight">
                <div class="font-semibold text-slate-200">${sp.name}</div>
                ${sp.role ? `<div class="text-slate-400 text-[11px] truncate max-w-[220px]">${sp.role}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>`
      : '';

    const conflictAlertHtml = hasConflict
      ? `<div class="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2 animate-conflict-pulse">
          <span class="text-base shrink-0">⚠️</span>
          <div>
            <strong class="font-semibold block">Time Conflict Alert</strong>
            <span>Overlaps with: ${conflictList.map(c => `<strong>${c.title}</strong> (${c.startTime} - ${c.endTime})`).join(', ')}</span>
          </div>
        </div>`
      : '';

    const notesBadge = notes
      ? `<button onclick="window.App.openNotesModal('${s.id}')" class="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 flex items-center gap-1">
          <span>📝</span> <span>Note attached</span>
        </button>`
      : `<button onclick="window.App.openNotesModal('${s.id}')" class="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 flex items-center gap-1">
          <span>📝</span> <span>Add Note</span>
        </button>`;

    return `
      <div class="session-card ${trackClass} ${isAttending ? 'is-attending' : ''} ${hasConflict ? 'has-conflict' : ''} rounded-xl p-5 flex flex-col justify-between" id="card-${s.id}">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-300">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ${s.startTime} - ${s.endTime}
              </span>
              <span class="text-xs text-slate-400 font-medium">(${s.durationMinutes} min)</span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold" style="color: var(--track-color); background: var(--track-bg); border: 1px solid var(--track-border)">
                ${s.track}
              </span>
              <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                ${s.format}
              </span>
              ${ticketBadge}
            </div>
          </div>

          <h3 class="text-lg font-bold text-white mb-2 leading-snug cursor-pointer hover:text-blue-400 transition" onclick="window.App.openDetailsModal('${s.id}')">
            ${s.title}
          </h3>

          <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <span class="text-slate-300 font-medium">${s.location}</span>
            <span class="text-slate-600">•</span>
            <span class="text-slate-400">${s.dayLabel}</span>
          </div>

          ${speakersHtml}
          ${conflictAlertHtml}
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            ${notesBadge}
            <button onclick="window.App.openDetailsModal('${s.id}')" class="text-xs px-2.5 py-1 rounded bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition">
              Details
            </button>
          </div>

          <button 
            onclick="window.App.toggleAttendance('${s.id}')" 
            class="btn-attend px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              isAttending 
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20' 
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20'
            }"
          >
            ${isAttending 
              ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg> Attending`
              : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Attend`
            }
          </button>
        </div>
      </div>
    `;
  }

  // Render Itinerary Timeline View
  function renderItineraryTimeline(sessionsList, conflicts) {
    if (sessionsList.length === 0) {
      return `
        <div class="text-center py-16 px-4 bg-slate-900/40 border border-slate-800 rounded-2xl max-w-lg mx-auto mt-6">
          <div class="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4 text-3xl">
            📅
          </div>
          <h3 class="text-xl font-bold text-white mb-2">Your Itinerary is Empty</h3>
          <p class="text-slate-400 text-sm mb-6 leading-relaxed">
            Browse the summit sessions across all 10 stages and click <strong>"Attend"</strong> on the talks you don't want to miss!
          </p>
          <div class="flex justify-center gap-3">
            <button onclick="window.App.setViewMode('all')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition">
              Browse All 343 Sessions
            </button>
            <button onclick="window.App.applyRecommendedKeynotes()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition">
              Add Keynotes Preset
            </button>
          </div>
        </div>
      `;
    }

    const days = ['Day 1', 'Day 2', 'Day 3'];
    let html = '<div class="space-y-10">';

    for (const d of days) {
      const daySessions = sessionsList
        .filter(s => s.day === d)
        .sort((a, b) => timeToMinutes(a.start24) - timeToMinutes(b.start24));

      if (daySessions.length === 0) continue;

      const dateLabel = daySessions[0].dayLabel;

      html += `
        <div class="border-l-2 border-blue-500/40 pl-4 sm:pl-6 ml-2 sm:ml-4">
          <div class="sticky top-20 z-10 bg-slate-950/90 backdrop-blur py-2.5 mb-5 flex items-center justify-between border-b border-slate-800">
            <div>
              <h2 class="text-xl font-extrabold text-white flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                ${d} &mdash; ${dateLabel}
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">${daySessions.length} sessions selected</p>
            </div>
            <button onclick="window.App.exportDayIcs('${d}')" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 no-print">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Export ${d} .ics
            </button>
          </div>

          <div class="space-y-4">
      `;

      for (let i = 0; i < daySessions.length; i++) {
        const s = daySessions[i];
        html += renderSessionCard(s, conflicts);

        if (i < daySessions.length - 1) {
          const nextS = daySessions[i + 1];
          const currEnd = timeToMinutes(s.end24);
          const nextStart = timeToMinutes(nextS.start24);
          const gap = nextStart - currEnd;

          if (gap > 0) {
            html += `
              <div class="py-1.5 flex items-center justify-center text-xs text-slate-500 gap-2">
                <span class="h-px bg-slate-800 flex-1"></span>
                <span class="bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-800 text-[11px] text-slate-400">
                  ⏳ ${gap} min break / transit buffer
                </span>
                <span class="h-px bg-slate-800 flex-1"></span>
              </div>
            `;
          } else if (gap < 0) {
            html += `
              <div class="py-1.5 flex items-center justify-center text-xs text-amber-400 gap-2">
                <span class="h-px bg-amber-500/30 flex-1"></span>
                <span class="bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/40 text-[11px] font-semibold">
                  ⚠️ Direct Overlap: ${Math.abs(gap)} minutes clash
                </span>
                <span class="h-px bg-amber-500/30 flex-1"></span>
              </div>
            `;
          }
        }
      }

      html += `
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  // Main Render Routine
  function render() {
    const container = document.getElementById('sessions-container');
    const resultCountEl = document.getElementById('search-result-count');
    if (!container) return;

    const filtered = getFilteredSessions();
    const conflicts = getConflictsMap();

    if (resultCountEl) {
      resultCountEl.textContent = `Showing ${filtered.length} of ${sessions.length} sessions`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-4 bg-slate-900/30 border border-slate-800/80 rounded-2xl">
          <div class="text-4xl mb-3">🔍</div>
          <h3 class="text-lg font-bold text-white mb-1">No sessions match your filters</h3>
          <p class="text-slate-400 text-sm mb-4">Try clearing search keywords or changing the track/day filter.</p>
          <button onclick="window.App.resetFilters()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition">
            Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    if (state.viewMode === 'my-schedule') {
      container.className = 'w-full';
      container.innerHTML = renderItineraryTimeline(filtered, conflicts);
    } else {
      container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5';
      container.innerHTML = filtered.map(s => renderSessionCard(s, conflicts)).join('');
    }
  }

  // LIVE SYNC WITH WEBSITE
  async function syncWithWebsite() {
    if (state.isSyncing) return;
    state.isSyncing = true;

    const syncBtn = document.getElementById('btn-sync-website');
    const originalBtnHtml = syncBtn ? syncBtn.innerHTML : '';
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Syncing with Summit...
      `;
    }

    showToast('Connecting to ai-infra-summit.com to fetch updates...', 'info');

    try {
      // 1. First try the local Python server /api/sync endpoint
      let response = await fetch('/api/sync', { cache: 'no-store' }).catch(() => null);

      let data;
      if (response && response.ok) {
        data = await response.json();
      } else {
        // If not running through python server (e.g. file:/// or standard static server),
        // try fetching fresh sessions.js file with cache buster
        const jsResponse = await fetch(`data/sessions.js?t=${Date.now()}`).catch(() => null);
        if (jsResponse && jsResponse.ok) {
          showToast('Loaded latest local agenda data.', 'success');
        } else {
          throw new Error('Local server sync endpoint unreachable. Please run run.bat or sync.bat to sync.');
        }
      }

      if (data && data.success) {
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          sessions = data.sessions;
        }

        const meta = data.meta || {};
        const timestamp = meta.lastSynced || new Date().toLocaleString();
        state.lastSyncedText = timestamp;
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, timestamp);

        const newCount = meta.newSessions || 0;
        const modCount = meta.modifiedSessions || 0;
        const total = meta.totalSessions || sessions.length;

        // Show detailed sync summary
        openSyncResultsModal({
          success: true,
          total,
          newCount,
          modCount,
          timestamp,
          sourceUrl: meta.sourceUrl || 'https://www.ai-infra-summit.com/2026agenda'
        });

        showToast(`Sync complete: ${total} sessions confirmed. Your selections are preserved!`, 'success');
      } else {
        showToast('Sync finished: Agenda is fully synchronized with summit website.', 'success');
      }

      populateFilterOptions();
      updateStats();
      render();

    } catch (err) {
      console.warn('Direct sync warning:', err);
      showToast(`Sync note: To pull fresh updates from the live site, run "sync.bat" or launch with "run.bat".`, 'warning');
    } finally {
      state.isSyncing = false;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalBtnHtml;
      }
    }
  }

  function openSyncResultsModal(info) {
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="p-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
              🔄
            </div>
            <div>
              <h2 class="text-xl font-bold text-white">Agenda Synchronized</h2>
              <p class="text-xs text-slate-400">Directly from <a href="${info.sourceUrl}" target="_blank" class="text-blue-400 hover:underline">ai-infra-summit.com/2026agenda ↗</a></p>
            </div>
          </div>
          <button onclick="window.App.closeModal()" class="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="bg-slate-900/80 rounded-xl p-4 border border-slate-800 my-4 space-y-3 text-sm">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-400">Total Confirmed Sessions</span>
            <strong class="text-white font-mono text-base">${info.total}</strong>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-400">Newly Added Sessions</span>
            <strong class="text-emerald-400 font-mono text-base">+${info.newCount}</strong>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-400">Updated Details / Speakers</span>
            <strong class="text-cyan-400 font-mono text-base">${info.modCount}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Last Synced</span>
            <strong class="text-slate-200 text-xs">${info.timestamp}</strong>
          </div>
        </div>

        <div class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
          ✓ <strong>Your Itinerary Is Safe:</strong> All your attending bookmarks (${attendingIds.size} sessions) and personal notes have been preserved without changes.
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button onclick="window.App.closeModal()" class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition">
            Got It
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  // Export to iCalendar (.ICS)
  function formatIcsDateTime(dateStr, time24) {
    const d = dateStr.replace(/-/g, '');
    const t = time24.replace(/:/g, '') + '00';
    return `${d}T${t}`;
  }

  function escapeIcsText(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function generateIcs(sessionList, calendarName = 'AI Infra Summit 2026 Schedule') {
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Infra Summit//Schedule Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
      'X-WR-TIMEZONE:America/Los_Angeles',
      'BEGIN:VTIMEZONE',
      'TZID:America/Los_Angeles',
      'X-LIC-LOCATION:America/Los_Angeles',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0700',
      'TZNAME:PDT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ];

    for (const s of sessionList) {
      const dtStart = formatIcsDateTime(s.date, s.start24);
      const dtEnd = formatIcsDateTime(s.date, s.end24);
      const notes = sessionNotes[s.id] || '';

      const speakerNames = s.speakers && s.speakers.length > 0
        ? s.speakers.map(sp => `${sp.name} (${sp.role})`).join(', ')
        : 'N/A';

      let description = `Track: ${s.track}\\nFormat: ${s.format}\\nTicket: ${s.ticketType}\\nSpeakers: ${speakerNames}`;
      if (notes) {
        description += `\\n\\nPersonal Notes:\\n${notes}`;
      }

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:aiinfra2026-${s.id}@ai-infra-summit.com`);
      ics.push(`DTSTAMP:${formatIcsDateTime('2026-09-14', '12:00')}Z`);
      ics.push(`DTSTART;TZID=America/Los_Angeles:${dtStart}`);
      ics.push(`DTEND;TZID=America/Los_Angeles:${dtEnd}`);
      ics.push(`SUMMARY:[${s.track}] ${escapeIcsText(s.title)}`);
      ics.push(`LOCATION:Santa Clara Convention Center - ${escapeIcsText(s.location)}`);
      ics.push(`DESCRIPTION:${description}`);
      ics.push('STATUS:CONFIRMED');

      ics.push('BEGIN:VALARM');
      ics.push('TRIGGER:-PT15M');
      ics.push('ACTION:DISPLAY');
      ics.push(`DESCRIPTION:Upcoming session: ${escapeIcsText(s.title)}`);
      ics.push('END:VALARM');

      ics.push('END:VEVENT');
    }

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
  }

  function downloadIcsFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportAllIcs() {
    const attendingSessions = sessions.filter(s => attendingIds.has(s.id));
    if (attendingSessions.length === 0) {
      showToast('No sessions selected in your itinerary yet!', 'warning');
      return;
    }

    const icsContent = generateIcs(attendingSessions, 'AI Infra Summit 2026 - My Itinerary');
    downloadIcsFile(icsContent, 'ai_infra_summit_2026_itinerary.ics');
    showToast(`Exported ${attendingSessions.length} sessions to iCalendar (.ics)`, 'success');
  }

  function exportDayIcs(dayName) {
    const daySessions = sessions.filter(s => attendingIds.has(s.id) && s.day === dayName);
    if (daySessions.length === 0) {
      showToast(`No sessions selected for ${dayName}`, 'warning');
      return;
    }
    const icsContent = generateIcs(daySessions, `AI Infra Summit 2026 - ${dayName}`);
    downloadIcsFile(icsContent, `ai_infra_summit_2026_${dayName.toLowerCase().replace(' ', '_')}.ics`);
    showToast(`Exported ${daySessions.length} sessions for ${dayName}`, 'success');
  }

  function applyRecommendedKeynotes() {
    const recommendedQueries = [
      'The Bitter Lesson',
      'Opening Remarks',
      'Keynote',
      'Dave Patterson',
      'Intel',
      'Meta',
      'Google',
      'AI21 Labs',
      'Physical AI'
    ];

    let addedCount = 0;
    for (const s of sessions) {
      const match = recommendedQueries.some(q => 
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.speakers.some(sp => sp.name.toLowerCase().includes(q.toLowerCase()) || sp.role.toLowerCase().includes(q.toLowerCase()))
      );
      if (match && !attendingIds.has(s.id)) {
        attendingIds.add(s.id);
        addedCount++;
      }
    }

    saveAttending();
    updateStats();
    render();
    showToast(`Added ${addedCount} recommended talks & keynotes!`, 'success');
  }

  function exportJsonBackup() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      attendingSessionIds: Array.from(attendingIds),
      notes: sessionNotes
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ai_infra_summit_itinerary_backup.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Itinerary backup saved to JSON', 'success');
  }

  function importJsonBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.attendingSessionIds && Array.isArray(data.attendingSessionIds)) {
          attendingIds = new Set(data.attendingSessionIds);
          saveAttending();
        }
        if (data.notes && typeof data.notes === 'object') {
          sessionNotes = data.notes;
          saveNotes();
        }
        updateStats();
        render();
        showToast('Itinerary successfully restored from backup!', 'success');
      } catch (err) {
        showToast('Invalid backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function clearAllAttending() {
    if (attendingIds.size === 0) return;
    if (confirm('Are you sure you want to clear your entire personal itinerary?')) {
      attendingIds.clear();
      saveAttending();
      updateStats();
      render();
      showToast('Itinerary cleared', 'info');
    }
  }

  function openDetailsModal(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    state.activeModalSessionId = sessionId;

    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-modal-content');
    if (!modal || !content) return;

    const isAttending = attendingIds.has(sessionId);
    const notes = sessionNotes[sessionId] || '';
    const conflicts = getConflictsMap();
    const hasConflict = isAttending && conflicts.has(sessionId);
    const conflictList = hasConflict ? conflicts.get(sessionId) : [];

    content.innerHTML = `
      <div class="p-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="text-xs px-2.5 py-1 rounded-md font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-800 font-mono">
                ${session.dayLabel} • ${session.startTime} - ${session.endTime}
              </span>
              <span class="text-xs px-2.5 py-0.5 rounded font-semibold text-blue-300 bg-blue-900/40 border border-blue-700">
                ${session.track}
              </span>
              <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                ${session.format}
              </span>
            </div>
            <h2 class="text-xl font-bold text-white leading-snug">${session.title}</h2>
          </div>
          <button onclick="window.App.closeModal()" class="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-4 my-4 text-sm text-slate-300">
          <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 block">Stage / Room</span>
              <strong class="text-slate-200">${session.location}</strong>
            </div>
            <div>
              <span class="text-xs text-slate-400 block">Ticket Requirement</span>
              <strong class="text-slate-200">${session.ticketType}</strong>
            </div>
            <div>
              <span class="text-xs text-slate-400 block">Duration</span>
              <strong class="text-slate-200">${session.durationMinutes} minutes</strong>
            </div>
          </div>

          ${hasConflict ? `
            <div class="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs">
              <strong class="font-semibold block text-sm mb-1">⚠️ Warning: Time Conflict Detected</strong>
              This session overlaps with ${conflictList.map(c => `<strong>${c.title}</strong> (${c.startTime} - ${c.endTime})`).join(', ')}.
            </div>
          ` : ''}

          ${session.speakers && session.speakers.length > 0 ? `
            <div>
              <h4 class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2.5">Featured Speakers</h4>
              <div class="space-y-2.5">
                ${session.speakers.map(sp => `
                  <div class="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    ${sp.image ? `<img src="${sp.image}" alt="${sp.name}" class="w-12 h-12 rounded-full object-cover border border-slate-700 shrink-0" onerror="this.style.display='none'">` : '<div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xl font-bold">👤</div>'}
                    <div>
                      <h5 class="font-bold text-white text-base">${sp.name}</h5>
                      <p class="text-xs text-slate-400">${sp.role || 'Industry Expert'}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="pt-2">
            <h4 class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">My Session Notes</h4>
            <textarea 
              id="modal-session-notes" 
              rows="3" 
              placeholder="e.g. Questions to ask, key contacts, booth numbers, or takeaway points..."
              class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            >${notes}</textarea>
            <div class="flex justify-end mt-2">
              <button onclick="window.App.saveCurrentNotes()" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-md transition flex items-center gap-1">
                <span>💾</span> Save Notes
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          ${session.slug ? `
            <a href="https://www.ai-infra-summit.com/${session.slug}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-400 hover:underline flex items-center gap-1">
              View on Official Website ↗
            </a>
          ` : '<div></div>'}

          <div class="flex items-center gap-3">
            <button onclick="window.App.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">
              Close
            </button>
            <button 
              onclick="window.App.toggleAttendance('${session.id}'); window.App.openDetailsModal('${session.id}');"
              class="px-5 py-2 rounded-lg text-sm font-semibold transition ${
                isAttending 
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' 
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }"
            >
              ${isAttending ? '✓ In My Itinerary' : '+ Add to Itinerary'}
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function openNotesModal(sessionId) {
    openDetailsModal(sessionId);
    setTimeout(() => {
      const textarea = document.getElementById('modal-session-notes');
      if (textarea) textarea.focus();
    }, 100);
  }

  function saveCurrentNotes() {
    if (!state.activeModalSessionId) return;
    const textarea = document.getElementById('modal-session-notes');
    if (!textarea) return;

    const val = textarea.value.trim();
    if (val) {
      sessionNotes[state.activeModalSessionId] = val;
    } else {
      delete sessionNotes[state.activeModalSessionId];
    }
    saveNotes();
    showToast('Notes saved!', 'success');
    render();
  }

  function closeModal() {
    const modal = document.getElementById('details-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    state.activeModalSessionId = null;
  }

  function initListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.search = e.target.value;
        render();
      });
    }

    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.search = '';
        render();
      });
    }

    document.querySelectorAll('.day-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.day-tab-btn').forEach(b => {
          b.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
          b.classList.add('bg-slate-800/80', 'text-slate-400');
        });
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
        btn.classList.remove('bg-slate-800/80', 'text-slate-400');

        state.day = btn.dataset.day;
        render();
      });
    });

    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-mode-btn').forEach(b => {
          b.classList.remove('border-blue-500', 'text-blue-400', 'bg-blue-500/10');
          b.classList.add('border-transparent', 'text-slate-400');
        });
        btn.classList.add('border-blue-500', 'text-blue-400', 'bg-blue-500/10');
        btn.classList.remove('border-transparent', 'text-slate-400');

        state.viewMode = btn.dataset.mode;
        render();
      });
    });

    const trackSelect = document.getElementById('filter-track');
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        state.track = e.target.value;
        render();
      });
    }

    const formatSelect = document.getElementById('filter-format');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        state.format = e.target.value;
        render();
      });
    }

    const ticketSelect = document.getElementById('filter-ticket');
    if (ticketSelect) {
      ticketSelect.addEventListener('change', (e) => {
        state.ticket = e.target.value;
        render();
      });
    }

    const timeOfDaySelect = document.getElementById('filter-time');
    if (timeOfDaySelect) {
      timeOfDaySelect.addEventListener('change', (e) => {
        state.timeOfDay = e.target.value;
        render();
      });
    }

    const modal = document.getElementById('details-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function resetFilters() {
    state.search = '';
    state.day = 'all';
    state.track = 'all';
    state.format = 'all';
    state.ticket = 'all';
    state.timeOfDay = 'all';

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    const trackSelect = document.getElementById('filter-track');
    if (trackSelect) trackSelect.value = 'all';

    const formatSelect = document.getElementById('filter-format');
    if (formatSelect) formatSelect.value = 'all';

    const ticketSelect = document.getElementById('filter-ticket');
    if (ticketSelect) ticketSelect.value = 'all';

    const timeSelect = document.getElementById('filter-time');
    if (timeSelect) timeSelect.value = 'all';

    document.querySelectorAll('.day-tab-btn').forEach(b => {
      if (b.dataset.day === 'all') {
        b.classList.add('bg-blue-600', 'text-white');
        b.classList.remove('bg-slate-800/80', 'text-slate-400');
      } else {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-slate-800/80', 'text-slate-400');
      }
    });

    render();
    showToast('Filters reset', 'info');
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    document.querySelectorAll('.view-mode-btn').forEach(b => {
      if (b.dataset.mode === mode) {
        b.classList.add('border-blue-500', 'text-blue-400', 'bg-blue-500/10');
        b.classList.remove('border-transparent', 'text-slate-400');
      } else {
        b.classList.remove('border-blue-500', 'text-blue-400', 'bg-blue-500/10');
        b.classList.add('border-transparent', 'text-slate-400');
      }
    });
    render();
  }

  function populateFilterOptions() {
    const trackSelect = document.getElementById('filter-track');
    const formatSelect = document.getElementById('filter-format');

    if (trackSelect) {
      const currentTrack = state.track;
      trackSelect.innerHTML = '<option value="all">All Tracks (10)</option>';
      const tracks = Array.from(new Set(sessions.map(s => s.track))).sort();
      tracks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === currentTrack) opt.selected = true;
        trackSelect.appendChild(opt);
      });
    }

    if (formatSelect) {
      const currentFormat = state.format;
      formatSelect.innerHTML = '<option value="all">All Formats</option>';
      const formats = Array.from(new Set(sessions.map(s => s.format))).sort();
      formats.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (f === currentFormat) opt.selected = true;
        formatSelect.appendChild(opt);
      });
    }
  }

  // Check initial sync status from server
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.meta && data.meta.lastSynced) {
          state.lastSyncedText = data.meta.lastSynced;
          updateStats();
        }
      }
    } catch (e) {
      // Offline / standalone
    }
  }

  function init() {
    populateFilterOptions();
    initListeners();
    updateStats();
    render();
    checkServerStatus();
  }

  window.App = {
    toggleAttendance,
    openDetailsModal,
    openNotesModal,
    saveCurrentNotes,
    closeModal,
    exportAllIcs,
    exportDayIcs,
    exportJsonBackup,
    importJsonBackup,
    applyRecommendedKeynotes,
    clearAllAttending,
    resetFilters,
    setViewMode,
    syncWithWebsite,
    printItinerary: () => window.print()
  };

  document.addEventListener('DOMContentLoaded', init);
})();
