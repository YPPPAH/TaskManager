// --- State Management ---
let tasks = [];
let dailyTemplates = JSON.parse(localStorage.getItem('org_daily_templates')) || [];
let selectedDateForNewTask = null;
let editingTaskId = null;
let currentView = localStorage.getItem('org_app_view') || 'calendar';
let today = new Date();
today.setHours(0, 0, 0, 0);

// --- Local Storage Utilities ---
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

// --- Sidebar & View Toggles ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    sidebar.classList.toggle('open');
    
    if (sidebar.classList.contains('open')) {
        toggleIcon.src = 'arrow_right.svg'; // Ensure you have these SVGs
    } else {
        toggleIcon.src = 'arrow_left.svg';
    }
}

// --- View Logic ---

/**
 * Applies the current view state to the UI
 */
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

/**
 * Toggles and saves the view preference
 */
function toggleView() {
    currentView = (currentView === 'calendar') ? 'list' : 'calendar';
    
    // Save the preference to localStorage
    localStorage.setItem('org_app_view', currentView);
    
    applyView();
}


function toggleTaskActions() {
    document.body.classList.toggle('edit-mode');
    localStorage.setItem('org_app_edit_mode', document.body.classList.contains('edit-mode'));
}

// --- Task Modal (Add/Edit) ---
function openModal(dateStr = null, taskId = null) {
    editingTaskId = taskId;
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveTaskBtn');
    const dateInput = document.getElementById('taskDate');
    
    // Set a default date if none provided (for Sidebar Quick Add)
    if (!dateStr && !taskId) {
        dateStr = new Date().toISOString().split('T')[0];
    }

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        modalTitle.innerText = "Edit Task";
        saveBtn.innerText = "Update Task";
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskDeadline').value = task.deadline || '';
        // Set the date input to the task's existing date
        dateInput.value = new Date(task.date).toISOString().split('T')[0];
        updateCategoryPreview(task.category);
    } else {
        editingTaskId = null;
        modalTitle.innerText = "New Task";
        saveBtn.innerText = "Add Task";
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskCategory').value = 'default';
        document.getElementById('taskDeadline').value = '';
        // Set the date input to the selected date
        dateInput.value = new Date(dateStr).toISOString().split('T')[0];
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
    const taskDate = document.getElementById('taskDate').value; // Read from the new input

    if (!title.trim() || !taskDate) return alert("Please enter a title and a valid date.");

    // Convert input date to ISO format consistent with app state
    const formattedDate = new Date(taskDate).toISOString();

    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        tasks[index] = { ...tasks[index], title, category, deadline, date: formattedDate };
    } else {
        tasks.push({
            id: Date.now(),
            date: formattedDate,
            title,
            category,
            deadline: deadline || null,
            completed: false
        });
    }

    closeModal();
    saveToLocalStorage();
    applyView(); // Re-render whichever view is active
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveToLocalStorage();
    currentView === 'calendar' ? renderCalendar() : renderListView();
}

function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed; // Toggle state
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
            <span>${t.title}</span>
            <span style="color:red; cursor:pointer;" onclick="removeDailyTemplate(${index})">✖</span>
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

function checkAndApplyDailyTemplates() {
    const todayStr = today.toISOString();
    let updated = false;
    dailyTemplates.forEach(temp => {
        const exists = tasks.some(t => t.date === todayStr && t.title === temp.title);
        if (!exists) {
            tasks.push({
                id: Date.now() + Math.random(),
                date: todayStr,
                title: temp.title,
                category: temp.category,
                completed: false,
                deadline: null
            });
            updated = true;
        }
    });
    if (updated) { saveToLocalStorage(); renderCalendar(); }
}

// --- Maintenance & Overdue ---
function processOldTasks() {
    const todayTime = today.getTime();
    tasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0,0,0,0);
        return !(taskDate.getTime() < todayTime && task.completed);
    });

    tasks.forEach(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0,0,0,0);
        if (taskDate.getTime() < todayTime && !task.completed) {
            const diff = todayTime - taskDate.getTime();
            task.daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));
            task.category = 'overdue';
            task.date = today.toISOString();
        }
    });
    saveToLocalStorage();
}

// --- Rendering Logic ---
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
        
        card.innerHTML = `
            <div class="day-header">
                <div>
                    <span class="date-number">${currentDate.getDate()}</span>
                    <span class="date-label">${currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}</span>
                </div>
                <button class="btn-add" onclick="openModal('${dateString}')">+</button>
            </div>
            <div class="task-list" id="list-${i}"></div>
        `;
        calendarEl.appendChild(card);
        renderTasksForDate(dateString, `list-${i}`);
    }
}

/**
 * Enhanced List View with spacing classes
 */
function renderListView() {
    const container = document.getElementById('list-view');
    if (!container) return;
    
    container.innerHTML = '<h2>Full Task List</h2><div id="list-content"></div>';
    const content = document.getElementById('list-content');

    // Get all unique dates from tasks and sort them
    const allUniqueDates = [...new Set(tasks.map(t => t.date))].sort();
    
    allUniqueDates.forEach((dateStr, idx) => {
        const dateObj = new Date(dateStr);
        const section = document.createElement('div');
        section.className = 'list-section';
        
        // Use the 'list-group-container' class for the task spacing
        section.innerHTML = `
            <div class="list-section-header">
                ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div id="list-group-${idx}" class="list-group-container"></div>
        `;
        content.appendChild(section);
        
        // Render tasks into the newly created group
        renderTasksForDate(dateStr, `list-group-${idx}`);
    });
}

function renderTasksForDate(dateString, containerId) {
    const container = document.getElementById(containerId);
    const targetDate = new Date(dateString).getTime();

    const dayTasks = tasks.filter(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0,0,0,0);
        return tDate.getTime() === targetDate;
    });

    dayTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskEl.setAttribute('data-category', task.category);
        
        // Clicking the card opens Edit (but NOT when clicking checkbox or delete)
        taskEl.onclick = (e) => {
            if (e.target.type !== 'checkbox' && !e.target.classList.contains('btn-delete')) {
                openModal(task.date, task.id);
            }
        };

        const overdueLabel = task.daysOverdue ? `<span class="overdue-counter">${task.daysOverdue}d late</span>` : '';

        taskEl.innerHTML = `
            <div style="display:flex; align-items:center;">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onclick="event.stopPropagation(); completeTask(${task.id})">
                <div class="task-content">
                    <div style="font-weight: bold;">${task.title} ${overdueLabel}</div>
                    ${task.deadline ? `<div class="due-badge">Due: ${new Date(task.deadline).toLocaleDateString()}</div>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-action btn-delete" onclick="event.stopPropagation(); deleteTask(${task.id})">✖</button>
            </div>
        `;
        container.appendChild(taskEl);
    });
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

// --- Initialization ---
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
renderCalendar();