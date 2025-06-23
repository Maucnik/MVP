// --- DOM Element References ---
const taskInput = document.getElementById("taskInput"); // For main task
const taskPage = document.getElementById("taskPage"); // Container for all tasks list
const mainTaskInput = document.getElementById("taskInput"); // Same as taskInput, kept for clarity in context
const stepList = document.getElementById("stepList");
const stepForm = document.getElementById("stepForm");
const stepInput = document.getElementById("stepInput");
const addStepBtn = document.querySelector(".btn-yellow"); // "Add Step" button for main task
const markDoneBtn = document.querySelector(".btn-pink"); // "Mark Done" button for main task

const body = document.body;
const toggleBtn = document.getElementById("toggleDark");

const bookContainer = document.querySelector(".book-container");
const showMainTaskBtn = document.getElementById("showMainTaskBtn");
const showAllTasksBtn = document.getElementById("showAllTasksBtn");

// Pomodoro Timer Elements
const pomodoroTimer = document.getElementById("pomodoroTimer");
const timerStatus = document.getElementById("timerStatus");
const countdown = document.getElementById("countdown");
const startTimerBtn = document.getElementById("startTimerBtn");
const pauseTimerBtn = document.getElementById("pauseTimerBtn");
const resetTimerBtn = document.getElementById("resetTimerBtn");

// Progress Bar Elements (assuming you've added the HTML for these)
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');


// --- Task Data and Persistence ---
let tasks = [];
let mainTask = null; // Variable to hold the reference to today's most important task

// Load tasks from localStorage on script initialization
const storedTasks = localStorage.getItem("tasks");
if (storedTasks) {
  tasks = JSON.parse(storedTasks).map((task) => {
    // Ensure 'done' and 'isMainTask' properties exist
    task.done = task.done || false;
    task.isMainTask = task.isMainTask || false;
    // IMPORTANT: Ensure subtasks are also objects, not just strings
    // This handles cases where old data might have subtasks as strings
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks = task.subtasks.map(sub => {
        if (typeof sub === 'string') {
          return { text: sub, done: false };
        }
        return sub; // Already an object
      });
    } else {
      task.subtasks = []; // Initialize if null/undefined
    }
    return task;
  });
  // Find the main task if it exists (and is not done)
  mainTask = tasks.find((task) => task.isMainTask && !task.done);
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

// --- Pomodoro Timer Variables ---
const FOCUS_TIME = 25 * 60; // 25 minutes in seconds
const BREAK_TIME = 5 * 60; // 5 minutes in seconds
let timer = FOCUS_TIME;
let isRunning = false;
let intervalId = null;
let isFocusSession = true; // true for focus, false for break


// --- Tips Array ---
const tips = [
  "Break down large tasks into smaller, manageable steps.",
  "If you can't do it today, it's okay, don't whiplash yourself!",
  "Use the Pomodoro Technique: work for 25 mins, then a 5-min break.",
  "Treat yourself while doing the task to associate it with positive feelings.",
  "Set specific deadlines for each task to create urgency.",
  "Review your tasks daily to stay on track.",
  "Set an exact time for only THIS task, not just 'today'.",
  "Celebrate small victories to keep motivated!",
  "Make your workspace clutter-free.",
  "Learn to say 'no' to non-essential requests.",
  "Don't listen to music that makes you restless, or makes you think only about it.",
  "Try doing just a tiny peace of the task, it can help you get started. and then you will be more okay with continuing.",
  "Visualize the end result to stay motivated.",
  "Plan how you'll do the task, try to gaslight yourself into falling in love with the process!"
];

// --- Utility Functions ---
function findTaskById(taskId) {
  return tasks.find((t) => t.id === taskId);
}

function displayRandomTip(tipContainerId) {
  const tipContainer = document.getElementById(tipContainerId);
  if (!tipContainer) return;

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  tipContainer.innerHTML = `<strong class="font-bold">💡 Tip:</strong> ${randomTip} <span id="newTipBtn" class="ml-2 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">Get another tip!</span>`;

  // Re-assign event listener for the new tip button each time content is updated
  document.getElementById("newTipBtn").onclick = () =>
    displayRandomTip(tipContainerId);
}


