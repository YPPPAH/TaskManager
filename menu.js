/**
 * Menu management script for Task Manager application.
 */

/**
 * Initializes the state of application toggle buttons based on localStorage values.
 */
document.addEventListener('DOMContentLoaded', function() {
    const toggleButtons = document.querySelectorAll('.m-toggle');
    toggleButtons.forEach(btn => {
        const appName = btn.getAttribute('data-app');
        // Check localStorage for this specific app's state
        const isRunning = localStorage.getItem("m-"+appName) === 'true';
        // Set button state based on stored value
        if (isRunning) {
            btn.setAttribute('data-state', 'kill');
            btn.textContent = `Close ${capitalize(appName)}`;
        } 
    });
});

/**
 * Toggles between Launch and Close modes for applications in the menu.
 * This function listens for click events on buttons with the 'm-toggle'.
 */
document.addEventListener('click', function(event) {
    const btn = event.target.closest('.m-toggle');
    if (!btn) return;
    const appName = btn.getAttribute('data-app');
    let isRunning = localStorage.getItem("m-"+appName) === 'true';// Look for state

    if (isRunning) {
        window.location.href = `appmanager://kill/${appName}`; // Execute action kill
        btn.setAttribute('data-state', 'kill');
        btn.textContent = `Launch ${capitalize(appName)}`;
        localStorage.removeItem("m-"+appName);// Clear state
    } else {
        window.location.href = `appmanager://run/${appName}`; // Execute action run
        btn.setAttribute('data-state', 'run');
        btn.textContent = `Close ${capitalize(appName)}`;
        localStorage.setItem("m-"+appName, true);
    }
});


// Helper function to capitalize the app name (e.g., "wallpaper" -> "Wallpaper")
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
