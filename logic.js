const STORAGE_KEY = 'caffeine-temperature-records';
const FORUM_KEY = 'caffeine-temperature-forum-posts';
const LIMITS = { child: 80, teen: 100, adult: 400, senior: 300 };
let DRINKS = { coffee: ['커피', '☕'], americano: ['아메리카노', '☕'], energy: ['에너지음료', '⚡'], tea: ['차', '🍵'], cola: ['콜라', '🥤'], chocolate: ['초콜릿 음료', '🍫'], other: ['기타', '◌'] };
const PROFILE_KEY = 'caffeine-temperature-profile';
const ACCOUNTS_KEY = 'caffeine-temperature-accounts';
const SETTINGS_KEY = 'caffeine-temperature-settings';
const TONE_KEY = 'caffeine-temperature-tone';
const HALF_LIFE = 5;
const SWAPS = [['루이보스 티', '🌿', '카페인 0mg · 부드러운 단맛'], ['캐모마일', '🌼', '카페인 0mg · 잠들기 전 편안함'], ['디카페인 라떼', '🥛', '카페인 약 5mg · 커피의 풍미']];
let profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
let accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"sleepTime":"23:00","pregnancy":false}');
let tone = localStorage.getItem(TONE_KEY) || 'warm';
let authMode = 'login';
const $ = selector => document.querySelector(selector);

const saveProfile = () => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
const saveAccounts = () => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
const currentAge = () => Number(profile?.age || $('#ageInput').value || 32);
const currentWeight = () => Number(profile?.weight || 60);
const getLimit = () => { const age = currentAge(); if (settings.pregnancy) return 300; if (age <= 18) return Math.max(20, Math.round(currentWeight() * 2.5)); if (age >= 65) return Math.min(400, Math.round(currentWeight() * 5)); return 400; };
function baselineInfo() {
  const days = Array.from({ length: 7 }, (_, offset) => { const day = new Date(); day.setDate(day.getDate() - offset); return dateKey(day.toISOString().slice(0, 10)); });
  const observed = new Set(records.filter(record => days.includes(record.date)).map(record => record.date));
  if (observed.size >= 3) return { amount: Math.round(days.reduce((sum, day) => sum + totalForDate(day), 0) / 7), source: 'recent' };
  if (profile && Number.isFinite(Number(profile.baselineDailyMg))) return { amount: Number(profile.baselineDailyMg), source: 'survey' };
  return { amount: null, source: 'missing' };
}
function toleranceLevel() {
  const baseline = baselineInfo().amount;
  if (baseline === null) return 'normal';
  if (baseline <= 100) return 'sensitive';
  return baseline > getLimit() ? 'high' : 'normal';
}
function getDynamicLimit() {
  const standard = getLimit(); const baseline = baselineInfo().amount; const tolerance = toleranceLevel();
  if (baseline === null || tolerance === 'normal') return standard;
  if (tolerance === 'sensitive') return Math.round(standard * .7);
  if (!profile.detoxStartDate) { profile.detoxStartDate = new Date().toISOString().slice(0, 10); saveProfile(); saveCurrentAccount(); }
  const elapsedDays = Math.max(0, Math.floor((new Date(`${isoToday}T12:00:00`) - new Date(`${profile.detoxStartDate}T12:00:00`)) / 86400000));
  const completedWeeks = Math.floor(elapsedDays / 7);
  return Math.max(standard, Math.round(baseline * Math.pow(.9, completedWeeks + 1)));
}
function getSleepThreshold() { return { sensitive: 20, normal: 50, high: 80 }[toleranceLevel()]; }
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
const toneMessages = {
  warm: {
    empty: '첫 기록부터 천천히 남겨볼까요? 오늘의 몸 상태를 살피는 좋은 시작이에요.',
    safe: remaining => `잘하고 있어요. ${remaining}mg의 여유가 있으니 오늘도 편안하게 기록해 보세요.`,
    over: excess => `괜찮아요. 오늘은 ${excess}mg 넘었으니 이제 몸에게 잠깐 쉴 시간을 선물해 주세요.`
  },
  normal: {
    empty: '섭취한 음료를 아래에 추가하면 현재 상태를 확인할 수 있습니다.',
    safe: remaining => `현재 권장량 이내입니다. ${remaining}mg의 여유가 있습니다.`,
    over: excess => `오늘 권장량을 ${excess}mg 초과했습니다. 추가 섭취를 줄이는 것이 좋습니다.`
  },
  direct: {
    empty: '기록도 안 하고 괜찮다고 생각하지 마세요. 마신 것부터 입력하세요.',
    safe: remaining => `아직 ${remaining}mg 남았습니다. 선을 넘기 전에 멈출 줄 아세요.`,
    over: excess => `${excess}mg나 초과했습니다. 이제 커피 핑계는 그만하고 오늘은 끝내세요.`
  },
  swear: {
    empty: '뭘 마셨는지부터 적어. 기록 안 하면 관리도 못 해.',
    safe: remaining => `아직 ${remaining}mg 여유 있어. 괜히 더 들이붓고 망치지 마.`,
    over: excess => `${excess}mg 초과야. 이쯤 했으면 카페인 좀 그만 처먹고 물이나 마셔.`
  }
};