// --- Right Panel (All Tasks) Functions ---
function addTask() {
  const taskInput2 = document.getElementById("taskInput2");
  const title = taskInput2.value.trim();
  if (!title) return;

  const task = {
    id: Date.now(),
    title: title,
    // When adding from right panel, subtasks are still just strings here
    // If you later want progress on these, you'd convert them when opening for editing
    subtasks: [],
    done: false,
    isMainTask: false, // Default to false for tasks added via the right panel
  };

  tasks.unshift(task); // Add to the beginning of the array
  saveTasks();
  taskInput2.value = "";

  renderTasksOnRightPanel();
}

function renderTasksOnRightPanel() {
  taskPage.innerHTML = ""; // Clear existing content

  // Filter out the active main task from the right panel display
  const tasksToRender = tasks.filter(
    (task) => !task.isMainTask || (task.isMainTask && task.done) // Include main task if it's done
  );

  if (tasksToRender.length === 0) {
    const noTaskMessage = document.createElement("p");
    noTaskMessage.classList.add("italic");
    noTaskMessage.textContent = "No task selected yet.";
    taskPage.appendChild(noTaskMessage);
    return;
  }

  tasksToRender.forEach((task) => {
    // Only render tasks that are not done (unless they were main tasks that are now done)
    if (task.done && !task.isMainTask) return; // Don't show regular done tasks that are NOT main tasks

    const newTaskDiv = document.createElement("div");
    newTaskDiv.classList.add(
      "task-item",
      "p-3",
      "rounded-lg",
      "shadow-sm",
      "flex",
      "items-center",
      "justify-between"
    );

    const titleSpan = document.createElement("span");
    titleSpan.textContent = task.title;
    titleSpan.classList.add("cursor-pointer", "hover:underline");
    titleSpan.onclick = () => openTaskPage(task.id);

    const removeBtn = document.createElement("button");
    removeBtn.classList.add(
      "px-2",
      "py-1",
      "rounded",
      "hover:bg-red-400",
      "btn-red"
    );
    removeBtn.textContent = "Done";
    removeBtn.onclick = () => {
      // Find the index of the task to remove
      const taskIndex = tasks.findIndex((t) => t.id === task.id);
      if (taskIndex > -1) {
        tasks.splice(taskIndex, 1); // Remove task from the array
        saveTasks(); // Save the updated tasks array
        renderTasksOnRightPanel(); // Re-render the right panel
        renderMainTask(); // Re-render main task panel in case it was the main task
      }
    };

    newTaskDiv.appendChild(titleSpan);
    newTaskDiv.appendChild(removeBtn);
    taskPage.appendChild(newTaskDiv);
  });
}

function openTaskPage(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;

  taskPage.innerHTML = ""; // Clear right panel to show task details

  const backButton = document.createElement("button");
  backButton.classList.add(
    "mb-4",
    "text-sm",
    "text-blue-500",
    "hover:underline"
  );
  backButton.textContent = "← Back to All Tasks";
  backButton.onclick = renderTasksOnRightPanel;

  const title = document.createElement("h2");
  title.classList.add("text-xl", "font-semibold", "mb-2");
  title.textContent = task.title;

  const tipDiv = document.createElement("div");
  tipDiv.id = "currentTaskTip";
  tipDiv.classList.add(
    "bg-yellow-100",
    "dark:bg-yellow-800",
    "p-3",
    "rounded-lg",
    "mb-4",
    "text-sm",
    "text-yellow-800",
    "dark:text-yellow-200"
  );

  const subtaskForm = document.createElement("form");
  subtaskForm.classList.add("flex", "gap-2", "mb-4");
  subtaskForm.onsubmit = (e) => {
    e.preventDefault();
    const input = subtaskForm.querySelector("input");
    const text = input.value.trim();
    if (!text) return;

    // *** IMPORTANT: Ensure subtasks added from this panel are also objects ***
    task.subtasks.push({ text: text, done: false });
    // *********************************************************************

    saveTasks();
    input.value = "";
    renderSubtaskList(task);
  };

  const subtaskInput = document.createElement("input");
  subtaskInput.type = "text";
  subtaskInput.placeholder = "Add a breakdown step...";
  subtaskInput.classList.add("flex-1", "px-2", "py-1", "rounded", "border");

  const addButton = document.createElement("button");
  addButton.type = "submit";
  addButton.textContent = "Add";
  addButton.classList.add(
    "px-3",
    "py-1",
    "bg-green-500",
    "text-white",
    "rounded",
    "hover:bg-green-600"
  );

  subtaskForm.appendChild(subtaskInput);
  subtaskForm.appendChild(addButton);

  const subtaskList = document.createElement("ul");
  subtaskList.id = "subtaskList";
  subtaskList.classList.add("list-disc", "pl-5", "space-y-1");

  taskPage.appendChild(backButton);
  taskPage.appendChild(title);
  taskPage.appendChild(tipDiv);
  taskPage.appendChild(subtaskForm);
  taskPage.appendChild(subtaskList);

  renderSubtaskList(task);
  displayRandomTip("currentTaskTip");
}

