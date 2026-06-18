// =============================================================
//  State
// =============================================================
let tasks = [];
let dailyTemplates = JSON.parse(localStorage.getItem('org_daily_templates')) || [];
let editingTaskId  = null;
let editingDailyId = null;
let currentView    = localStorage.getItem('org_app_view') || 'calendar';

let today = new Date();
today.setHours(0, 0, 0, 0);

// =============================================================
//  Midnight auto-refresh
//  Recalculates today and re-processes tasks when the day rolls over
// =============================================================
function scheduleMidnightRefresh() {
    const now  = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0, 0, 1, 0);   // 1 second past midnight to be safe
    const msUntilMidnight = next - now;

    setTimeout(() => {
        today = new Date();
        today.setHours(0, 0, 0, 0);
        load();
        processOldTasks();
        checkAndApplyDailyTemplates();
        applyView();
        scheduleMidnightRefresh();  // reschedule for the next day
    }, msUntilMidnight);
}

// =============================================================
//  Date helpers  (always work in local calendar dates)
// =============================================================
function toLocalISO(dateVal) {
    const d = (typeof dateVal === 'string') ? new Date(dateVal) : new Date(dateVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00.000`;
}

function toYMD(dateVal) {
    const d = (typeof dateVal === 'string') ? new Date(dateVal) : new Date(dateVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function midnightOf(dateVal) {
    const d = new Date(dateVal);
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysBetween(a, b) {
    return Math.round((midnightOf(b) - midnightOf(a)) / 86400000);
}

// =============================================================
//  Storage
// =============================================================
function save() { localStorage.setItem('org_app_tasks', JSON.stringify(tasks)); }

function load() {
    const raw = localStorage.getItem('org_app_tasks');
    if (raw) { tasks = JSON.parse(raw); return true; }
    return false;
}

// =============================================================
//  Export / Import
// =============================================================
function exportData() {
    const blob = new Blob([JSON.stringify({ tasks, dailyTemplates, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `org_backup_${toYMD(new Date())}.json`
    });
    a.click();
    URL.revokeObjectURL(a.href);
}

function importData() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!Array.isArray(data.tasks)) return alert('Invalid backup file.');
                if (!confirm(`Import ${data.tasks.length} tasks and ${(data.dailyTemplates||[]).length} templates?\nClick OK to MERGE.`)) return;
                const existing = new Set(tasks.map(t => t.id));
                const added = data.tasks.filter(t => !existing.has(t.id));
                tasks = [...tasks, ...added];

                let addedTemplates = 0;
                if (Array.isArray(data.dailyTemplates)) {
                    const seenTpl = new Set(dailyTemplates.map(t => t.id ?? t.title));
                    const newTpl  = data.dailyTemplates.filter(t => !seenTpl.has(t.id ?? t.title));
                    addedTemplates = newTpl.length;
                    dailyTemplates = [...dailyTemplates, ...newTpl];
                    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
                }

                save();
                processOldTasks();            // normalize any imported past-due tasks right away
                checkAndApplyDailyTemplates();
                applyView();
                alert(`Imported ${added.length} new tasks and ${addedTemplates} new routines.`);
            } catch { alert('Failed to parse backup file.'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

// =============================================================
//  Sidebar / View
// =============================================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const arrow   = document.getElementById('toggleIconArrow');
    sidebar.classList.toggle('open');
    arrow.setAttribute('points', sidebar.classList.contains('open') ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
}

function applyView() {
    const cal  = document.getElementById('calendar');
    const list = document.getElementById('list-view');
    const btn  = document.getElementById('viewToggleBtn');
    if (currentView === 'list') {
        cal.style.display  = 'none';
        list.style.display = 'block';
        if (btn) btn.innerText = 'Switch to Calendar View';
        renderListView();
    } else {
        cal.style.display  = 'grid';
        list.style.display = 'none';
        if (btn) btn.innerText = 'Switch to List View';
        renderCalendar();
    }
}

function toggleView() {
    currentView = currentView === 'calendar' ? 'list' : 'calendar';
    localStorage.setItem('org_app_view', currentView);
    applyView();
}

function toggleTaskActions() {
    document.body.classList.toggle('edit-mode');
    localStorage.setItem('org_app_edit_mode', document.body.classList.contains('edit-mode'));
}

// =============================================================
//  Task Modal
// =============================================================
function openModal(dateStr = null, taskId = null) {
    editingTaskId = taskId;

    const isEditing = !!taskId;
    document.getElementById('modalTitle').innerText  = isEditing ? 'Edit Task' : 'New Task';
    document.getElementById('saveTaskBtn').innerText = isEditing ? 'Update Task' : 'Add Task';

    if (isEditing) {
        const t = tasks.find(t => t.id === taskId);
        const displayCat = t.category === 'overdue' ? (t.originalCategory || 'default') : t.category;
        document.getElementById('taskTitle').value    = t.title;
        document.getElementById('taskCategory').value = displayCat;
        document.getElementById('taskDate').value     = toYMD(t.originalDate || t.date);
        document.getElementById('taskLink').value     = t.link || '';
        document.getElementById('taskPinned').checked = !!t.pinned;
        updateCategoryPreview(displayCat);
    } else {
        document.getElementById('taskTitle').value    = '';
        document.getElementById('taskCategory').value = 'default';
        document.getElementById('taskDate').value     = toYMD(dateStr || new Date());
        document.getElementById('taskLink').value     = '';
        document.getElementById('taskPinned').checked = false;
        updateCategoryPreview('default');
    }

    document.getElementById('taskModal').style.display = 'flex';
    setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
    editingTaskId = null;
}

function saveTask() {
    const title    = document.getElementById('taskTitle').value.trim();
    const category = document.getElementById('taskCategory').value;
    const dateVal  = document.getElementById('taskDate').value;
    const link     = document.getElementById('taskLink').value.trim();
    const pinned   = document.getElementById('taskPinned').checked;

    if (!title || !dateVal) return alert('Please enter a title and a date.');

    const formattedDate = toLocalISO(dateVal + 'T12:00:00');

    if (editingTaskId) {
        const idx = tasks.findIndex(t => t.id === editingTaskId);
        const old = tasks[idx];
        tasks[idx] = {
            ...old,
            title, category,
            originalCategory: category,
            date: formattedDate,
            originalDate: formattedDate,
            link: link || null,
            pinned
        };
        delete tasks[idx].daysOverdue;
    } else {
        tasks.push({
            id: Date.now() + Math.random(),
            date: formattedDate,
            originalDate: formattedDate,
            title, category,
            originalCategory: category,
            link: link || null,
            pinned,
            completed: false
        });
    }

    closeModal();
    save();
    applyView();
}

// =============================================================
//  Task Actions
// =============================================================
function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    applyView();
}

function completeTask(id) {
    const t = tasks.find(t => t.id === id);
    if (t) { t.completed = !t.completed; save(); applyView(); }
}

// =============================================================
//  Daily Templates Modal
// =============================================================
function openDailyModal() {
    editingDailyId = null;
    document.getElementById('dailyModal').style.display = 'flex';
    renderDailyTemplates();
    resetDailyForm();
}

function closeDailyModal() {
    document.getElementById('dailyModal').style.display = 'none';
    editingDailyId = null;
}

function resetDailyForm() {
    editingDailyId = null;
    document.getElementById('newDailyTitle').value    = '';
    document.getElementById('newDailyCategory').value = 'default';
    document.getElementById('newDailyLink').value     = '';
    document.getElementById('dailySaveBtn').innerText  = 'Add to Routine';
    document.getElementById('dailyCancelEdit').style.display = 'none';
}

function renderDailyTemplates() {
    const list = document.getElementById('dailyTemplateList');
    if (dailyTemplates.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;margin:0 0 8px;">No routines yet. Add one below.</p>';
        return;
    }
    list.innerHTML = dailyTemplates.map((t, i) => `
        <div class="daily-item" style="border-left-color: var(--cat-${t.category || 'default'})">
            <div class="daily-item-info">
                <span class="daily-item-title">${escapeHtml(t.title)}</span>
                ${safeUrl(t.link) ? `<a href="${escapeAttr(safeUrl(t.link))}" target="_blank" rel="noopener" class="task-link" title="Open link" onclick="event.stopPropagation()">🔗</a>` : ''}
            </div>
            <div class="daily-item-actions">
                <button class="btn-daily-edit" onclick="editDailyTemplate(${i})">✎</button>
                <button class="btn-daily-del"  onclick="removeDailyTemplate(${i})">✕</button>
            </div>
        </div>
    `).join('');
}

function editDailyTemplate(index) {
    const t = dailyTemplates[index];
    editingDailyId = index;
    document.getElementById('newDailyTitle').value    = t.title;
    document.getElementById('newDailyCategory').value = t.category || 'default';
    document.getElementById('newDailyLink').value     = t.link || '';
    document.getElementById('dailySaveBtn').innerText  = 'Update Routine';
    document.getElementById('dailyCancelEdit').style.display = 'inline-block';
    document.getElementById('newDailyTitle').focus();
}

function saveDailyTemplate() {
    const title    = document.getElementById('newDailyTitle').value.trim();
    const category = document.getElementById('newDailyCategory').value;
    const link     = document.getElementById('newDailyLink').value.trim();
    if (!title) return;

    if (editingDailyId !== null) {
        dailyTemplates[editingDailyId] = {
            ...dailyTemplates[editingDailyId],
            title, category, link: link || null
        };
    } else {
        dailyTemplates.push({ id: Date.now(), title, category, link: link || null });
    }

    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
    resetDailyForm();
    renderDailyTemplates();
    checkAndApplyDailyTemplates();
}

function removeDailyTemplate(index) {
    if (!confirm(`Remove "${dailyTemplates[index].title}" from daily routines?`)) return;
    dailyTemplates.splice(index, 1);
    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
    renderDailyTemplates();
}

// =============================================================
//  Daily Template Engine
// =============================================================
function checkAndApplyDailyTemplates() {
    const todayStr = toYMD(today);
    let updated = false;

    dailyTemplates.forEach(temp => {
        const instances = tasks.filter(t => t.isDailyTemplate &&
            (temp.id ? t.dailyTemplateId === temp.id : t.title === temp.title));

        const hasToday = instances.some(t => toYMD(t.originalDate || t.date) === todayStr);
        if (hasToday) return;

        const incomplete = instances
            .filter(t => !t.completed)
            .sort((a, b) => new Date(b.originalDate || b.date) - new Date(a.originalDate || a.date));

        if (incomplete.length > 0) {
            const carry        = incomplete[0];
            carry.date         = toLocalISO(todayStr + 'T12:00:00');
            carry.originalDate = toLocalISO(todayStr + 'T12:00:00');  // advance so a carried routine reads as "due today", not overdue
            carry.category     = carry.originalCategory || temp.category;
            carry.link         = temp.link || carry.link || null;
            delete carry.daysOverdue;
            updated = true;
        } else {
            tasks.push({
                id: Date.now() + Math.random(),
                dailyTemplateId: temp.id || null,
                date: toLocalISO(todayStr + 'T12:00:00'),
                originalDate: toLocalISO(todayStr + 'T12:00:00'),
                title: temp.title,
                category: temp.category || 'default',
                originalCategory: temp.category || 'default',
                link: temp.link || null,
                pinned: false,
                completed: false,
                isDailyTemplate: true
            });
            updated = true;
        }
    });

    if (updated) save();
}

// =============================================================
//  Process old tasks on load
// =============================================================
function processOldTasks() {
    const todayTime = today.getTime();

    // Remove completed tasks from past days
    tasks = tasks.filter(t => {
        const d = midnightOf(t.originalDate || t.date);
        return !(d < todayTime && t.completed);
    });

    tasks.forEach(t => {
        const origDate = midnightOf(t.originalDate || t.date);
        if (origDate < todayTime && !t.completed) {
            if (t.pinned) {
                t.date     = toLocalISO(toYMD(today) + 'T12:00:00');
                if (t.category !== 'pinned') t.originalCategory = t.originalCategory || t.category;
                t.category = 'pinned';
                delete t.daysOverdue;
            } else {
                t.daysOverdue = Math.round((todayTime - origDate) / 86400000);
                if (t.category !== 'overdue') t.originalCategory = t.category;
                t.category = 'overdue';
                t.date     = today.toISOString();
            }
        }
    });

    save();
}

// =============================================================
//  Render helpers
// =============================================================

/**
 * Builds the badge shown under a task title.
 * In calendar view: only show badge if <=7 days away (card position gives context).
 * In list view: always show days remaining so you have full context.
 */
function buildDeadlineBadge(task, forceShowDays = false) {
    if (task.category === 'pinned') return '<span class="pin-badge">📌 pinned</span>';
    if (task.daysOverdue) return `<span class="overdue-counter">${task.daysOverdue}d late</span>`;

    const daysLeft = daysBetween(today, midnightOf(task.originalDate || task.date));

    if (daysLeft < 0)  return `<div class="due-warning">Passed ${Math.abs(daysLeft)}d ago</div>`;
    if (daysLeft === 0) return `<div class="due-warning">Due TODAY</div>`;
    if (daysLeft <= 3)  return `<div class="due-warning">${daysLeft}d left</div>`;
    if (daysLeft <= 7)  return `<div class="due-badge">${daysLeft}d left</div>`;

    // > 7 days: calendar doesn't need a badge (card date is visible),
    // but list view always wants it for context
    if (forceShowDays) return `<div class="due-badge">${daysLeft}d left</div>`;
    return '';
}

function buildTaskElement(task, forceShowDays = false, isListView = false) {
    const el = document.createElement('div');
    el.className = `task-item ${task.completed ? 'completed' : ''} ${isListView ? 'list-view-item' : ''}`;
    el.setAttribute('data-category', task.category);
    el.onclick = e => {
        if (!e.target.matches('input[type=checkbox], .btn-delete-icon, .task-link')) {
            openModal(task.date, task.id);
        }
    };

    const badge   = buildDeadlineBadge(task, forceShowDays);
    const href    = safeUrl(task.link);
    const linkBtn = href
        ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener" class="task-link" onclick="event.stopPropagation()" title="Open link">🔗</a>`
        : '';

    const deleteSvg = `<button class="btn-delete-icon" onclick="event.stopPropagation();deleteTask(${task.id})" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>`;

    if (isListView) {
        el.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                   onclick="event.stopPropagation();completeTask(${task.id})">
            <span class="task-title list-title">${escapeHtml(task.title)}</span>
            ${badge ? `<span class="list-badge-wrap">${badge}</span>` : ''}
            <span style="flex:1;min-width:8px;"></span>
            ${linkBtn}
            <div class="task-actions">${deleteSvg}</div>`;
    } else {
        el.innerHTML = `
            <div style="display:flex;align-items:center;flex:1;min-width:0;">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                       onclick="event.stopPropagation();completeTask(${task.id})">
                <div class="task-content">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${badge}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                ${linkBtn}
                <div class="task-actions">${deleteSvg}</div>
            </div>`;
    }
    return el;
}

function renderTasksForDate(dateValue, containerId, forceShowDays = false, isListView = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const target   = midnightOf(dateValue).getTime();
    const dayTasks = tasks.filter(t => midnightOf(t.date).getTime() === target);
    dayTasks.forEach(task => container.appendChild(buildTaskElement(task, forceShowDays, isListView)));
}

// =============================================================
//  Calendar render
// =============================================================
function renderCalendar() {
    const calEl = document.getElementById('calendar');
    if (!calEl) return;
    calEl.innerHTML = '';

    for (let i = 0; i < 15; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const isToday = i === 0;

        const card = document.createElement('div');
        card.className = `day-card ${isToday ? 'today' : ''}`;

        if (!isToday) {
            card.title   = 'Click to add task';
            card.onclick = e => { if (!e.target.closest('.task-item')) openModal(d.toISOString()); };
        }

        const addBtn = isToday
            ? `<button class="btn-add" title="Add task for today" onclick="event.stopPropagation();openModal('${d.toISOString()}')">+</button>`
            : '';

        card.innerHTML = `
            <div class="day-header">
                <div>
                    <span class="date-number">${d.getDate()}</span>
                    <span class="date-label">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}</span>
                </div>
                ${addBtn}
            </div>
            <div class="task-list" id="list-${i}"></div>`;
        calEl.appendChild(card);
        renderTasksForDate(d.toISOString(), `list-${i}`, true);
    }
}

// =============================================================
//  List view render  (forceShowDays = true so >7d tasks show badge)
// =============================================================
function renderListView() {
    const container = document.getElementById('list-view');
    if (!container) return;
    container.innerHTML = '<h2 style="margin-top:0;">Full Task List</h2><div id="list-content"></div>';
    const content = document.getElementById('list-content');

    const timestamps = [...new Set(tasks.map(t => midnightOf(t.date).getTime()))].sort((a, b) => a - b);
    timestamps.forEach((ts, idx) => {
        const dateObj = new Date(ts);
        const section = document.createElement('div');
        section.className = 'list-section';
        section.innerHTML = `
            <div class="list-section-header">
                ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div id="list-group-${idx}" class="list-group-container"></div>`;
        content.appendChild(section);
        renderTasksForDate(ts, `list-group-${idx}`, true, true);
    });
}

// =============================================================
//  Misc
// =============================================================
function updateCategoryPreview(val) {
    const colors = {
        default:'grey', exam:'#ff4444', task:'#ff66b2',
        overdue:'#7a6a8a', game:'#ffa500', study:'#007bff', task_deadline:'#9370db'
    };
    const el = document.getElementById('categoryPreview');
    if (el) el.style.backgroundColor = colors[val] || 'grey';
}

function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(s) {
    return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Only allow http(s) links so a stored "javascript:"/"data:" value can't run when clicked.
// Scheme-less input is treated as https; returns null when nothing safe can be produced.
function safeUrl(url) {
    if (!url) return null;
    const s = String(url).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;            // already http(s)
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;  // some other scheme -> block
    return 'https://' + s;                            // no scheme -> assume https
}

window.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) { closeModal(); closeDailyModal(); }
});

// =============================================================
//  Boot
// =============================================================
load();
processOldTasks();
checkAndApplyDailyTemplates();
if (localStorage.getItem('org_app_edit_mode') === 'true') document.body.classList.add('edit-mode');
applyView();
scheduleMidnightRefresh();