function renderProfileDefaults() {
  $('#ageInput').value = currentAge();
  $('#profileAgeInput').value = profile?.age || '';
  $('#heightInput').value = profile?.height || '';
  $('#weightInput').value = profile?.weight || '';
  $('#baselineInput').value = profile?.baselineDailyMg ?? '';
  $('#nameInput').value = profile?.name || '';
  $('#emailInput').value = profile?.email || '';
  $('#sleepTimeInput').value = settings.sleepTime;
  $('#pregnancyInput').checked = settings.pregnancy;
  $('#toneSelect').value = tone;
  $('#logoutButton').classList.toggle('hidden', !profile);
  setAuthMode(profile ? 'signup' : authMode);
}

function setAuthMode(mode) {
  authMode = mode;
  $('#recoveryPanel').classList.add('hidden');
  $('#authTabs').classList.remove('hidden');
  $('#authCopy').classList.remove('hidden');
  $('#authForm').classList.remove('hidden');
  const signup = mode === 'signup';
  $('#authTitle').textContent = signup ? '회원가입' : '로그인';
  $('#authCopy').textContent = signup ? '프로필 정보를 입력하면 나만의 권장량과 기록을 저장할 수 있어요.' : '가입한 이메일과 비밀번호를 입력하면 이전 기록을 불러옵니다.';
  $('#authSubmitText').textContent = signup ? '회원가입하고 시작하기' : '로그인하고 기록 불러오기';
  document.querySelectorAll('.signup-field').forEach(field => { field.classList.toggle('hidden', !signup); field.querySelectorAll('input').forEach(input => { input.required = signup; }); });
  $('#loginModeButton').classList.toggle('active', !signup);
  $('#signupModeButton').classList.toggle('active', signup);
  $('#authMessage').textContent = '';
}

function setRecoveryMode(mode) {
  const findEmail = mode === 'find';
  $('#findEmailForm').classList.toggle('hidden', !findEmail);
  $('#resetPasswordForm').classList.toggle('hidden', findEmail);
  $('#findEmailMode').classList.toggle('active', findEmail);
  $('#resetPasswordMode').classList.toggle('active', !findEmail);
  $('#recoveryMessage').textContent = '';
  $('#recoveryMessage').className = 'auth-message';
}