function renderSubtaskList(task) {
  const list = document.getElementById("subtaskList");
  if (!list) return;
  list.innerHTML = "";
  task.subtasks.forEach((sub, index) => { // Added index for potential future use
    const li = document.createElement("li");
    // Display text content from the subtask object
    li.textContent = sub.text; // Access .text property
    // You could add a checkbox here too if you want to mark subtasks done
    // in the "All Tasks" view. For now, it's just the text.
    list.appendChild(li);
  });
}

// --- Left Panel (Main Task) Functions ---
function renderMainTask() {
  if (mainTask && !mainTask.done) {
    taskInput.value = mainTask.title;
    taskInput.disabled = true;
    addStepBtn.style.display = "block";
    markDoneBtn.style.display = "block";
    stepForm.classList.remove("hidden"); // Ensure step form is visible when main task is active
    renderMainTaskSteps();
    togglePomodoroDisplay(true); // Show the timer when a main task is active
  } else {
    taskInput.value = "";
    taskInput.disabled = false;
    stepList.innerHTML = "";
    stepForm.classList.add("hidden");
    addStepBtn.style.display = "none";
    markDoneBtn.style.display = "none";
    togglePomodoroDisplay(false); // Hide the timer when no main task or it's done
    if (progressBarContainer) { // Hide progress bar if no main task
      progressBarContainer.classList.add('hidden');
    }
  }
}

function addMainTask() {
  const title = mainTaskInput.value.trim();
  if (!title) return;

  if (mainTask && !mainTask.done) {
    alert("Please mark the current main task as done before adding a new one.");
    return;
  }

  // If there's an old main task that's done, set its `isMainTask` to false
  if (mainTask && mainTask.done) {
    mainTask.isMainTask = false;
  }

  mainTask = {
    id: Date.now(),
    title: title,
    subtasks: [], // Initialize subtasks as an empty array of objects
    done: false,
    isMainTask: true,
  };
  tasks.unshift(mainTask); // Add to the beginning of the tasks array
  saveTasks();
  renderMainTask(); // Update left panel
  renderTasksOnRightPanel(); // Update right panel (should hide active main task)
}

