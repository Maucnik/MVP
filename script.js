const API_BASE_URL = "http://localhost:3000/api"; // Base URL for API requests

// 1. Load the IFrame Player API code asynchronously.
const tag = document.createElement("script");
// CORRECTED YOUTUBE API URL:
tag.src = "https://www.youtube.com/iframe_api"; // This is the official YouTube IFrame Player API URL
const firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Global player variable
let player;
let musicPlaylist = [];
let currentTuneIndex = -1;

// 2. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    // 'player' is the ID of the div where the player will be inserted
    height: "100%", // Use percentages for responsive sizing
    width: "100%",
    videoId:
      musicPlaylist.length > 0 ? musicPlaylist[currentTuneIndex].videoId : "", // Load first video if playlist exists
    playerVars: {
      playsinline: 1,
      autoplay: 0, // Don't autoplay on load
      controls: 1,
      showinfo: 0,
      rel: 0, // Prevent related videos
      modestbranding: 1, // No YouTube logo
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

// 3. The API will call this function when the video player is ready.
function onPlayerReady(event) {
  // Player is ready, you can now interact with it
  console.log("YouTube player is ready.");
  if (musicPlaylist.length > 0 && currentTuneIndex !== -1) {
    // Only load and play if a tune is selected
    event.target.loadVideoById(musicPlaylist[currentTuneIndex].videoId);
  }
}

// 4. The API calls this function whenever the player's state changes.
function onPlayerStateChange(event) {
  // event.data contains the new state
  // YT.PlayerState.ENDED (0), YT.PlayerState.PLAYING (1), YT.PlayerState.PAUSED (2), etc.
  if (event.data === YT.PlayerState.ENDED) {
    nextTune(); // Play next tune when current one ends
  }
}

// Helper to extract YouTube video ID
// Helper function to extract YouTube video ID from a URL
function getYouTubeVideoId(url) {
  let videoId = "";
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Shortened youtu.be URL: https://youtu.be/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
    /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Short URL after share: https://youtube.com/shorts/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      videoId = match[1];
      break; // Found a match, no need to check other patterns
    }
  }
  return videoId;
}

// --- DOM Elements ---
const toggleDarkBtn = document.getElementById("toggleDark");
const showMainTaskBtn = document.getElementById("showMainTaskBtn");
const showAllTasksBtn = document.getElementById("showAllTasksBtn");
const bookContainer = document.querySelector(".book-container");
const taskInput = document.getElementById("taskInput"); // For main task
const stepInput = document.getElementById("stepInput");
const stepList = document.getElementById("stepList");
const stepForm = document.getElementById("stepForm");
const taskInput2 = document.getElementById("taskInput2"); // For adding tasks on All Tasks page
const taskList = document.getElementById("taskList");
const pomodoroTimer = document.getElementById("pomodoroTimer");
const countdownDisplay = document.getElementById("countdown");
const timerStatusDisplay = document.getElementById("timerStatus");
const startTimerBtn = document.getElementById("startTimerBtn");
const pauseTimerBtn = document.getElementById("pauseTimerBtn");
const resetTimerBtn = document.getElementById("resetTimerBtn");
const progressBarContainer = document.getElementById("progressBarContainer");
const progressBarFill = document.getElementById("progressBarFill");
const progressText = document.getElementById("progressText");
const youtubeUrlInput = document.getElementById("youtubeUrlInput");
const addTuneBtn = document.getElementById("addTuneBtn");
const playPauseTuneBtn = document.getElementById("playPauseTuneBtn");
const nextTuneBtn = document.getElementById("nextTuneBtn");
const prevTuneBtn = document.getElementById("prevTuneBtn");
const musicPlaylistUl = document.getElementById("musicPlaylist");
const playerPlaceholder = document.getElementById("playerPlaceholder");
const playlistPlaceholder = document.getElementById("playlistPlaceholder");

addTuneBtn.addEventListener("click", addTune); // Connects the button to the function

// Also ensure these listeners are present for music controls:
playPauseTuneBtn.addEventListener("click", togglePlayPauseTune);
nextTuneBtn.addEventListener("click", nextTune);
prevTuneBtn.addEventListener("click", prevTune);

let currentMainTask = null; // Stores the currently selected main task object
let pomodoroInterval;
let timeLeft = 25 * 60; // 25 minutes in seconds
let isPaused = true;
let isFocusTime = true;

