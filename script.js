const taskInput = document.getElementById("taskInput");
const taskPage = document.getElementById("taskPage");
let tasks = [];
let mainTask = null; // Variable to hold the reference to today's most important task

const storedTasks = localStorage.getItem("tasks");
if (storedTasks) {
  tasks = JSON.parse(storedTasks).map((task) => ({
    ...task,
    done: task.done || false,
    isMainTask: task.isMainTask || false, // Ensure isMainTask property exists
  }));
  // Find the main task if it exists
  mainTask = tasks.find((task) => task.isMainTask);
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

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

function findTaskById(taskId) {
  return tasks.find((t) => t.id === taskId);
}

function addTask() {
  const taskInput2 = document.getElementById("taskInput2");
  const title = taskInput2.value.trim();
  if (!title) return;

  const task = {
    id: Date.now(),
    title: title,
    subtasks: [],
    done: false,
    isMainTask: false, // Default to false for tasks added via the right panel
  };

  tasks.unshift(task);
  saveTasks(); // <--- Save after adding
  taskInput2.value = "";

  renderTasksOnRightPanel();
}

function renderTasksOnRightPanel() {
  taskPage.innerHTML = "";

  // Filter out the main task if it exists and is not done, otherwise include it in the right panel
  const tasksToRender = tasks.filter(
    (task) => !task.isMainTask || (task.isMainTask && task.done)
  );

  if (tasksToRender.length === 0) {
    const noTaskMessage = document.createElement("p");
    noTaskMessage.classList.add("italic");
    noTaskMessage.textContent = "No task selected yet.";
    taskPage.appendChild(noTaskMessage);
    return;
  }

  tasksToRender.forEach((task) => {
    if (task.done) return;
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
      task.done = true;
      saveTasks(); // <--- Save after marking as done
      renderTasksOnRightPanel();
      renderMainTask(); // Re-render main task panel in case it was the main task
    };

    newTaskDiv.appendChild(titleSpan);
    newTaskDiv.appendChild(removeBtn);

    taskPage.appendChild(newTaskDiv);
  });
}

function removeTask(taskId) {
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex > -1) {
    tasks.splice(taskIndex, 1);
    saveTasks(); // <--- Save after removing
    renderTasksOnRightPanel();
    renderMainTask(); // Re-render main task panel in case it was the main task
  }
}

function displayRandomTip(tipContainerId) {
  const tipContainer = document.getElementById(tipContainerId);
  if (!tipContainer) return;

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  tipContainer.innerHTML = `<strong class="font-bold">💡 Tip:</strong> ${randomTip} <span id="newTipBtn" class="ml-2 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">Get another tip!</span>`;

  document.getElementById("newTipBtn").onclick = () =>
    displayRandomTip(tipContainerId);
}

function openTaskPage(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;

  taskPage.innerHTML = "";

  const title = document.createElement("h2");
  title.classList.add("text-xl", "font-semibold", "mb-2");
  title.textContent = task.title;

  const backButton = document.createElement("button");
  backButton.classList.add(
    "mb-4",
    "text-sm",
    "text-blue-500",
    "hover:underline"
  );
  backButton.textContent = "← Back to All Tasks";
  backButton.onclick = renderTasksOnRightPanel;

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
    task.subtasks.push(text);
    saveTasks(); // <--- Save after adding subtask
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
  if (!list) return; // Ensure the list element exists
  list.innerHTML = "";
  task.subtasks.forEach((sub) => {
    const li = document.createElement("li");
    li.textContent = sub;
    list.appendChild(li);
  });
}

// --- Functions for Today's Most Important Task (Left Panel) ---
const mainTaskInput = document.getElementById("taskInput");
const stepList = document.getElementById("stepList");
const stepForm = document.getElementById("stepForm");
const stepInput = document.getElementById("stepInput");
const addStepBtn = document.querySelector(".btn-yellow");
const markDoneBtn = document.querySelector(".btn-pink");

function renderMainTask() {
  if (mainTask && !mainTask.done) {
    taskInput.value = mainTask.title;
    taskInput.disabled = true; // Disable input when task is set
    addStepBtn.style.display = "block"; // Show "Add Step" button
    markDoneBtn.style.display = "block"; // Show "Mark Done" button
    renderMainTaskSteps();
  } else {
    taskInput.value = "";
    taskInput.disabled = false; // Enable input when no task or task is done
    stepList.innerHTML = "";
    stepForm.classList.add("hidden");
    // Optionally hide "Add Step" and "Mark Done" buttons if no main task
    addStepBtn.style.display = "none";
    markDoneBtn.style.display = "none";
  }
}

function addMainTask() {
  const title = mainTaskInput.value.trim();
  if (!title) return;

  // If a main task already exists and is not done, don't create a new one
  if (mainTask && !mainTask.done) {
    alert("Please mark the current main task as done before adding a new one.");
    return;
  }

  // If there's an old main task that's done, update its `isMainTask` to false
  // and then create a new one. This ensures only one active main task.
  if (mainTask && mainTask.done) {
    mainTask.isMainTask = false;
  }

  mainTask = {
    id: Date.now(),
    title: title,
    subtasks: [],
    done: false,
    isMainTask: true,
  };
  tasks.unshift(mainTask); // Add to the beginning of the tasks array
  saveTasks();
  renderMainTask(); // Render the left panel with the new main task
  renderTasksOnRightPanel(); // Update right panel (it should not show the active main task)
}

function renderMainTaskSteps() {
  stepList.innerHTML = "";
  if (mainTask && mainTask.subtasks.length > 0) {
    mainTask.subtasks.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      stepList.appendChild(li);
    });
  }
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
  if (!mainTask) return; // Should not happen if showStepForm is called correctly

  const value = stepInput.value.trim();
  if (!value) return;

  mainTask.subtasks.push(value);
  saveTasks();
  renderMainTaskSteps();

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
}

// Event Listeners for the Left Panel
taskInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addMainTask();
  }
});

// Re-assign onclick for the Add Step button - it's outside the stepForm 
addStepBtn.onclick = showStepForm;

// Assign onclick for Mark Done button
markDoneBtn.onclick = markMainTaskDone;

// Assign onsubmit for the step form inside showStepForm (already done, but reiterating)
stepForm.onsubmit = (e) => {
  e.preventDefault();
  submitStep();
};

const body = document.body;
const toggleBtn = document.getElementById("toggleDark");

function applyTheme(theme) {
  if (theme === "dark") {
    body.classList.add("dark");
    body.classList.remove("light");
    toggleBtn.textContent = "☀️ Light Mode";
  } else {
    body.classList.add("light");
    body.classList.remove("dark");
    toggleBtn.textContent = "🌙 Dark Mode";
  }
}

document.addEventListener("DOMContentLoaded", () => {
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

  renderMainTask(); // Render the main task on page load
  renderTasksOnRightPanel(); // Render other tasks on page load
});

toggleBtn.addEventListener("click", () => {
  if (body.classList.contains("dark")) {
    applyTheme("light");
    localStorage.setItem("theme", "light");
  } else {
    applyTheme("dark");
    localStorage.setItem("theme", "dark");
  }
});