// --- Updated renderMainTaskSteps for Progress Tracking ---
function renderMainTaskSteps() {
  stepList.innerHTML = "";
  if (mainTask && mainTask.subtasks.length > 0) {
    mainTask.subtasks.forEach((step, index) => { // 'step' is now an object, and we need 'index'
      const li = document.createElement("li");
      li.classList.add("flex", "items-center", "justify-between", "py-1");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.classList.add("form-checkbox", "h-4", "w-4", "text-pink-600", "rounded", "mr-2");
      checkbox.checked = step.done; // Set checked status based on step.done
      checkbox.onchange = () => toggleSubtaskDone(index); // Call a new function on change

      const span = document.createElement("span");
      span.textContent = step.text;
      span.classList.add("flex-1", "mr-2"); // Initial classes for span

      // Apply line-through and adjust text color based on step.done and theme
      if (step.done) {
        span.classList.add("line-through");
        body.classList.contains("dark") ? span.classList.add("text-gray-400") : span.classList.add("text-gray-500");
      } else {
        span.classList.remove("line-through");
        // Ensure text color is reset to default for active tasks
        body.classList.contains("dark") ? span.classList.add("text-white") : span.classList.add("text-gray-800");
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = '🗑️'; // Trash can emoji
      deleteBtn.classList.add("ml-2", "text-red-500", "hover:text-red-700", "px-1", "py-0.5", "rounded", "text-sm");
      deleteBtn.onclick = () => deleteSubtask(index); // Call a new function to delete

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(deleteBtn);
      stepList.appendChild(li);
    });
  }
  updateMainTaskProgressBar(); // Call this new function after rendering steps
}

function showStepForm() {
  if (!mainTask || mainTask.done) {
    alert("Please add and set your main task first!");
    return;
  }
  stepForm.classList.remove("hidden");
  stepInput.focus();
}

function submitStep() {
  if (!mainTask) return;

  const value = stepInput.value.trim();
  if (!value) return;

  // *** CRUCIAL CHANGE: Pushing an object for subtasks ***
  mainTask.subtasks.push({ text: value, done: false });
  // *****************************************************

  saveTasks();
  renderMainTaskSteps(); // This will also trigger updateMainTaskProgressBar()

  stepInput.value = "";
  stepInput.focus();
}

function markMainTaskDone() {
  if (!mainTask) {
    alert("No main task to mark as done!");
    return;
  }
  mainTask.done = true;
  saveTasks();
  mainTask = null; // Clear main task reference as it's done
  renderMainTask(); // Re-render the left panel to clear the done task
  renderTasksOnRightPanel(); // Update the right panel
  resetTimer(); // Reset the timer when the main task is done
}


// --- NEW Subtask Management Functions for Main Task ---
function toggleSubtaskDone(index) {
  if (mainTask && mainTask.subtasks[index]) {
    mainTask.subtasks[index].done = !mainTask.subtasks[index].done;
    saveTasks();
    renderMainTaskSteps(); // Re-render to update visual state (line-through, checkbox)
    checkAndMarkMainTaskDoneIfAllSubtasksAreDone(); // Check if all subtasks are done
  }
}

function deleteSubtask(index) {
  if (mainTask && mainTask.subtasks[index]) {
    mainTask.subtasks.splice(index, 1);
    saveTasks();
    renderMainTaskSteps(); // Re-render list and update progress bar
  }
}

// --- NEW Progress Bar Functions ---
function updateMainTaskProgressBar() {
  if (!progressBarContainer || !progressBarFill || !progressText) {
    console.warn("Progress bar elements not found in DOM.");
    return;
  }

  if (!mainTask || mainTask.subtasks.length === 0) {
    progressBarContainer.classList.add('hidden'); // Hide if no main task or no subtasks
    return;
  }

  const completedSteps = mainTask.subtasks.filter(step => step.done).length;
  const totalSteps = mainTask.subtasks.length;
  const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  progressBarFill.style.width = `${percentage}%`;
  progressText.textContent = `${completedSteps}/${totalSteps} steps completed (${Math.round(percentage)}%)`;

  progressBarContainer.classList.remove('hidden'); // Show the bar
}

function checkAndMarkMainTaskDoneIfAllSubtasksAreDone() {
  if (mainTask && mainTask.subtasks.length > 0) {
    const allSubtasksDone = mainTask.subtasks.every(step => step.done);
    if (allSubtasksDone && !mainTask.done) {
      // Small delay to allow user to see 100% before alert and task removal
      setTimeout(() => {
        markMainTaskDone(); // Use the existing function
        alert("🎉 All steps completed! Main task marked as done!");
      }, 300); // 300ms delay
    }
  }
}


// --- Pomodoro Timer Functions ---
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  countdown.textContent = formatTime(timer);
}

function startTimer() {
  if (isRunning) return; // Prevent multiple intervals
  isRunning = true;

  intervalId = setInterval(() => {
    timer--;
    updateTimerDisplay();

    if (timer <= 0) {
      clearInterval(intervalId);
      isRunning = false;
      playNotificationSound(); // Optional: Add a sound notification

      if (isFocusSession) {
        alert("Time for a break! Take 5 minutes.");
        timer = BREAK_TIME;
        isFocusSession = false;
        timerStatus.textContent = "Break Time!";
      } else {
        alert("Break over! Time to focus again.");
        timer = FOCUS_TIME;
        isFocusSession = true;
        timerStatus.textContent = "Focus Time!";
      }
      updateTimerDisplay();
      // Optionally auto-start next session, or require user click
      // startTimer(); // Auto-start
    }
  }, 1000); // Update every second
}

