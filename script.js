const taskInput = document.getElementById("taskInput");
const taskPage = document.getElementById("taskPage");
let tasks = [];

const storedTasks = localStorage.getItem("tasks");
if (storedTasks) {
  tasks = JSON.parse(storedTasks);
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

const tips = [
  // (same tips array as before)
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
  };

  tasks.unshift(task);
  saveTasks(); // <--- Save after adding
  taskInput2.value = "";

  renderTasksOnRightPanel();
}

function renderTasksOnRightPanel() {
  taskPage.innerHTML = "";

  if (tasks.length === 0) {
    const noTaskMessage = document.createElement("p");
    noTaskMessage.classList.add("italic");
    noTaskMessage.textContent = "No task selected yet.";
    taskPage.appendChild(noTaskMessage);
    return;
  }

  tasks.forEach((task) => {
    const newTaskDiv = document.createElement("div");
    newTaskDiv.classList.add(
      "task-item", "p-3", "rounded-lg", "shadow-sm",
      "flex", "items-center", "justify-between"
    );

    const titleSpan = document.createElement("span");
    titleSpan.textContent = task.title;
    titleSpan.classList.add("cursor-pointer", "hover:underline");
    titleSpan.onclick = () => openTaskPage(task.id);

    const removeBtn = document.createElement("button");
    removeBtn.classList.add("px-2", "py-1", "rounded", "hover:bg-red-400", "btn-red");
    removeBtn.textContent = "Done";
    removeBtn.onclick = () => removeTask(task.id);

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
  }
}

function displayRandomTip(tipContainerId) {
  const tipContainer = document.getElementById(tipContainerId);
  if (!tipContainer) return;

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  tipContainer.innerHTML = `<strong class="font-bold">💡 Tip:</strong> ${randomTip} <span id="newTipBtn" class="ml-2 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">Get another tip!</span>`;

  document.getElementById('newTipBtn').onclick = () => displayRandomTip(tipContainerId);
}

function openTaskPage(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;

  taskPage.innerHTML = "";

  const title = document.createElement("h2");
  title.classList.add("text-xl", "font-semibold", "mb-2");
  title.textContent = task.title;

  const backButton = document.createElement("button");
  backButton.classList.add("mb-4", "text-sm", "text-blue-500", "hover:underline");
  backButton.textContent = "← Back to All Tasks";
  backButton.onclick = renderTasksOnRightPanel;

  const tipDiv = document.createElement("div");
  tipDiv.id = "currentTaskTip";
  tipDiv.classList.add("bg-yellow-100", "dark:bg-yellow-800", "p-3", "rounded-lg", "mb-4", "text-sm", "text-yellow-800", "dark:text-yellow-200");

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
  addButton.classList.add("px-3", "py-1", "bg-green-500", "text-white", "rounded", "hover:bg-green-600");

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
  displayRandomTip('currentTaskTip');
}

function renderSubtaskList(task) {
  const list = document.getElementById("subtaskList");
  list.innerHTML = "";
  task.subtasks.forEach((sub) => {
    const li = document.createElement("li");
    li.textContent = sub;
    list.appendChild(li);
  });
}

function showStepForm() {
  document.getElementById("stepForm").classList.remove("hidden");
  document.getElementById("stepInput").focus();
}

function submitStep() {
  const input = document.getElementById("stepInput");
  const value = input.value.trim();
  if (!value) return;

  const li = document.createElement("li");
  li.textContent = value;
  document.getElementById("stepList").appendChild(li);

  input.value = "";
  input.focus();
}

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
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  renderTasksOnRightPanel();
});

toggleBtn.addEventListener("click", () => {
  if (body.classList.contains("dark")) {
    applyTheme('light');
    localStorage.setItem('theme', 'light');
  } else {
    applyTheme('dark');
    localStorage.setItem('theme', 'dark');
  }
});