// --- Theme Toggling ---
function applyTheme(theme) {
  document.body.className = theme;
  toggleDarkBtn.textContent =
    theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("theme", theme); // Save theme preference
}

toggleDarkBtn.addEventListener("click", () => {
  const currentTheme = document.body.className;
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

// --- Page Turning (UI only, no data logic here) ---
function showPage(page) {
  if (page === "mainTask") {
    bookContainer.classList.remove("show-right");
    bookContainer.classList.add("show-left");
    showMainTaskBtn.classList.add(
      "bg-pink-300",
      "dark:bg-pink-700",
      "text-pink-800",
      "dark:text-pink-100"
    );
    showMainTaskBtn.classList.remove(
      "bg-white",
      "dark:bg-gray-700",
      "text-gray-600",
      "dark:text-gray-300"
    );
    showAllTasksBtn.classList.remove(
      "bg-pink-300",
      "dark:bg-pink-700",
      "text-pink-800",
      "dark:text-pink-100"
    );
    showAllTasksBtn.classList.add(
      "bg-white",
      "dark:bg-gray-700",
      "text-gray-600",
      "dark:text-gray-300"
    );
  } else if (page === "allTasks") {
    bookContainer.classList.remove("show-left");
    bookContainer.classList.add("show-right");
    showAllTasksBtn.classList.add(
      "bg-pink-300",
      "dark:bg-pink-700",
      "text-pink-800",
      "dark:text-pink-100"
    );
    showAllTasksBtn.classList.remove(
      "bg-white",
      "dark:bg-gray-700",
      "text-gray-600",
      "dark:text-gray-300"
    );
    showMainTaskBtn.classList.remove(
      "bg-pink-300",
      "dark:bg-pink-700",
      "text-pink-800",
      "dark:text-pink-100"
    );
    showMainTaskBtn.classList.add(
      "bg-white",
      "dark:bg-gray-700",
      "text-gray-600",
      "dark:text-gray-300"
    );
  }
}

showMainTaskBtn.addEventListener("click", () => showPage("mainTask"));
showAllTasksBtn.addEventListener("click", () => showPage("allTasks"));

// --- Task Management Functions (Integrated with API) ---

// Fetches all tasks from the backend
async function fetchTasks() {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tasks = await response.json();
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

// Renders the main task on the left panel
async function renderMainTask() {
  const tasks = await fetchTasks();
  currentMainTask = tasks.find((task) => task.isMainTask) || null;

  if (currentMainTask) {
    taskInput.value = currentMainTask.title;
    stepList.innerHTML = ""; // Clear existing steps
    if (currentMainTask.subtasks && currentMainTask.subtasks.length > 0) {
      currentMainTask.subtasks.forEach((step) => {
        const li = document.createElement("li");
        li.className =
          "flex items-center justify-between gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded shadow";

        const stepText = document.createElement("span");
        stepText.textContent = step.text;
        stepText.className = "flex-1";
        if (step.completed) {
          stepText.classList.add(
            "line-through",
            "text-gray-500",
            "dark:text-gray-400"
          );
        }

        const btnDone = document.createElement("button");
        btnDone.textContent = step.completed ? "🔁 Undo" : "✅ Done";
        btnDone.className = "btn-yellow text-sm px-2 py-1 rounded";
        btnDone.addEventListener("click", () =>
          toggleStepComplete(currentMainTask.id, step.id)
        );

        async function deleteStep(taskId, stepId) {
  if (!currentMainTask || currentMainTask.id !== taskId) return;
  currentMainTask.subtasks = currentMainTask.subtasks.filter(step => step.id !== stepId);

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: currentMainTask.subtasks })
    });
    if (!response.ok) throw new Error('Error deleting step');
    await renderMainTask(); // Refresh steps
    updateMainTaskProgressBar();
  } catch (error) {
    console.error("Failed to delete step:", error);
  }
}

        const btnDelete = document.createElement("button");
        btnDelete.textContent = "🗑️ Delete";
        btnDelete.className = "btn-red text-sm px-2 py-1 rounded";
        btnDelete.addEventListener("click", () =>
          deleteStep(currentMainTask.id, step.id)
        );

        li.appendChild(stepText);
        li.appendChild(btnDone);
        li.appendChild(btnDelete);
        stepList.appendChild(li);
      });
      progressBarContainer.classList.remove("hidden");
    } else {
      stepList.innerHTML =
        '<p class="italic text-gray-600 dark:text-gray-400">No steps added for this task.</p>';
      progressBarContainer.classList.add("hidden");
    }
    pomodoroTimer.classList.remove("hidden"); // Show timer for main task
    updateMainTaskProgressBar(); // Update progress bar
  } else {
    taskInput.value = "";
    stepList.innerHTML =
      '<p class="italic text-gray-600 dark:text-gray-400">No main task selected. Add a new task!</p>';
    pomodoroTimer.classList.add("hidden"); // Hide timer if no main task
    progressBarContainer.classList.add("hidden");
  }
}