function pauseTimer() {
  clearInterval(intervalId);
  isRunning = false;
}

function resetTimer() {
  clearInterval(intervalId);
  isRunning = false;
  timer = FOCUS_TIME;
  isFocusSession = true;
  timerStatus.textContent = "Focus Time!";
  updateTimerDisplay();
}

function playNotificationSound() {
  // You can add a small audio file here (e.g., 'ding.mp3')
  // const audio = new Audio('path/to/your/sound.mp3');
  // audio.play();
  console.log("Timer finished sound!"); // Placeholder for notification sound
}

// Function to show/hide the timer panel
function togglePomodoroDisplay(show) {
  if (show) {
    pomodoroTimer.classList.remove('hidden');
    // Ensure timer display is correct when shown (e.g., if it was reset while hidden)
    if (!isRunning) {
      updateTimerDisplay();
    }
  } else {
    pomodoroTimer.classList.add('hidden');
    pauseTimer(); // Pause if hidden
    resetTimer(); // Reset if hidden
  }
}


// --- Theme Toggling Logic ---
function applyTheme(theme) {
  if (theme === "dark") {
    body.classList.add("dark");
    body.classList.remove("light");
    toggleBtn.innerHTML = '☀️ Light Mode'; // Using innerHTML for emoji
  } else {
    body.classList.add("light");
    body.classList.remove("dark");
    toggleBtn.innerHTML = '🌙 Dark Mode'; // Using innerHTML for emoji
  }
}

// --- Page Turning Logic ---
function showPage(pageName) {
  if (pageName === 'mainTask') {
    bookContainer.classList.remove('show-right');
    bookContainer.classList.add('show-left');
    // Set active styles for "Today's Task" button
    showMainTaskBtn.classList.add('bg-blue-400', 'text-white', 'hover:bg-blue-500');
    showMainTaskBtn.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-50', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
  } else if (pageName === 'allTasks') {
    bookContainer.classList.remove('show-left');
    bookContainer.classList.add('show-right');
    // Set active styles for "All Tasks" button
    showAllTasksBtn.classList.add('bg-blue-400', 'text-white', 'hover:bg-blue-500');
    showAllTasksBtn.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-50', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
  }
  // Remove active styles from the other button regardless of which page is selected
  if (pageName === 'mainTask') {
    showAllTasksBtn.classList.remove('bg-blue-400', 'text-white', 'hover:bg-blue-500');
    showAllTasksBtn.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-50', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
  } else {
    showMainTaskBtn.classList.remove('bg-blue-400', 'text-white', 'hover:bg-blue-500');
    showMainTaskBtn.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-50', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
  }
}


// --- Event Listeners ---
// Left Panel (Main Task) event listener for input
taskInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addMainTask();
  }
});

// "Add Step" button for main task
addStepBtn.onclick = showStepForm;

// "Mark Done" button for main task
markDoneBtn.onclick = markMainTaskDone;

// Step form submission for main task
stepForm.onsubmit = (e) => {
  e.preventDefault();
  submitStep();
};

// Theme toggle button
toggleBtn.addEventListener("click", () => {
  if (body.classList.contains("dark")) {
    applyTheme("light");
    localStorage.setItem("theme", "light");
  } else {
    applyTheme("dark");
    localStorage.setItem("theme", "dark");
  }
});

// Page turning navigation buttons
showMainTaskBtn.addEventListener('click', () => showPage('mainTask'));
showAllTasksBtn.addEventListener('click', () => showPage('allTasks'));

// Pomodoro Timer Event Listeners
startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);


// --- Initial Setup on DOM Load ---
document.addEventListener("DOMContentLoaded", () => {
  // Apply saved theme or system preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }

  // Render initial tasks and set initial page view
  renderMainTask();
  renderTasksOnRightPanel();
  showPage('mainTask'); // Default to showing the "Today's Task" page on load

  updateMainTaskProgressBar(); // <--- This ensures the progress bar is shown/updated on load
});