function parseCsv(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map(line => { const cells = []; let cell = ''; let quoted = false; for (const character of line) { if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { cells.push(cell.trim()); cell = ''; } else cell += character; } cells.push(cell.trim()); return cells; });
}
function loadCsv(file) {
  const reader = new FileReader(); reader.onload = () => { const rows = parseCsv(String(reader.result)); if (rows.length < 2) { $('#csvStatus').textContent = 'CSV에 데이터 행이 없습니다.'; return; } const headers = rows[0].map(header => header.toLowerCase().replace(/\s/g, '')); const nameIndex = headers.findIndex(header => /식품명|음료명|name|food/.test(header)); const caffeineIndex = headers.findIndex(header => /caffeine.*(mg)?per?100|카페인.*100|카페인/.test(header)); if (nameIndex < 0 || caffeineIndex < 0) { $('#csvStatus').textContent = '식품명과 caffeine_mg_per100 컬럼을 찾지 못했어요.'; return; } const imported = rows.slice(1).map(row => ({ name: row[nameIndex], mgPer100: Number(String(row[caffeineIndex]).replace(/[^\d.]/g, '')) })).filter(item => item.name && Number.isFinite(item.mgPer100)); if (!imported.length) { $('#csvStatus').textContent = '읽을 수 있는 음료 데이터가 없습니다.'; return; } imported.forEach((item, index) => { const key = `csv-${Date.now()}-${index}`; DRINKS[key] = [item.name, '◌', item.mgPer100]; const option = document.createElement('option'); option.value = key; option.textContent = `${item.name} · ${item.mgPer100}mg/100ml`; $('#drinkInput').appendChild(option); }); $('#csvStatus').textContent = `${imported.length}개 음료를 추가했어요. 선택하면 용량에 맞춰 카페인이 계산됩니다.`; }; reader.readAsText(file, 'UTF-8');
}
function updateCaffeineFromDrink() { const item = DRINKS[$('#drinkInput').value]; if (item?.[2] && Number($('#volumeInput').value)) $('#mgInput').value = Math.round(item[2] * Number($('#volumeInput').value) / 100); }

function renderRecommendations() {
  const total = totalForDate(isoToday); const limit = getDynamicLimit(); const sleepTime = sleepMinutes(settings.sleepTime); const remaining = recordsForDate(isoToday).reduce((sum, record) => { const elapsed = Math.max(0, (sleepTime - sleepMinutes(record.time)) / 60); return sum + record.mg * Math.pow(0.5, elapsed / HALF_LIFE); }, 0); const concern = total >= limit * .8 || remaining > getSleepThreshold();
  $('#recommendationTitle').textContent = concern ? '지금은 가벼운 음료가 좋아요' : '오늘의 가벼운 선택'; $('#recommendationText').textContent = concern ? '카페인 부담 없이 기분 전환할 수 있는 음료를 골라봤어요.' : '아직 여유가 있어요. 그래도 늦은 시간에는 무카페인을 추천해요.';
  $('#recommendationList').innerHTML = SWAPS.map(([name, icon, detail]) => `<div class="swap-item"><span class="swap-icon">${icon}</span><span><strong>${name}</strong><small>${detail}</small></span><span class="swap-arrow">→</span></div>`).join('');
}

const today = new Date();
const dateKey = date => new Date(date + 'T12:00:00').toISOString().slice(0, 10);
const formatDate = date => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(date + 'T12:00:00'));
const formatShortDate = date => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(date + 'T12:00:00'));
const isoToday = dateKey(today.toISOString().slice(0, 10));
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let forumPosts = JSON.parse(localStorage.getItem(FORUM_KEY) || '[]');
let activePeriod = 'week';
if (profile?.email) {
  const accountKey = profile.email.toLowerCase();
  if (!accounts[accountKey]) { accounts[accountKey] = { profile, password: null, records }; saveAccounts(); }
  else { profile = accounts[accountKey].profile; records = accounts[accountKey].records || []; }
}
const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); if (profile?.email) { const accountKey = profile.email.toLowerCase(); accounts[accountKey] = { ...accounts[accountKey], profile, records }; saveAccounts(); } };
const saveCurrentAccount = () => { if (!profile?.email) return; const accountKey = profile.email.toLowerCase(); accounts[accountKey] = { ...accounts[accountKey], profile, records }; saveAccounts(); localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); };
const saveForumPosts = () => localStorage.setItem(FORUM_KEY, JSON.stringify(forumPosts));
const recordsForDate = date => records.filter(record => record.date === date);
const totalForDate = date => recordsForDate(date).reduce((sum, record) => sum + record.mg, 0);
const latestAge = date => { const match = recordsForDate(date).at(-1); return match ? match.age : currentAge(); };