// Renders all tasks on the right panel
async function renderTasksOnRightPanel() {
  const tasks = await fetchTasks();
  taskList.innerHTML = ""; // Clear existing tasks

  if (tasks.length === 0) {
    taskList.innerHTML =
      '<p class="italic text-gray-600 dark:text-gray-400">No tasks added yet.</p>';
    return;
  }

  tasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className =
      "task-item p-4 rounded-xl shadow-sm flex items-center justify-between";
    taskElement.innerHTML = `
            <span class="${
              task.completed ? "line-through text-gray-500" : ""
            }">${task.title}</span>
            <div class="flex items-center gap-2">
                <input type="checkbox" data-id="${
                  task.id
                }" class="form-checkbox h-5 w-5 text-pink-600" ${
      task.completed ? "checked" : ""
    }>
                <button data-id="${
                  task.id
                }" class="btn-yellow px-3 py-1 rounded-md text-sm">Select</button>
                <button data-id="${
                  task.id
                }" class="btn-red px-3 py-1 rounded-md text-sm">Delete</button>
            </div>
        `;
    taskList.appendChild(taskElement);

    // Add event listeners for new elements
    taskElement
      .querySelector('input[type="checkbox"]')
      .addEventListener("change", (e) =>
        toggleTaskComplete(task.id, e.target.checked)
      );
    taskElement
      .querySelector(".btn-yellow")
      .addEventListener("click", () => selectMainTask(task.id));
    taskElement
      .querySelector(".btn-red")
      .addEventListener("click", () => deleteTask(task.id));
  });
}

// Add a new task (from right panel)
async function addTask() {
  const title = taskInput2.value.trim();
  if (title) {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          completed: false,
          isMainTask: false,
          subtasks: [],
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const newTask = await response.json();
      console.log("Task added:", newTask);
      taskInput2.value = ""; // Clear input
      await renderTasksOnRightPanel(); // Re-render the list
    } catch (error) {
      console.error("Error adding task:", error);
    }
  }
}

// Select a task as the main task (from right panel)
async function selectMainTask(taskId) {
  try {
    // First, deselect any existing main task
    const tasks = await fetchTasks();
    const oldMainTask = tasks.find((task) => task.isMainTask);
    if (oldMainTask && oldMainTask.id !== taskId) {
      await fetch(`${API_BASE_URL}/tasks/${oldMainTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMainTask: false }),
      });
    }
    // Then, set the new main task
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMainTask: true }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    await renderMainTask(); // Re-render main task on left panel
    await renderTasksOnRightPanel(); // Re-render all tasks on right panel
    showPage("mainTask"); // Switch to main task view
  } catch (error) {
    console.error("Error selecting main task:", error);
  }
}

// Delete a task
async function deleteTask(taskId) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("Task deleted successfully");
      if (currentMainTask && currentMainTask.id === taskId) {
        currentMainTask = null; // Clear main task if deleted
      }
      await renderMainTask(); // Update main task view
      await renderTasksOnRightPanel(); // Update all tasks view
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  }
}

// Toggle task completion (from right panel)
async function toggleTaskComplete(taskId, completed) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: completed }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // No need to re-render all, just update main task if it was affected
    if (currentMainTask && currentMainTask.id === taskId) {
      currentMainTask.completed = completed; // Update local state
      await renderMainTask(); // Re-render main task to reflect strike-through
    }
    await renderTasksOnRightPanel(); // Re-render to update UI immediately
  } catch (error) {
    console.error("Error toggling task completion:", error);
  }
}

// Show/hide step form for main task
function showStepForm() {
  if (currentMainTask) {
    stepForm.classList.remove("hidden");
  } else {
    alert("Please select or add a main task first!");
  }
}

const markDoneBtn = document.getElementById("markDoneBtn");
if (markDoneBtn) {
  markDoneBtn.addEventListener("click", async () => {
    if (!currentMainTask) return;
    const allCompleted = currentMainTask.subtasks.map((step) => ({
      ...step,
      completed: true,
    }));
    try {
      await fetch(`${API_BASE_URL}/tasks/${currentMainTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: allCompleted }),
      });
      currentMainTask.subtasks = allCompleted;
      await renderMainTask();
      updateMainTaskProgressBar();
    } catch (error) {
      console.error("Failed to mark all steps done:", error);
    }
  });
}

