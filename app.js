// State Management
let tasks = [];
let selectedDateForNewTask = null;

// --- Local Storage Utilities ---
function saveToLocalStorage() {
    // Converts the tasks array to a text string and saves it
    localStorage.setItem('org_app_tasks', JSON.stringify(tasks));
}

function loadFromLocalStorage() {
    // Tries to get the saved string
    const savedData = localStorage.getItem('org_app_tasks');
    if (savedData) {
        tasks = JSON.parse(savedData); // Convert it back to an array
        return true; // We found data!
    }
    return false; // No data found
}

// Date Utilities
const today = new Date();
// Reset time to ensure accurate day comparisons
today.setHours(0, 0, 0, 0); 

let dailyTemplates = JSON.parse(localStorage.getItem('org_daily_templates')) || [];

// --- Daily Template UI Functions ---
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
        <div style="display:flex; justify-content:space-between; background:#121212; padding:8px; margin-bottom:5px; border-radius:4px;">
            <span>${t}</span>
            <span style="color:red; cursor:pointer;" onclick="removeDailyTemplate(${index})">✖</span>
        </div>
    `).join('');
}

function addDailyTemplate() {
    const val = document.getElementById('newDailyTitle').value;
    if (val.trim()) {
        dailyTemplates.push(val.trim());
        localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
        document.getElementById('newDailyTitle').value = '';
        renderDailyTemplates();
        checkAndApplyDailyTemplates(); // Apply immediately
    }
}

function removeDailyTemplate(index) {
    dailyTemplates.splice(index, 1);
    localStorage.setItem('org_daily_templates', JSON.stringify(dailyTemplates));
    renderDailyTemplates();
}

// --- The Core "Auto-Create" Logic ---
function checkAndApplyDailyTemplates() {
    const todayStr = today.toISOString();
    let updated = false;

    dailyTemplates.forEach(templateTitle => {
        // Check if a task with this name already exists for today
        const exists = tasks.some(t => t.date === todayStr && t.title === templateTitle);
        
        if (!exists) {
            tasks.push({
                id: Date.now() + Math.random(), // Unique ID
                date: todayStr,
                title: templateTitle,
                category: 'default',
                completed: false,
                deadline: null
            });
            updated = true;
        }
    });

    if (updated) {
        saveToLocalStorage();
        renderCalendar();
    }
}

// Test
// function initMockData() {
//     const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
//     tasks = [
//         { id: 1, date: today.toISOString(), title: "Math Homework", category: "task", completed: false },
//         { id: 2, date: today.toISOString(), title: "Study for Biology", category: "exam", completed: false },
//         // Example of a task that wasn't finished yesterday, moved to today as overdue
//         { id: 3, date: today.toISOString(), title: "Clean Desk (Missed)", category: "overdue", completed: false }, 
//         { id: 4, date: tmrw.toISOString(), title: "Doctor Appointment", category: "default", completed: false }
//     ];
// }

// Render the Grid
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendarEl.innerHTML = '';

    // Render Today + next 14 days (15 days total)
    for (let i = 0; i < 15; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        
        const isToday = i === 0;
        const dateString = currentDate.toISOString();
        
        // Create Card
        const card = document.createElement('div');
        card.className = `day-card ${isToday ? 'today' : ''}`;
        
        // Header
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = currentDate.getDate();
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'short' });

        card.innerHTML = `
            <div class="day-header">
                <div>
                    <span class="date-number">${dayNum}</span>
                    <span class="date-label">${dayName}, ${monthName}</span>
                </div>
                <button class="btn-add" onclick="openModal('${dateString}')">+</button>
            </div>
            <div class="task-list" id="list-${i}"></div>
        `;
        
        calendarEl.appendChild(card);
        renderTasksForDate(dateString, `list-${i}`, isToday);
    }
}

// Render Tasks inside a specific day
function renderTasksForDate(dateString, containerId, isToday) {
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

        // Build Action Buttons
        let actionBtns = '';
        
        // Rule: Complete button (Dark Yellow) only on the actual day
        if (!task.completed) {
            actionBtns += `<button class="btn-action btn-complete" onclick="completeTask(${task.id})" title="Complete">✔</button>`;
        }
        // Rule: Delete button (Dark Red) on any task
        actionBtns += `<button class="btn-action btn-delete" onclick="deleteTask(${task.id})" title="Delete">✖</button>`;
        // Build Deadline Badge
        let deadlineHtml = '';
        if (task.deadline) {
            const dDate = new Date(task.deadline);
            // Fix timezone offset for accurate day display
            dDate.setMinutes(dDate.getMinutes() + dDate.getTimezoneOffset()); 
            
            const dStr = dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // If the calendar day we are rendering is >= the deadline, make it red!
            const isWarning = targetDate >= dDate.getTime(); 
            const badgeClass = isWarning ? 'due-warning' : 'due-badge';
            
            deadlineHtml = `<div class="${badgeClass}">Due: ${dStr}</div>`;
        }

        taskEl.innerHTML = `
            <div class="task-content">
                <div style="font-weight: bold;">${task.title}</div>
                ${deadlineHtml} </div>
            <div class="task-actions">${actionBtns}</div>
        `;
        
        container.appendChild(taskEl);
    });
}

// --- Task Logic ---

function openModal(dateStr) {
    selectedDateForNewTask = dateStr;
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskCategory').value = 'default';
    document.getElementById('taskDeadline').value = '';
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskTitle').focus();
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function saveTask() {
    const title = document.getElementById('taskTitle').value;
    const category = document.getElementById('taskCategory').value;
    const deadline = document.getElementById('taskDeadline').value; // <-- ADD THIS
    
    if (!title.trim()) {
        alert("Please enter a task title.");
        return;
    }

    tasks.push({
        id: Date.now(), 
        date: selectedDateForNewTask, // The day you plan to WORK on it
        deadline: deadline || null,   // <-- ADD THIS (The actual due date)
        title: title,
        category: category,
        completed: false
    });

    closeModal();
    saveToLocalStorage(); 
    renderCalendar();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveToLocalStorage(); // <--- ADD THIS
    renderCalendar();
}

function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = true;
        saveToLocalStorage(); // <--- ADD THIS
        renderCalendar();
    }
}

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('taskModal');
    if (event.target == modal) {
        closeModal();
    }
}

// --- UI Toggle Logic ---

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    sidebar.classList.toggle('open');
    
    // Updated arrow logic for the right side
    if (sidebar.classList.contains('open')) {
        // When open, show the arrow pointing right (to close)
        toggleIcon.src = 'arrow_right.svg';
    } else {
        // When closed, show the arrow pointing left (to open)
        toggleIcon.src = 'arrow_left.svg';
    }
}

function toggleTaskActions() {
    // Toggles the class on the body that shows/hides the buttons
    document.body.classList.toggle('edit-mode');
    
    // Optional: Save this preference so it stays open/closed when you refresh
    const isEditMode = document.body.classList.contains('edit-mode');
    localStorage.setItem('org_app_edit_mode', isEditMode);
}

// --- Daily Maintenance ---

function processOldTasks() {
    const todayTime = today.getTime(); // 'today' is already set to midnight in your Date Utilities
    
    // 1. Remove old completed tasks
    tasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);
        
        // If the date is strictly before today AND it's completed, filter it out (delete)
        if (taskDate.getTime() < todayTime && task.completed) {
            return false; 
        }
        return true; 
    });

    // 2. Move old uncompleted tasks to today and mark as overdue
    tasks.forEach(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);
        
        // If the date is before today AND it's not completed
        if (taskDate.getTime() < todayTime && !task.completed) {
            task.category = 'overdue';
            task.date = today.toISOString(); // Move to today's list
        }
    });

    // Save the cleaned up state to LocalStorage
    saveToLocalStorage();
}

// Initialize App
const hasSavedData = loadFromLocalStorage();

if (!hasSavedData) {  
    saveToLocalStorage(); 
}

// Check for routine tasks every time the app opens
checkAndApplyDailyTemplates();

// Run our automatic cleanup/moving logic every time the page is loaded/refreshed
processOldTasks();

// Check if we should start in edit mode based on saved preference
if (localStorage.getItem('org_app_edit_mode') === 'true') {
    document.body.classList.add('edit-mode');
}

// Finally, render the calendar
renderCalendar();