function renderHeader() {
  $('#headerDate').textContent = formatDate(isoToday);
  $('#todayHeading').textContent = formatShortDate(isoToday);
  $('#todayPill').textContent = formatDate(isoToday);
  $('#profileName').textContent = profile ? profile.name : '로그인';
  $('#profileAvatar').textContent = profile ? profile.name.slice(0, 1).toUpperCase() : '?';
}
function renderFormLimit() { $('#formLimit').textContent = `${getDynamicLimit()} mg`; }
function renderToday() {
  const total = totalForDate(isoToday);
  const limit = getDynamicLimit();
  const standardLimit = getLimit();
  const baseline = baselineInfo();
  const tolerance = toleranceLevel();
  const percent = Math.min((total / limit) * 100, 100);
  const over = total > limit;
  $('#heroMg').textContent = total;
  $('#todayTotal').textContent = total;
  $('#todayLimit').textContent = limit;
  const detoxWeek = tolerance === 'high' ? Math.floor(Math.max(0, new Date(`${isoToday}T12:00:00`) - new Date(`${profile.detoxStartDate}T12:00:00`)) / 604800000) + 1 : 0;
  $('#standardLimitText').textContent = tolerance === 'high' ? `안전 상한 ${standardLimit}mg · 감량 ${detoxWeek}주차 목표` : tolerance === 'sensitive' ? `표준 상한 ${standardLimit}mg에서 30% 낮춘 목표` : `일반 기준 상한 ${standardLimit}mg`;
  $('#toleranceBadge').textContent = { sensitive: '민감', normal: '보통', high: '내성 강함' }[tolerance];
  $('#toleranceBadge').className = `tolerance-badge ${tolerance}`;
  $('#baselineText').textContent = baseline.amount === null ? '기초 섭취량 미입력' : `기초 섭취량 ${baseline.amount}mg/일${baseline.source === 'recent' ? ' · 최근 7일' : ' · 설문'}`;
  $('#gauge').style.background = `conic-gradient(${over ? 'var(--coral)' : 'var(--mint-deep)'} ${Math.min((total / limit) * 360, 360)}deg, #edf1eb 0deg)`;
  $('#progressFill').style.width = `${percent}%`;
  $('#progressFill').classList.toggle('over', over);
  $('#progressCaption').textContent = over ? `오늘 목표보다 ${total - limit} mg 많아요` : `오늘 맞춤 목표까지 ${limit - total} mg 남음`;
  const badge = $('#todayStatus');
  badge.className = `status-badge ${over ? 'warning' : 'safe'}`;
  badge.textContent = total === 0 ? '기록을 시작해 보세요' : over ? '오늘 목표를 넘었어요' : '오늘 목표 안쪽이에요';
  const messages = toneMessages[tone] || toneMessages.warm;
  $('#todayStatusText').textContent = total === 0 ? messages.empty : over ? messages.over(total - limit) : messages.safe(limit - total);
  renderIntakeList();
}
function renderIntakeList() {
  const list = $('#intakeList');
  const todayRecords = recordsForDate(isoToday);
  if (!todayRecords.length) { list.innerHTML = '<div class="empty-state"><strong>아직 오늘 기록이 없어요</strong>첫 음료부터 차근차근 남겨보세요.</div>'; return; }
  list.innerHTML = todayRecords.map(record => { const [name, icon] = DRINKS[record.drink] || DRINKS.other; return `<div class="intake-item"><div class="drink-info"><span class="drink-icon">${icon}</span><div><span class="drink-name">${name}</span><span class="drink-meta">${record.volume || '-'}ml · ${record.time || '시간 미상'} · ${record.memo || '오늘의 카페인'}</span></div></div><div class="drink-amount"><strong>${record.mg} mg</strong><button class="delete-button" data-id="${record.id}" aria-label="${name} 기록 삭제">×</button></div></div>`; }).join('');
  list.querySelectorAll('.delete-button').forEach(button => button.addEventListener('click', () => { records = records.filter(record => record.id !== button.dataset.id); save(); renderAll(); }));
}
function getPeriodDays(period) { const count = period === 'week' ? 7 : period === 'month' ? 30 : 12; return Array.from({ length: count }, (_, index) => { const date = new Date(today); if (period === 'year') date.setMonth(today.getMonth() - (count - 1 - index)); else date.setDate(today.getDate() - (count - 1 - index)); return dateKey(date.toISOString().slice(0, 10)); }); }
function renderChart() {
  const dates = getPeriodDays(activePeriod);
  const values = dates.map(date => totalForDate(date));
  const limit = getDynamicLimit(); const average = Math.round(values.reduce((sum, value) => sum + value, 0) / dates.length);
  $('#chartAverage').innerHTML = `${average} <small>mg</small>`;
  $('#chartRangeLabel').textContent = activePeriod === 'week' ? '최근 7일 평균' : activePeriod === 'month' ? '최근 30일 평균' : '올해 월 평균';
  $('#chartMessage').textContent = average === 0 ? '기록이 쌓이면 나만의 패턴이 보여요.' : average > limit ? '평균 섭취량이 기준보다 높아요.' : '평균적으로 건강한 범위에 머물고 있어요.';
  const max = Math.max(limit, ...values, 1);
  $('#barChart').innerHTML = dates.map((date, index) => { const value = values[index]; const label = activePeriod === 'year' ? `${new Date(date + 'T12:00:00').getMonth() + 1}월` : new Date(date + 'T12:00:00').getDate() + '일'; const isToday = date === isoToday; return `<div class="bar-column"><span class="bar-value">${value || ''}</span><div class="bar ${isToday ? 'today' : ''} ${value > limit ? 'over' : ''}" style="height:${Math.max((value / max) * 125, value ? 4 : 2)}px" title="${formatShortDate(date)}: ${value}mg"></div><span class="bar-label">${label}</span></div>`; }).join('');
}
function sleepMinutes(time) { if (!time || !time.includes(':')) return 12 * 60; const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; }
function renderTimeline() {
  const sleepTime = settings.sleepTime; const todayRecords = recordsForDate(isoToday); const threshold = getSleepThreshold(); $('#timelineSleepTime').textContent = `오늘 ${sleepTime} 수면 목표`; $('#sleepThresholdText').textContent = `${threshold}mg`;
  if (!todayRecords.length) { $('#timelineChart').innerHTML = '<div class="timeline-empty">오늘 섭취 기록을 입력하면<br>시간에 따른 잔여 카페인을 보여드려요.</div>'; $('#sleepRemaining').textContent = '수면 시점 잔여량 -'; $('#sleepWarningPill').textContent = '기록을 기다리는 중'; $('#sleepWarningPill').className = 'sleep-pill'; return; }
  const sleep = sleepMinutes(sleepTime);
  const start = Math.min(...todayRecords.map(record => sleepMinutes(record.time))); const end = Math.max(sleep, start + 60); const points = Array.from({ length: 9 }, (_, index) => start + ((end - start) * index / 8));
  const values = points.map(point => todayRecords.reduce((sum, record) => { const elapsed = Math.max(0, (point - sleepMinutes(record.time)) / 60); return sum + record.mg * Math.pow(0.5, elapsed / HALF_LIFE); }, 0)); const finalValue = values.at(-1); const warning = finalValue > threshold; const max = Math.max(...values, threshold, 1); const chartWidth = 560; const chartHeight = 140; const line = values.map((value, index) => `${(index / 8) * chartWidth},${chartHeight - (value / max) * 112 - 10}`).join(' '); const area = `0,${chartHeight} ${line} ${chartWidth},${chartHeight}`;
  $('#timelineChart').innerHTML = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" role="img" aria-label="시간별 잔여 카페인 그래프"><line class="threshold-line" x1="0" y1="${chartHeight - (threshold / max) * 112 - 10}" x2="${chartWidth}" y2="${chartHeight - (threshold / max) * 112 - 10}"></line><polygon class="area-shape" points="${area}"></polygon><polyline class="timeline-line" points="${line}"></polyline>${values.map((value, index) => `<circle class="timeline-point" cx="${(index / 8) * chartWidth}" cy="${chartHeight - (value / max) * 112 - 10}" r="3"></circle>`).join('')}</svg><div class="timeline-axis"><span>${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}</span><span>수면 ${sleepTime}</span></div>`;
  $('#sleepRemaining').textContent = `수면 시점 잔여량 ${Math.round(finalValue)}mg`; $('#sleepWarningPill').textContent = warning ? '숙면 주의' : '숙면에 가까워요'; $('#sleepWarningPill').className = `sleep-pill ${warning ? 'warning' : 'safe'}`;
}
function renderChallenge() { let streak = 0; const cursor = new Date(today); while (recordsForDate(dateKey(cursor.toISOString().slice(0, 10))).length && totalForDate(dateKey(cursor.toISOString().slice(0, 10))) <= getDynamicLimit()) { streak += 1; cursor.setDate(cursor.getDate() - 1); } $('#streakCount').textContent = streak; $('#streakProgress').style.width = `${Math.min((streak / 7) * 100, 100)}%`; $('#streakMessage').textContent = streak >= 7 ? '일주일 성공! 건강한 습관이 자리 잡고 있어요.' : `맞춤 목표 기준 7일 성공까지 ${7 - streak}일 남았어요.`; const badges = [['첫 기록', streak >= 1], ['3일 리듬', streak >= 3], ['일주일 챔피언', streak >= 7]]; $('#badges').innerHTML = badges.map(([label, active]) => `<span class="challenge-badge ${active ? 'earned' : ''}">${active ? '✓' : '○'} ${label}</span>`).join(''); }
function renderForum() {
  const signedIn = Boolean(profile?.email);
  $('#postTitle').disabled = !signedIn; $('#postBody').disabled = !signedIn; $('#postSubmit').disabled = !signedIn;
  $('#forumAuthHint').textContent = signedIn ? `${profile.name}님으로 로그인 중` : '글 작성과 댓글은 로그인 후 이용할 수 있어요.';
  $('#forumCount').textContent = `게시글 ${forumPosts.length}`;
  const list = $('#forumList'); list.replaceChildren();
  if (!forumPosts.length) { const empty = document.createElement('p'); empty.className = 'forum-empty'; empty.textContent = '아직 게시글이 없어요. 첫 이야기를 남겨보세요.'; list.appendChild(empty); return; }
  [...forumPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(post => {
    const article = document.createElement('article'); article.className = 'forum-post';
    const header = document.createElement('div'); header.className = 'forum-post-header';
    const authorBlock = document.createElement('div'); authorBlock.className = 'forum-author';
    const author = document.createElement('strong'); author.textContent = post.authorName;
    const time = document.createElement('time'); time.dateTime = post.createdAt; time.textContent = new Date(post.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
    authorBlock.append(author, time); header.appendChild(authorBlock);
    if (signedIn && post.authorEmail === profile.email.toLowerCase()) { const remove = document.createElement('button'); remove.className = 'forum-delete'; remove.type = 'button'; remove.textContent = '삭제'; remove.addEventListener('click', () => { forumPosts = forumPosts.filter(item => item.id !== post.id); saveForumPosts(); renderForum(); }); header.appendChild(remove); }
    const title = document.createElement('h3'); title.textContent = post.title;
    const body = document.createElement('p'); body.className = 'forum-post-body'; body.textContent = post.body;
    article.append(header, title, body);
    const comments = document.createElement('div'); comments.className = 'forum-comments';
    (post.comments || []).forEach(comment => { const row = document.createElement('p'); row.className = 'forum-comment'; const name = document.createElement('strong'); name.textContent = comment.authorName; const text = document.createElement('span'); text.textContent = comment.body; row.append(name, text); comments.appendChild(row); });
    if (signedIn) { const form = document.createElement('form'); form.className = 'forum-comment-form'; const input = document.createElement('input'); input.type = 'text'; input.maxLength = 500; input.placeholder = '댓글을 남겨보세요'; input.required = true; const button = document.createElement('button'); button.type = 'submit'; button.textContent = '댓글'; form.append(input, button); form.addEventListener('submit', event => { event.preventDefault(); const commentBody = input.value.trim(); if (!commentBody) return; const target = forumPosts.find(item => item.id === post.id); target.comments = target.comments || []; target.comments.push({ authorName: profile.name, authorEmail: profile.email.toLowerCase(), body: commentBody, createdAt: new Date().toISOString() }); saveForumPosts(); renderForum(); }); comments.appendChild(form); }
    article.appendChild(comments); list.appendChild(article);
  });
}
function renderAll() { renderHeader(); renderProfileDefaults(); renderFormLimit(); renderToday(); renderChart(); renderTimeline(); renderRecommendations(); renderChallenge(); renderForum(); }

$('#profileTrigger').addEventListener('click', () => { setAuthMode(profile ? 'signup' : 'login'); $('#authModal').classList.remove('hidden'); }); $('#authClose').addEventListener('click', () => $('#authModal').classList.add('hidden'));
$('#loginModeButton').addEventListener('click', () => setAuthMode('login')); $('#signupModeButton').addEventListener('click', () => setAuthMode('signup'));
$('#recoveryOpen').addEventListener('click', () => { $('#authTitle').textContent = '계정 복구'; $('#authTabs').classList.add('hidden'); $('#authCopy').classList.add('hidden'); $('#authForm').classList.add('hidden'); $('#recoveryPanel').classList.remove('hidden'); setRecoveryMode('find'); });
$('#recoveryClose').addEventListener('click', () => setAuthMode('login'));
$('#findEmailMode').addEventListener('click', () => setRecoveryMode('find'));
$('#resetPasswordMode').addEventListener('click', () => setRecoveryMode('reset'));
$('#findEmailForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#findName').value.trim().toLocaleLowerCase(); const age = Number($('#findAge').value);
  const matches = Object.entries(accounts).filter(([, account]) => account.profile?.name?.trim().toLocaleLowerCase() === name && Number(account.profile.age) === age).map(([email]) => email);
  $('#recoveryMessage').textContent = matches.length ? `가입된 아이디: ${matches.join(', ')}` : '일치하는 계정을 찾지 못했어요. 가입한 이름과 나이를 확인해 주세요.';
  $('#recoveryMessage').className = `auth-message ${matches.length ? '' : 'error'}`;
});
$('#resetPasswordForm').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('#resetEmail').value.trim().toLowerCase(); const account = accounts[email];
  const identityMatches = account && account.profile?.name?.trim().toLocaleLowerCase() === $('#resetName').value.trim().toLocaleLowerCase() && Number(account.profile.age) === Number($('#resetAge').value);
  if (!identityMatches) { $('#recoveryMessage').textContent = '계정 정보가 일치하지 않습니다.'; $('#recoveryMessage').className = 'auth-message error'; return; }
  account.password = $('#newPassword').value; saveAccounts();
  $('#recoveryMessage').textContent = '비밀번호를 변경했어요. 로그인 화면에서 새 비밀번호로 로그인해 주세요.'; $('#recoveryMessage').className = 'auth-message';
  $('#resetPasswordForm').reset();
});
$('#authForm').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('#emailInput').value.trim().toLowerCase();
  const password = $('#passwordInput').value;
  const existing = accounts[email];
  if (authMode === 'login' && !existing) { $('#authMessage').textContent = '가입된 계정을 찾지 못했어요. 회원가입을 먼저 진행해 주세요.'; $('#authMessage').className = 'auth-message error'; return; }
  if (existing && existing.password && existing.password !== password) { $('#authMessage').textContent = '비밀번호가 맞지 않습니다.'; $('#authMessage').className = 'auth-message error'; return; }
  if (authMode === 'login' && existing) {
    profile = existing.profile;
    records = existing.records || [];
    existing.password = existing.password || password;
    saveAccounts();
    saveProfile();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    $('#authMessage').textContent = '이전 기록을 불러왔어요.';
  } else {
    if (!$('#nameInput').value.trim() || !$('#profileAgeInput').value || !$('#heightInput').value || !$('#weightInput').value || $('#baselineInput').value === '') { $('#authMessage').textContent = '회원가입 정보와 평소 하루 섭취량을 입력해 주세요.'; $('#authMessage').className = 'auth-message error'; return; }
    if (existing) { $('#authMessage').textContent = '이미 가입된 이메일입니다. 로그인 탭을 이용해 주세요.'; $('#authMessage').className = 'auth-message error'; return; }
    profile = { name: $('#nameInput').value.trim(), email, age: Number($('#profileAgeInput').value), height: Number($('#heightInput').value), weight: Number($('#weightInput').value), baselineDailyMg: Number($('#baselineInput').value), detoxStartDate: isoToday };
    accounts[email] = { profile, password, records };
    saveProfile(); saveAccounts();
    $('#authMessage').textContent = '회원가입이 완료됐어요.';
  }
  $('#authModal').classList.add('hidden'); renderAll();
});
$('#logoutButton').addEventListener('click', () => { saveCurrentAccount(); profile = null; records = []; localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(STORAGE_KEY); setAuthMode('login'); $('#authModal').classList.add('hidden'); renderAll(); });
$('#ageInput').addEventListener('input', renderFormLimit); $('#sleepTimeInput').addEventListener('change', () => { settings.sleepTime = $('#sleepTimeInput').value; saveSettings(); renderAll(); }); $('#pregnancyInput').addEventListener('change', () => { settings.pregnancy = $('#pregnancyInput').checked; saveSettings(); renderAll(); });
$('#toneSelect').addEventListener('change', event => { tone = event.target.value; localStorage.setItem(TONE_KEY, tone); renderToday(); });
$('#drinkInput').addEventListener('change', updateCaffeineFromDrink); $('#volumeInput').addEventListener('input', updateCaffeineFromDrink);
$('#intakeForm').addEventListener('submit', event => { event.preventDefault(); const date = $('#dateInput').value; const age = Number($('#ageInput').value); const mg = Number($('#mgInput').value); const volume = Number($('#volumeInput').value); const time = $('#timeInput').value; if (!date || !age || !volume || !time || mg < 0) return; records.push({ id: uid(), date, age, mg, volume, time, drink: $('#drinkInput').value, memo: $('#memoInput').value.trim() }); save(); $('#mgInput').value = ''; $('#memoInput').value = ''; $('#dateInput').value = isoToday; renderAll(); });
$('#postForm').addEventListener('submit', event => { event.preventDefault(); if (!profile?.email) return; const title = $('#postTitle').value.trim(); const body = $('#postBody').value.trim(); if (!title || !body) return; forumPosts.push({ id: uid(), title, body, authorName: profile.name, authorEmail: profile.email.toLowerCase(), createdAt: new Date().toISOString(), comments: [] }); saveForumPosts(); $('#postForm').reset(); renderForum(); });
document.querySelectorAll('.segmented button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.segmented button').forEach(item => item.classList.remove('active')); button.classList.add('active'); activePeriod = button.dataset.period; renderChart(); }));
$('#dateInput').value = isoToday; renderAll();