// Add a step to the main task
async function submitStep() {
  if (!currentMainTask) {
    alert("Please select a main task first!");
    return;
  }
  const stepText = stepInput.value.trim();
  if (stepText) {
    const newStep = { id: Date.now(), text: stepText, completed: false }; // Simple ID for steps
    currentMainTask.subtasks.push(newStep);
    try {
      const response = await fetch(
        `${API_BASE_URL}/tasks/${currentMainTask.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtasks: currentMainTask.subtasks }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      stepInput.value = ""; // Clear input
      await renderMainTask(); // Re-render main task to show new step
      updateMainTaskProgressBar(); // Update progress bar
    } catch (error) {
      console.error("Error adding step:", error);
    }
  }
}

// Toggle step completion for the main task
async function toggleStepComplete(taskId, stepId) {
  if (!currentMainTask || currentMainTask.id !== taskId) {
    console.error("Main task not found or mismatch!");
    return;
  }
  const stepIndex = currentMainTask.subtasks.findIndex(
    (step) => step.id === stepId
  );
  if (stepIndex > -1) {
    currentMainTask.subtasks[stepIndex].completed =
      !currentMainTask.subtasks[stepIndex].completed;
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: currentMainTask.subtasks }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      await renderMainTask(); // Re-render to update UI
      updateMainTaskProgressBar(); // Update progress bar
    } catch (error) {
      console.error("Error toggling step completion:", error);
    }
  }
}

// Update progress bar for main task
function updateMainTaskProgressBar() {
  if (
    currentMainTask &&
    currentMainTask.subtasks &&
    currentMainTask.subtasks.length > 0
  ) {
    const completedSteps = currentMainTask.subtasks.filter(
      (step) => step.completed
    ).length;
    const totalSteps = currentMainTask.subtasks.length;
    const progress = (completedSteps / totalSteps) * 100;
    progressBarFill.style.width = `${progress}%`;
    progressText.textContent = `${completedSteps}/${totalSteps} Steps Completed`;
    progressBarContainer.classList.remove("hidden");
  } else {
    progressBarFill.style.width = "0%";
    progressText.textContent = "0/0 Steps Completed";
    progressBarContainer.classList.add("hidden");
  }
}

// --- Pomodoro Timer Functions ---
function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  countdownDisplay.textContent = `${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function startTimer() {
  if (isPaused && timeLeft > 0) {
    isPaused = false;
    timerStatusDisplay.textContent = isFocusTime
      ? "Focus Time!"
      : "Break Time!";
    pomodoroInterval = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(pomodoroInterval);
        isPaused = true;
        // Play a sound or alert
        alert(
          isFocusTime
            ? "Focus Time Ended! Take a break."
            : "Break Ended! Back to work."
        );
        isFocusTime = !isFocusTime; // Toggle between focus and break
        timeLeft = isFocusTime ? 25 * 60 : 5 * 60; // 25 min focus, 5 min break
        timerStatusDisplay.textContent = "Ready?";
        updateTimerDisplay();
      }
    }, 1000);
  }
}

function pauseTimer() {
  isPaused = true;
  clearInterval(pomodoroInterval);
  timerStatusDisplay.textContent = "Paused";
}

function resetTimer() {
  clearInterval(pomodoroInterval);
  isPaused = true;
  isFocusTime = true;
  timeLeft = 25 * 60;
  updateTimerDisplay();
  timerStatusDisplay.textContent = "Ready?";
}

// --- Music Player Functions (Integrated with API) ---

// Fetches all tunes from the backend
async function fetchTunes() {
  try {
    const response = await fetch(`${API_BASE_URL}/tunes`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tunes = await response.json();
    return tunes;
  } catch (error) {
    console.error("Error fetching tunes:", error);
    return [];
  }
}

// Renders the music playlist
async function renderMusicPlaylist() {
  musicPlaylist = await fetchTunes();
  musicPlaylistUl.innerHTML = ""; // Clear existing list

  if (musicPlaylist.length === 0) {
    musicPlaylistUl.innerHTML =
      '<p class="text-gray-600 dark:text-gray-400 text-center">Your playlist is empty. Add a YouTube URL!</p>';
    // Hide player and controls if playlist is empty
    playerPlaceholder.classList.add("hidden");
    playlistPlaceholder.classList.add("hidden");
    return;
  } else {
    playerPlaceholder.classList.remove("hidden");
    playlistPlaceholder.classList.remove("hidden");
  }

  musicPlaylist.forEach((tune, index) => {
    const li = document.createElement("li");
    li.className = `flex items-center justify-between p-2 rounded-md ${
      index === currentTuneIndex ? "bg-purple-200 dark:bg-purple-700" : ""
    }`;
    li.innerHTML = `
            <span class="tune-title-editable flex-1 cursor-pointer truncate mr-2 ${
              index === currentTuneIndex ? "font-bold" : ""
            }">${tune.title || "Unknown Title"}</span>
            <div class="flex items-center gap-2">
                <button data-id="${
                  tune.id
                }" data-index="${index}" class="play-tune-btn btn-purple px-2 py-1 rounded-md text-sm">▶️ Play</button>
                <button data-id="${
                  tune.id
                }" class="delete-tune-btn btn-red px-2 py-1 rounded-md text-sm">🗑️</button>
            </div>
        `;
    musicPlaylistUl.appendChild(li);

    li.querySelector(".play-tune-btn").addEventListener("click", (e) => {
      const tuneIndex = parseInt(e.target.dataset.index);
      playTune(tuneIndex);
    });
    li.querySelector(".delete-tune-btn").addEventListener("click", () =>
      deleteTune(tune.id)
    );

    // Event listener for editing the tune title
    const tuneTitleSpan = li.querySelector(".tune-title-editable");
    tuneTitleSpan.addEventListener("dblclick", () => {
      const currentTitle = tuneTitleSpan.textContent;
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentTitle;
      input.className =
        "w-full px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white";

      tuneTitleSpan.replaceWith(input);
      input.focus();

      const saveTitle = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
          await updateTuneTitle(tune.id, newTitle); // This calls the global function
        }
        renderMusicPlaylist(); // Re-render to update the title immediately
      };

      input.addEventListener("blur", saveTitle);
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          input.blur(); // Trigger blur to save
        }
      });
    });
  });

  // If a tune is currently selected, ensure it's loaded in the player
  if (player && musicPlaylist.length > 0 && currentTuneIndex !== -1) {
    player.loadVideoById(musicPlaylist[currentTuneIndex].videoId);
  }
  updatePlayerControls(); // Update controls based on playlist state
}

