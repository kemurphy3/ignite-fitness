!(function () {
  var e = {
      776: function (e) {
        function t(e) {
          return Promise.resolve().then(function () {
            var t = new Error("Cannot find module '" + e + "'");
            throw ((t.code = 'MODULE_NOT_FOUND'), t);
          });
        }
        ((t.keys = function () {
          return [];
        }),
          (t.resolve = t),
          (t.id = 776),
          (e.exports = t));
      },
    },
    t = {};
  function n(o) {
    var a = t[o];
    if (void 0 !== a) return a.exports;
    var s = (t[o] = { exports: {} });
    return (e[o](s, s.exports, n), s.exports);
  }
  n.o = function (e, t) {
    return Object.prototype.hasOwnProperty.call(e, t);
  };
  let o = null,
    a = !1,
    s = {},
    r = null,
    i = null,
    c = null,
    l = null,
    d = null;
  const u = new Map(),
    m = new Map();
  async function p(e, t, o = {}) {
    const a = `${e}:${t}`;
    if (u.has(a)) return u.get(a);
    if (m.has(a)) return m.get(a);
    o.showLoading &&
      (function (e = 'Loading...') {
        k();
        const t = document.createElement('div');
        ((t.id = 'loading-overlay'),
          (t.className = 'loading-overlay'),
          (t.innerHTML = `\n        <div class="loading-content">\n            <div class="loading-spinner"></div>\n            <p style="margin: 15px 0 0 0; color: #2d3748; font-weight: 500;">${e}</p>\n        </div>\n    `),
          document.body.appendChild(t));
      })(o.loadingMessage || `Loading ${t}...`);
    try {
      const s = (async () => {
        const o = new (await n(776)(e))[t]();
        return (u.set(a, o), o);
      })();
      m.set(a, s);
      const r = await s;
      return (m.delete(a), o.showLoading && k(), r);
    } catch (e) {
      throw (m.delete(a), o.showLoading && k(), e);
    }
  }
  function g() {
    const e = localStorage.getItem('ignitefitness_data_version');
    '2.0' !== e &&
      ((e && '1.0' !== e) ||
        (function () {
          try {
            const e = localStorage.getItem('ignitefitness_users');
            if (e) {
              const t = JSON.parse(e),
                n = {};
              (Object.keys(t).forEach(e => {
                const o = t[e];
                n[e] = {
                  version: '2.0',
                  username: e,
                  password: o.password,
                  athleteName: o.athleteName,
                  personalData: o.personalData || {},
                  goals: o.goals || {},
                  workoutSchedule: o.workoutSchedule || {},
                  sessions: o.sessions || [],
                  preferences: o.preferences || {},
                  lastSync: o.lastSync || Date.now(),
                  createdAt: o.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
              }),
                localStorage.setItem('ignitefitness_users', JSON.stringify(n)));
            }
            (!(function () {
              const e = localStorage.getItem('strava_access_token'),
                t = localStorage.getItem('strava_refresh_token'),
                n = localStorage.getItem('strava_token_expires'),
                o = localStorage.getItem('strava_athlete_id');
              if (e && t) {
                const a = {
                  access_token: e,
                  refresh_token: t,
                  expires_at: parseInt(n) || 0,
                  athlete_id: o,
                  last_updated: Date.now(),
                };
                (localStorage.setItem('ignitefitness_strava_data', JSON.stringify(a)),
                  localStorage.removeItem('strava_access_token'),
                  localStorage.removeItem('strava_refresh_token'),
                  localStorage.removeItem('strava_token_expires'),
                  localStorage.removeItem('strava_athlete_id'));
              }
            })(),
              (function () {
                const e = localStorage.getItem('ignitefitness_workouts');
                if (e)
                  try {
                    const t = JSON.parse(e);
                    (localStorage.setItem(
                      'ignitefitness_workout_data',
                      JSON.stringify({ workouts: t, version: '2.0', last_updated: Date.now() })
                    ),
                      localStorage.removeItem('ignitefitness_workouts'));
                  } catch (e) {}
              })());
          } catch (e) {}
        })(),
      localStorage.setItem('ignitefitness_data_version', '2.0'));
  }
  function f() {
    (document.getElementById('loginForm').classList.remove('hidden'),
      document.getElementById('userDashboard').classList.add('hidden'));
  }
  function y() {
    (document.getElementById('loginForm').classList.add('hidden'),
      document.getElementById('userDashboard').classList.remove('hidden'));
    const e = document.getElementById('currentAthleteName');
    e && s[o] && (e.textContent = s[o].athleteName || o);
  }
  function h() {
    if (!o || !s[o]) return;
    const e = s[o];
    if (
      (e.personalData &&
        (e.personalData.age && (document.getElementById('age').value = e.personalData.age),
        e.personalData.weight && (document.getElementById('weight').value = e.personalData.weight),
        e.personalData.height && (document.getElementById('height').value = e.personalData.height),
        e.personalData.experience &&
          (document.getElementById('experience').value = e.personalData.experience)),
      e.goals)
    ) {
      if (e.goals.primary) {
        const t = document.querySelector(`input[name="primaryGoal"][value="${e.goals.primary}"]`);
        t && (t.checked = !0);
      }
      if (e.goals.secondary) {
        const t = document.querySelector(
          `input[name="secondaryGoal"][value="${e.goals.secondary}"]`
        );
        t && (t.checked = !0);
      }
    }
  }
  function v() {
    const e = document.getElementById('syncStatus'),
      t = document.getElementById('lastSync');
    if (e && t) {
      const n = localStorage.getItem('ignitefitness_last_sync');
      if (n) {
        const o = new Date(parseInt(n));
        ((t.textContent = `Last sync: ${o.toLocaleString()}`), (e.textContent = '✅ Synced'));
      } else ((t.textContent = 'Last sync: Never'), (e.textContent = '🔄 Syncing...'));
    }
  }
  function x(e, t) {
    e && ((e.textContent = t), (e.style.display = 'block'));
  }
  if (
    (document.addEventListener('DOMContentLoaded', () => {
      g();
      const e = localStorage.getItem('ignitefitness_current_user');
      e && ((o = e), (a = !0));
      const t = localStorage.getItem('ignitefitness_users');
      if (t)
        try {
          s = JSON.parse(t);
        } catch (e) {
          s = {};
        }
      (!(async function () {
        try {
          (await (async function () {
            try {
              const e = await p('./modules/ai/ContextAwareAI.js', 'ContextAwareAI');
              r = e;
            } catch (e) {}
          })(),
            await (async function () {
              try {
                const e = await p('./modules/data/DataStore.js', 'DataStore');
                ((c = e), c.setCurrentUser(o));
              } catch (e) {}
            })(),
            await (async function () {
              try {
                const e = await p('./modules/workout/WorkoutGenerator.js', 'WorkoutGenerator');
                l = e;
              } catch (e) {}
            })(),
            await (async function () {
              try {
                const e = await p('./modules/ai/PatternDetector.js', 'PatternDetector');
                d = e;
              } catch (e) {}
            })());
        } catch (e) {
          x(null, 'Some features may not be available. Please refresh the page.');
        }
      })(),
        [
          { path: './modules/ai/ExpertCoordinator.js', className: 'ExpertCoordinator' },
          { path: './modules/ui/DashboardRenderer.js', className: 'DashboardRenderer' },
          { path: './modules/workout/WorkoutGenerator.js', className: 'WorkoutGenerator' },
        ].forEach(({ path: e, className: t }) => {
          p(e, t, { showLoading: !1 }).catch(e => {});
        }),
        (function () {
          const e = document.createElement('style');
          ((e.textContent =
            '\n        .workout-plan {\n            background: #f7fafc;\n            border: 1px solid #e2e8f0;\n            border-radius: 8px;\n            padding: 20px;\n            margin: 20px 0;\n        }\n        \n        .workout-info {\n            background: white;\n            padding: 15px;\n            border-radius: 6px;\n            margin: 15px 0;\n            border-left: 4px solid #4299e1;\n        }\n        \n        .workout-section {\n            margin: 20px 0;\n        }\n        \n        .workout-section h4 {\n            color: #2d3748;\n            margin-bottom: 10px;\n            padding-bottom: 5px;\n            border-bottom: 2px solid #e2e8f0;\n        }\n        \n        .exercises-list {\n            display: flex;\n            flex-direction: column;\n            gap: 15px;\n        }\n        \n        .exercise-item {\n            background: white;\n            border: 1px solid #e2e8f0;\n            border-radius: 6px;\n            padding: 15px;\n        }\n        \n        .exercise-item h5 {\n            margin: 0 0 10px 0;\n            color: #2d3748;\n        }\n        \n        .exercise-details {\n            display: flex;\n            flex-wrap: wrap;\n            gap: 15px;\n            margin: 10px 0;\n        }\n        \n        .exercise-details span {\n            background: #edf2f7;\n            padding: 4px 8px;\n            border-radius: 4px;\n            font-size: 14px;\n        }\n        \n        .exercise-notes {\n            margin: 10px 0 0 0;\n            font-style: italic;\n            color: #4a5568;\n            font-size: 14px;\n        }\n        \n        .workout-notes {\n            background: #fff5f5;\n            border: 1px solid #fed7d7;\n            border-radius: 6px;\n            padding: 15px;\n            margin: 15px 0;\n        }\n        \n        .workout-notes h4 {\n            color: #742a2a;\n            margin: 0 0 10px 0;\n        }\n        \n        .workout-notes p {\n            margin: 0;\n            color: #742a2a;\n        }\n    '),
            document.head.appendChild(e));
        })(),
        a && o
          ? (y(),
            h(),
            I(),
            _(),
            v(),
            (function () {
              var e;
              if (!o) return;
              const t = s[o],
                n = document.getElementById('recentWorkoutsList');
              if (!n) return;
              const a = (
                (null == t || null === (e = t.data) || void 0 === e ? void 0 : e.sessions) || []
              ).slice(0, 5);
              if (0 === a.length)
                return void (n.innerHTML =
                  '<p>No recent workouts found. Start your first workout!</p>');
              const r = a
                .map(e => {
                  var t;
                  const n = new Date(e.start_at).toLocaleDateString(),
                    o = e.duration || 'Unknown',
                    a = (null === (t = e.exercises) || void 0 === t ? void 0 : t.length) || 0;
                  return `\n            <div class="workout-item">\n                <div class="workout-info">\n                    <h6>${e.type || 'Workout'}</h6>\n                    <p>${n}</p>\n                </div>\n                <div class="workout-stats">\n                    <span>${o} min</span>\n                    <span>${a} exercises</span>\n                </div>\n            </div>\n        `;
                })
                .join('');
              n.innerHTML = r;
            })())
          : f());
      const n = document.getElementById('aiChatInput');
      n &&
        n.addEventListener('keypress', e => {
          'Enter' === e.key &&
            (function () {
              const e = document.getElementById('aiChatInput'),
                t = e.value.trim();
              if (!t) return;
              (b(t, 'user'),
                (e.value = ''),
                (function () {
                  const e = document.getElementById('aiChatMessages'),
                    t = document.createElement('div');
                  ((t.className = 'ai-chat-message ai'),
                    (t.id = 'typing-indicator'),
                    (t.textContent = 'AI Coach is thinking...'),
                    e.appendChild(t),
                    (e.scrollTop = e.scrollHeight));
                })(),
                r
                  ? r
                      .processUserInput(t)
                      .then(e => {
                        (E(), b(e, 'ai'));
                      })
                      .catch(e => {
                        (E(), b('Sorry, I encountered an error. Please try again.', 'ai'));
                      })
                  : (E(), b('AI system is not available. Please try again later.', 'ai')));
            })();
        });
    }),
    !document.getElementById('notification-styles'))
  ) {
    const e = document.createElement('style');
    ((e.id = 'notification-styles'),
      (e.textContent =
        '\n        @keyframes slideIn {\n            from { transform: translateX(100%); opacity: 0; }\n            to { transform: translateX(0); opacity: 1; }\n        }\n        .notification {\n            animation: slideIn 0.3s ease;\n        }\n        .loading-spinner {\n            display: inline-block;\n            width: 20px;\n            height: 20px;\n            border: 3px solid rgba(255,255,255,.3);\n            border-radius: 50%;\n            border-top-color: #fff;\n            animation: spin 1s ease-in-out infinite;\n        }\n        @keyframes spin {\n            to { transform: rotate(360deg); }\n        }\n        .loading-overlay {\n            position: fixed;\n            top: 0;\n            left: 0;\n            width: 100%;\n            height: 100%;\n            background: rgba(0,0,0,0.5);\n            display: flex;\n            justify-content: center;\n            align-items: center;\n            z-index: 10000;\n        }\n        .loading-content {\n            background: white;\n            padding: 30px;\n            border-radius: 10px;\n            text-align: center;\n            box-shadow: 0 4px 20px rgba(0,0,0,0.3);\n        }\n    '),
      document.head.appendChild(e));
  }
  function k() {
    const e = document.getElementById('loading-overlay');
    e && e.remove();
  }
  function w(e) {
    let t = document.getElementById('success-notification');
    (t ||
      ((t = document.createElement('div')),
      (t.id = 'success-notification'),
      (t.style.cssText =
        '\n            position: fixed;\n            top: 20px;\n            right: 20px;\n            background: #68d391;\n            color: white;\n            padding: 15px 20px;\n            border-radius: 5px;\n            z-index: 1000;\n            display: none;\n        '),
      document.body.appendChild(t)),
      (t.textContent = e),
      (t.style.display = 'block'),
      setTimeout(() => {
        t.style.display = 'none';
      }, 3e3));
  }
  function I() {
    if (!i) return;
    const e = i.getCurrentPhase(),
      t = document.getElementById('currentPhaseName'),
      n = document.getElementById('phaseProgress');
    if ((t && (t.textContent = e.details.name), n)) {
      const t = Math.round(100 * e.phaseProgress);
      n.textContent = `${t}% Complete`;
    }
  }
  function _() {
    const e = localStorage.getItem('strava_access_token'),
      t = localStorage.getItem('strava_refresh_token'),
      n = localStorage.getItem('strava_token_expires'),
      o = localStorage.getItem('strava_athlete_id'),
      a = document.getElementById('stravaStatus'),
      s = document.getElementById('stravaConnectBtn'),
      r = document.getElementById('stravaDisconnectBtn'),
      i = document.getElementById('stravaSyncBtn');
    if (!e || !t || !n)
      return (
        (a.className = 'device-status disconnected'),
        (a.innerHTML = '<p>❌ Not connected to Strava</p>'),
        (s.style.display = 'inline-block'),
        (r.style.display = 'none'),
        void (i.style.display = 'none')
      );
    const c = Date.now() / 1e3,
      l = parseInt(n);
    c >= l
      ? S()
      : ((a.className = 'device-status connected'),
        (a.innerHTML = `\n        <p>✅ Connected to Strava</p>\n        <div class="device-info">\n            <h5>Athlete ID: ${o || 'Unknown'}</h5>\n            <p>Token expires: ${new Date(1e3 * l).toLocaleString()}</p>\n        </div>\n    `),
        (s.style.display = 'none'),
        (r.style.display = 'inline-block'),
        (i.style.display = 'inline-block'));
  }
  async function S() {
    const e = localStorage.getItem('strava_refresh_token');
    if (e)
      try {
        const t = await fetch('/.netlify/functions/strava-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refresh_token', refreshToken: e }),
        });
        if (!t.ok) throw new Error('Token refresh failed');
        const n = await t.json();
        (localStorage.setItem('strava_access_token', n.access_token),
          localStorage.setItem('strava_refresh_token', n.refresh_token),
          localStorage.setItem('strava_token_expires', n.expires_at),
          _());
      } catch (e) {
        (localStorage.removeItem('strava_access_token'),
          localStorage.removeItem('strava_refresh_token'),
          localStorage.removeItem('strava_token_expires'),
          localStorage.removeItem('strava_athlete_id'),
          _(),
          w('Disconnected from Strava'));
      }
    else _();
  }
  function b(e, t) {
    const n = document.getElementById('aiChatMessages'),
      o = document.createElement('div');
    ((o.className = `ai-chat-message ${t}`),
      (o.textContent = e),
      n.appendChild(o),
      (n.scrollTop = n.scrollHeight));
  }
  function E() {
    const e = document.getElementById('typing-indicator');
    e && e.remove();
  }
})();
//# sourceMappingURL=main.02246904ae0508df6797.js.map
