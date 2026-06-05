// --- State Management ---
let tasks = [];
let dailyTemplates = JSON.parse(localStorage.getItem('org_daily_templates')) || [];
let selectedDateForNewTask = null;
let editingTaskId = null;
let currentView = localStorage.getItem('org_app_view') || 'calendar';
let today = new Date();
today.setHours(0, 0, 0, 0);

// --- Helpers ---
function toLocalMidnightISO(dateVal) {
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000Z`;
}

function getLocalYYYYMMDD(dateVal) {
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysBetween(dateA, dateB) {
    const a = new Date(dateA); a.setHours(0,0,0,0);
    const b = new Date(dateB); b.setHours(0,0,0,0);
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// --- Storage ---
function saveToLocalStorage() {
    localStorage.setItem('org_app_tasks', JSON.stringify(tasks));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('org_app_tasks');
    if (savedData) {
        tasks = JSON.parse(savedData);
        return true;
    }
    return false;
}

// --- Export / Import ---
function exportData() {
    const payload = {
        tasks,
        dailyTemplates,
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org_backup_${getLocalYYYYMMDD(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.tasks || !Array.isArray(data.tasks)) {
                    return alert('Invalid backup file: missing tasks array.');
                }
                const merge = confirm(
                    `Import ${data.tasks.length} tasks and ${(data.dailyTemplates||[]).length} daily templates?\n\nClick OK to MERGE with existing data, or Cancel to abort.`
                );
                if (!merge) return;

                // Merge: avoid duplicate IDs
                const existingIds = new Set(tasks.map(t => t.id));
                const newTasks = data.tasks.filter(t => !existingIds.has(t.id));
                tasks = [...tasks, ...newTasks];

                if (data.dailyTemplates) {
                    dailyTemplates = data.dailyTemplates;
                    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
                }

                saveToLocalStorage();
                applyView();
                alert(`Imported ${newTasks.length} new tasks successfully.`);
            } catch (err) {
                alert('Failed to parse file. Make sure it is a valid JSON backup.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// --- Sidebar & View ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    sidebar.classList.toggle('open');
    toggleIcon.src = sidebar.classList.contains('open') ? 'arrow_right.svg' : 'arrow_left.svg';
}

function applyView() {
    const cal = document.getElementById('calendar');
    const list = document.getElementById('list-view');
    const btn = document.getElementById('viewToggleBtn');

    if (currentView === 'list') {
        cal.style.display = 'none';
        list.style.display = 'block';
        if (btn) btn.innerText = 'Switch to Calendar View';
        renderListView();
    } else {
        cal.style.display = 'grid';
        list.style.display = 'none';
        if (btn) btn.innerText = 'Switch to List View';
        renderCalendar();
    }
}

function toggleView() {
    currentView = (currentView === 'calendar') ? 'list' : 'calendar';
    localStorage.setItem('org_app_view', currentView);
    applyView();
}

function toggleTaskActions() {
    document.body.classList.toggle('edit-mode');
    localStorage.setItem('org_app_edit_mode', document.body.classList.contains('edit-mode'));
}

// --- Modal ---
function openModal(dateStr = null, taskId = null) {
    editingTaskId = taskId;
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveTaskBtn');
    const dateInput = document.getElementById('taskDate');

    if (!dateStr && !taskId) dateStr = new Date();

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        modalTitle.innerText = 'Edit Task';
        saveBtn.innerText = 'Update Task';
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskCategory').value = task.category === 'overdue' ? (task.originalCategory || 'default') : task.category;
        document.getElementById('taskDeadline').value = task.deadline || '';
        document.getElementById('taskLink').value = task.link || '';
        dateInput.value = getLocalYYYYMMDD(task.originalDate || task.date);
        updateCategoryPreview(task.category === 'overdue' ? (task.originalCategory || 'default') : task.category);
    } else {
        editingTaskId = null;
        modalTitle.innerText = 'New Task';
        saveBtn.innerText = 'Add Task';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskCategory').value = 'default';
        document.getElementById('taskDeadline').value = '';
        document.getElementById('taskLink').value = '';
        dateInput.value = getLocalYYYYMMDD(dateStr);
        updateCategoryPreview('default');
    }

    document.getElementById('taskModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function saveTask() {
    const title = document.getElementById('taskTitle').value;
    const category = document.getElementById('taskCategory').value;
    const deadline = document.getElementById('taskDeadline').value;
    const taskDate = document.getElementById('taskDate').value;
    const link = document.getElementById('taskLink').value.trim();

    if (!title.trim() || !taskDate) return alert('Please enter a title and a valid date.');

    // Store as local-midnight ISO to avoid timezone shifts
    const formattedDate = toLocalMidnightISO(taskDate + 'T12:00:00');

    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        const existing = tasks[index];
        tasks[index] = {
            ...existing,
            title,
            category,
            deadline: deadline || null,
            date: formattedDate,
            originalDate: formattedDate,
            originalCategory: category,
            link: link || null
        };
        // Clear overdue state if editing
        if (tasks[index].category !== 'overdue') {
            delete tasks[index].daysOverdue;
        }
    } else {
        tasks.push({
            id: Date.now(),
            date: formattedDate,
            originalDate: formattedDate,
            title,
            category,
            originalCategory: category,
            deadline: deadline || null,
            link: link || null,
            completed: false
        });
    }

    closeModal();
    saveToLocalStorage();
    applyView();
}

// --- Task Actions ---
function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveToLocalStorage();
    currentView === 'calendar' ? renderCalendar() : renderListView();
}

function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveToLocalStorage();
        currentView === 'calendar' ? renderCalendar() : renderListView();
    }
}

// --- Daily Templates ---
function openDailyModal() {
    document.getElementById('dailyModal').style.display = 'flex';
    renderDailyTemplates();
}

function closeDailyModal() {
    document.getElementById('dailyModal').style.display = 'none';
}

function renderDailyTemplates() {
    const list = document.getElementById('dailyTemplateList');
    list.innerHTML = dailyTemplates.map((t, index) => `
        <div style="display:flex; justify-content:space-between; background:#121212; padding:8px; margin-bottom:5px; border-radius:4px; border-left: 4px solid var(--cat-${t.category})">
            <span style="font-size:0.9rem;">${t.title}</span>
            <button onclick="removeDailyTemplate(${index})" style="background:darkred; border:none; color:white; border-radius:4px; padding:2px 8px; cursor:pointer;">✖</button>
        </div>
    `).join('');
}

function addDailyTemplate() {
    const title = document.getElementById('newDailyTitle').value;
    const category = document.getElementById('newDailyCategory').value;
    if (title.trim()) {
        dailyTemplates.push({ title: title.trim(), category });
        localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
        document.getElementById('newDailyTitle').value = '';
        renderDailyTemplates();
        checkAndApplyDailyTemplates();
    }
}

function removeDailyTemplate(index) {
    dailyTemplates.splice(index, 1);
    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
    renderDailyTemplates();
}

/**
 * Checks which days are missing daily templates and applies them.
 * Uses a "last applied" date per template to avoid re-spawning on the same day
 * and to correctly backfill missed days without clobbering existing instances.
 */
function checkAndApplyDailyTemplates() {
    const todayStr = getLocalYYYYMMDD(today);
    let updated = false;

    dailyTemplates.forEach(temp => {
        // Find the most recent date this template was scheduled (completed or not)
        const instances = tasks.filter(t => t.title === temp.title && t.isDailyTemplate);
        
        // Check if there's already an instance for today
        const hasToday = instances.some(t => getLocalYYYYMMDD(t.originalDate || t.date) === todayStr);
        if (hasToday) return;

        // Find the most recent incomplete instance (overdue daily task to carry forward)
        const incompleteInstances = instances.filter(t => !t.completed);
        
        if (incompleteInstances.length > 0) {
            // Move the existing incomplete one to today instead of duplicating
            // (sort by date descending, take latest)
            incompleteInstances.sort((a, b) => new Date(b.originalDate || b.date) - new Date(a.originalDate || a.date));
            const toReschedule = incompleteInstances[0];
            toReschedule.date = toLocalMidnightISO(todayStr + 'T12:00:00');
            toReschedule.originalDate = toReschedule.originalDate || toReschedule.date;
            // Keep originalDate as the first missed day for reference, update display date to today
            toReschedule.date = toLocalMidnightISO(todayStr + 'T12:00:00');
            // Remove overdue state since we're moving it to today
            delete toReschedule.daysOverdue;
            toReschedule.category = toReschedule.originalCategory || temp.category;
            updated = true;
        } else {
            // No incomplete instance: create fresh for today
            tasks.push({
                id: Date.now() + Math.random(),
                date: toLocalMidnightISO(todayStr + 'T12:00:00'),
                originalDate: toLocalMidnightISO(todayStr + 'T12:00:00'),
                title: temp.title,
                category: temp.category,
                originalCategory: temp.category,
                completed: false,
                deadline: null,
                link: null,
                isDailyTemplate: true
            });
            updated = true;
        }
    });

    if (updated) { saveToLocalStorage(); }
}

/**
 * Processes old tasks:
 * - Removes completed past tasks
 * - Marks incomplete past tasks as overdue WITHOUT changing their date
 *   (daysOverdue is computed fresh each load from originalDate)
 */
function processOldTasks() {
    const todayTime = today.getTime();

    // Remove completed tasks from past days
    tasks = tasks.filter(task => {
        const taskDate = new Date(task.originalDate || task.date);
        taskDate.setHours(0,0,0,0);
        return !(taskDate.getTime() < todayTime && task.completed);
    });

    // Mark overdue without changing task.date
    tasks.forEach(task => {
        const taskDate = new Date(task.originalDate || task.date);
        taskDate.setHours(0,0,0,0);
        if (taskDate.getTime() < todayTime && !task.completed) {
            const diff = todayTime - taskDate.getTime();
            task.daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));
            // Preserve original category before overriding
            if (task.category !== 'overdue') {
                task.originalCategory = task.category;
            }
            task.category = 'overdue';
            // Move display date to today so it appears in today's card
            task.date = today.toISOString();
        }
    });

    saveToLocalStorage();
}

// --- Render ---
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    calendarEl.innerHTML = '';

    for (let i = 0; i < 15; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const isToday = i === 0;
        const dateString = currentDate.toISOString();

        const card = document.createElement('div');
        card.className = `day-card ${isToday ? 'today' : ''}`;

        // Add button only on today's card; other days have no add button
        const addBtn = isToday
            ? `<button class="btn-add" title="Add task for today" onclick="openModal('${dateString}')">+</button>`
            : '';

        card.innerHTML = `
            <div class="day-header">
                <div>
                    <span class="date-number">${currentDate.getDate()}</span>
                    <span class="date-label">${currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}</span>
                </div>
                ${addBtn}
            </div>
            <div class="task-list" id="list-${i}"></div>
        `;
        calendarEl.appendChild(card);
        renderTasksForDate(dateString, `list-${i}`);
    }
}

function renderListView() {
    const container = document.getElementById('list-view');
    if (!container) return;

    container.innerHTML = '<h2>Full Task List</h2><div id="list-content"></div>';
    const content = document.getElementById('list-content');

    const uniqueTimestamps = [...new Set(tasks.map(t => {
        const d = new Date(t.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }))].sort((a, b) => a - b);

    uniqueTimestamps.forEach((timestamp, idx) => {
        const dateObj = new Date(timestamp);
        const section = document.createElement('div');
        section.className = 'list-section';
        section.innerHTML = `
            <div class="list-section-header">
                ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div id="list-group-${idx}" class="list-group-container"></div>
        `;
        content.appendChild(section);
        renderTasksForDate(timestamp, `list-group-${idx}`);
    });
}

function renderTasksForDate(dateValue, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const targetDateObj = new Date(dateValue);
    targetDateObj.setHours(0, 0, 0, 0);
    const targetDate = targetDateObj.getTime();

    const dayTasks = tasks.filter(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === targetDate;
    });

    dayTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskEl.setAttribute('data-category', task.category);

        taskEl.onclick = (e) => {
            if (e.target.type !== 'checkbox' && !e.target.classList.contains('btn-delete') && !e.target.classList.contains('task-link')) {
                openModal(task.date, task.id);
            }
        };

        // Overdue badge
        const overdueLabel = task.daysOverdue
            ? `<span class="overdue-counter">${task.daysOverdue}d late</span>`
            : '';

        // Days remaining badge (for non-overdue tasks with deadlines)
        let deadlineBadge = '';
        if (task.deadline) {
            const daysLeft = daysBetween(today, new Date(task.deadline + 'T12:00:00'));
            if (daysLeft < 0) {
                deadlineBadge = `<div class="due-warning">Deadline passed ${Math.abs(daysLeft)}d ago</div>`;
            } else if (daysLeft === 0) {
                deadlineBadge = `<div class="due-warning">Due TODAY</div>`;
            } else if (daysLeft <= 3) {
                deadlineBadge = `<div class="due-warning">${daysLeft}d remaining</div>`;
            } else {
                deadlineBadge = `<div class="due-badge">${daysLeft}d remaining</div>`;
            }
        }

        // Link button
        const linkBtn = task.link
            ? `<a href="${escapeAttr(task.link)}" target="_blank" rel="noopener" class="task-link" onclick="event.stopPropagation()" title="Open link">🔗</a>`
            : '';

        taskEl.innerHTML = `
            <div style="display:flex; align-items:center; flex:1; min-width:0;">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                       onclick="event.stopPropagation(); completeTask(${task.id})">
                <div class="task-content">
                    <div style="font-weight:bold;">${escapeHtml(task.title)} ${overdueLabel}</div>
                    ${deadlineBadge}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                ${linkBtn}
                <div class="task-actions">
                    <button class="btn-action btn-delete" onclick="event.stopPropagation(); deleteTask(${task.id})">✖</button>
                </div>
            </div>
        `;
        container.appendChild(taskEl);
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateCategoryPreview(val) {
    const colors = {
        default: 'grey', exam: '#ff4444', task: '#ff66b2',
        overdue: '#800080', game: '#ffa500', study: '#007bff',
        task_deadline: '#9370db'
    };
    const preview = document.getElementById('categoryPreview');
    if (preview) preview.style.backgroundColor = colors[val] || 'grey';
}

// --- Init ---
window.onclick = (event) => {
    if (event.target.classList.contains('modal-overlay')) {
        closeModal();
        closeDailyModal();
    }
};

loadFromLocalStorage();
processOldTasks();
checkAndApplyDailyTemplates();
if (localStorage.getItem('org_app_edit_mode') === 'true') document.body.classList.add('edit-mode');
applyView();