async function addTune() {
  const youtubeUrl = youtubeUrlInput.value.trim();
  if (youtubeUrl) {
    const videoId = getYouTubeVideoId(youtubeUrl);
    if (videoId) {
      try {
        // Fetch video details to get the title
        const response = await fetch(
          `https://noembed.com/embed?url=${youtubeUrl}`
        );
        const data = await response.json();
        const title = data.title || "YouTube Tune"; // Default title if not found

        const addResponse = await fetch(`${API_BASE_URL}/tunes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoId, title }), // Send videoId and fetched title
        });

        if (!addResponse.ok) {
          throw new Error(`HTTP error! status: ${addResponse.status}`);
        }
        const newTune = await addResponse.json();
        console.log("Tune added:", newTune);
        youtubeUrlInput.value = ""; // Clear input

        // If this is the first tune, set it as current
        if (musicPlaylist.length === 0) {
          currentTuneIndex = 0;
        }
        await renderMusicPlaylist(); // Re-render the playlist

        // If player is ready and a tune is selected, load/play it
        if (player && musicPlaylist.length > 0 && currentTuneIndex !== -1) {
          player.loadVideoById(musicPlaylist[currentTuneIndex].videoId);
          player.playVideo(); // Auto-play the newly added tune
        }
        updatePlayerControls(); // Update controls
      } catch (error) {
        console.error("Error adding tune:", error);
        alert("Failed to add tune. Please check the URL and try again.");
      }
    } else {
      alert("Please enter a valid YouTube URL.");
    }
  }
}

function playTune(index) {
  if (index >= 0 && index < musicPlaylist.length) {
    currentTuneIndex = index;
    if (player) {
      player.loadVideoById(musicPlaylist[currentTuneIndex].videoId);
      player.playVideo();
    }
    renderMusicPlaylist(); // Re-render to highlight current tune
    updatePlayerControls();
  }
}

function togglePlayPauseTune() {
  if (!player || musicPlaylist.length === 0 || currentTuneIndex === -1) return;

  const playerState = player.getPlayerState();
  if (playerState === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
  updatePlayerControls();
}

function nextTune() {
  if (musicPlaylist.length === 0) return;

  currentTuneIndex = (currentTuneIndex + 1) % musicPlaylist.length;
  playTune(currentTuneIndex);
}

function prevTune() {
  if (musicPlaylist.length === 0) return;

  currentTuneIndex =
    (currentTuneIndex - 1 + musicPlaylist.length) % musicPlaylist.length;
  playTune(currentTuneIndex);
}

function updatePlayerControls() {
  const isPlaylistEmpty = musicPlaylist.length === 0;
  const isTuneSelected = currentTuneIndex !== -1;

  playPauseTuneBtn.disabled = isPlaylistEmpty;
  nextTuneBtn.disabled = isPlaylistEmpty;
  prevTuneBtn.disabled = isPlaylistEmpty;

  if (player && isTuneSelected) {
    const playerState = player.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
      playPauseTuneBtn.innerHTML = "⏸️ Pause";
    } else {
      playPauseTuneBtn.innerHTML = "▶️ Play";
    }
  } else {
    playPauseTuneBtn.innerHTML = "▶️ Play";
  }
}

async function deleteTune(tuneId) {
  if (confirm("Are you sure you want to remove this tune from the playlist?")) {
    try {
      const response = await fetch(`${API_BASE_URL}/tunes/${tuneId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("Tune deleted successfully");

      const deletedIndex = musicPlaylist.findIndex(
        (tune) => tune.id === tuneId
      );
      if (deletedIndex !== -1) {
        musicPlaylist.splice(deletedIndex, 1); // Remove from local array

        if (deletedIndex === currentTuneIndex) {
          // If the current playing tune was deleted
          if (musicPlaylist.length > 0) {
            // Try to play the next tune, or the first if it was the last one
            currentTuneIndex = Math.min(deletedIndex, musicPlaylist.length - 1); // Stay at same index or last
            if (player && typeof player.loadVideoById === "function") {
              // Ensure player methods exist
              player.loadVideoById(musicPlaylist[currentTuneIndex].videoId);
              player.playVideo(); // Continue playing if there are still tunes
            } else {
              playTune(currentTuneIndex); // Fallback to playTune
            }
          } else {
            if (player && typeof player.stopVideo === "function") {
              player.stopVideo();
            }
            currentTuneIndex = -1;
          }
        } else if (deletedIndex < currentTuneIndex) {
          // If a tune before the current one was deleted, adjust currentTuneIndex
          currentTuneIndex--;
        }
      }

      await renderMusicPlaylist(); // Re-render the playlist
      updatePlayerControls(); // Ensure controls are correctly enabled/disabled
    } catch (error) {
      console.error("Error deleting tune:", error);
    }
  }
}

// === START OF MOVED FUNCTION ===
// Function to update a tune's title (MOVED TO GLOBAL SCOPE)
async function updateTuneTitle(tuneId, newTitle) {
  try {
    const response = await fetch(`${API_BASE_URL}/tunes/${tuneId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: newTitle }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const updatedTune = await response.json();
    console.log("Tune title updated successfully:", updatedTune);

    // Update the tune in the local musicPlaylist array
    const tuneIndex = musicPlaylist.findIndex((tune) => tune.id === tuneId);
    if (tuneIndex > -1) {
      musicPlaylist[tuneIndex].title = updatedTune.title;
    }
  } catch (error) {
    console.error("Error updating tune title:", error);
    alert("Failed to update tune title. Check console for details.");
  }
}
// === END OF MOVED FUNCTION ===

// --- Initial Setup on DOM Load ---
document.addEventListener("DOMContentLoaded", async () => {
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

  // Render initial tasks and tunes from the backend
  await renderMainTask();
  await renderTasksOnRightPanel();
  await renderMusicPlaylist(); // Fetch and render tunes on load

  showPage("mainTask"); // Default to showing the "Today's Task" page on load

  updateMainTaskProgressBar();
});
