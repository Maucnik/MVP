require("dotenv").config();
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs'); // For password hashing

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose(); // Import sqlite3
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..")));
app.get("/api/test", (req, res) => { // Changed the path to avoid conflict
  res.send("Task Buddy Backend (SQLite) is running!");
});

// Middleware
app.use(express.json()); // Allows Express to parse JSON bodies from requests
app.use(cors()); // Enable CORS for all routes

app.use(cookieParser()); // Required for express-session

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 * 7 // Session lasts 1 week (milliseconds)
    }
}));

// --- Database Setup ---
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to the SQLite database.");
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error("Error creating users table:", err.message);
            } else {
                console.log("Users table ensured.");
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT 0,
                isMainTask BOOLEAN NOT NULL DEFAULT 0,
                subtasks TEXT DEFAULT '[]', -- Stored as JSON string
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME DEFAULT NULL,
                main_task_id INTEGER, -- For subtasks, links to their main task
                parent_id INTEGER, -- For subtasks, links to their immediate parent task
                recurrence_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'
                recurrence_interval INTEGER NOT NULL DEFAULT 0, -- e.g., every 2 days, every 3 weeks
                recurrence_details TEXT DEFAULT '{}', -- Stored as JSON string (e.g., { "daysOfWeek": ["Monday", "Wednesday"] })
                original_task_id INTEGER, -- Links generated recurring tasks back to their original template
                next_occurrence_date DATETIME DEFAULT NULL, -- Date for the next recurrence to be created
                end_recurrence_date DATETIME DEFAULT NULL, -- Date when recurrence should stop
                FOREIGN KEY (main_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (original_task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error("Error creating tasks table:", err.message);
            } else {
                console.log("Tasks table ensured.");
            }
        });
        // Inside the db.open callback, after tasks table creation
db.run(`
    CREATE TABLE IF NOT EXISTS tunes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT,
        videoId TEXT UNIQUE
    )
`, (err) => {
    if (err) {
        console.error("Error creating tunes table:", err.message);
    } else {
        console.log("Tunes table ensured.");
    }
});
    }
});


// --- Helper Middleware to get a task by ID ---
function getTask(req, res, next) {
    db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            console.error("❌ DB error in getTask:", err.message);
            return res.status(500).json({ message: err.message });
        }

        if (!row) {
            return res.status(404).json({ message: 'Cannot find task' });
        }

        // 💡 Safe JSON.parse helper
        function safeParse(value, fallback) {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.warn(`⚠️ Failed to parse JSON for task ${req.params.id}:`, e.message);
                return fallback;
            }
        }

        // ✅ Safe parsing & conversion
        row.subtasks = safeParse(row.subtasks, []);
        row.recurrence_details = safeParse(row.recurrence_details, {});
        row.completed = Boolean(row.completed);
        row.isMainTask = Boolean(row.isMainTask);

        res.task = row; // Attach the fetched and parsed task to the response object
        next(); // Proceed to the next middleware or route handler
    });
}

// --- Recurrence Generation Function (Backend Logic) ---
async function generateRecurringTasks() {
    console.log("Checking for recurring tasks to generate...");
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of today

    db.all(`SELECT * FROM tasks WHERE recurrence_type != 'none' AND next_occurrence_date <= ?`, [today.toISOString()], async (err, tasksToGenerate) => {
        if (err) {
            console.error("Error fetching tasks for recurrence generation:", err.message);
            return;
        }

        for (const task of tasksToGenerate) {
            const originalTask = task; // Keep a reference to the task template
            let nextOccurrence = new Date(originalTask.next_occurrence_date);
            nextOccurrence.setHours(0,0,0,0); // Normalize next_occurrence_date

            // Skip if the end recurrence date is in the past
            if (originalTask.end_recurrence_date && new Date(originalTask.end_recurrence_date) < today) {
                console.log(`Recurrence ended for task ${originalTask.id}: ${originalTask.title}`);
                // Optionally, update recurrence_type to 'none' or delete the template task
                db.run(`UPDATE tasks SET recurrence_type = 'none' WHERE id = ?`, [originalTask.id]);
                continue; // Move to the next task
            }

            // Generate occurrences until next_occurrence_date is in the future
            while (nextOccurrence <= today || (originalTask.recurrence_type === 'daily' && nextOccurrence.toDateString() === today.toDateString())) {
                if (nextOccurrence.toDateString() === today.toDateString() || nextOccurrence < today) { // Generate if today or past
                    const newTaskTitle = originalTask.title; // You can customize this, e.g., "Daily Task (Mon)"
                    const newTaskData = {
                        title: newTaskTitle,
                        completed: false, // New occurrences are not completed
                        isMainTask: originalTask.isMainTask,
                        subtasks: JSON.stringify([]), // New occurrences start with no subtasks unless copied from original
                        main_task_id: null,
                        parent_id: null,
                        recurrence_type: 'none', // Generated tasks are not recurring
                        recurrence_interval: 0,
                        recurrence_details: '{}',
                        original_task_id: originalTask.id, // Link to the original recurring task
                        next_occurrence_date: null,
                        end_recurrence_date: null
                    };

                    db.run(`INSERT INTO tasks (title, completed, isMainTask, subtasks, main_task_id, parent_id, recurrence_type, recurrence_interval, recurrence_details, original_task_id, next_occurrence_date, end_recurrence_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [newTaskData.title, newTaskData.completed ? 1 : 0, newTaskData.isMainTask ? 1 : 0, newTaskData.subtasks, newTaskData.main_task_id, newTaskData.parent_id, newTaskData.recurrence_type, newTaskData.recurrence_interval, newTaskData.recurrence_details, newTaskData.original_task_id, newTaskData.next_occurrence_date, newTaskData.end_recurrence_date],
                        function (err) {
                            if (err) {
                                console.error(`Error creating recurring task for ${originalTask.title}:`, err.message);
                            } else {
                                console.log(`Generated new task "${newTaskTitle}" from recurring task ${originalTask.id}.`);
                            }
                        }
                    );
                }

                // Calculate the next occurrence date for the template
                switch (originalTask.recurrence_type) {
                    case 'daily':
                        nextOccurrence.setDate(nextOccurrence.getDate() + (originalTask.recurrence_interval > 0 ? originalTask.recurrence_interval : 1));
                        break;
                    case 'weekly':
                        nextOccurrence.setDate(nextOccurrence.getDate() + (originalTask.recurrence_interval > 0 ? originalTask.recurrence_interval * 7 : 7));
                        break;
                    case 'monthly':
                        nextOccurrence.setMonth(nextOccurrence.getMonth() + (originalTask.recurrence_interval > 0 ? originalTask.recurrence_interval : 1));
                        break;
                    case 'yearly':
                        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + (originalTask.recurrence_interval > 0 ? originalTask.recurrence_interval : 1));
                        break;
                    case 'custom':
                        // For custom recurrence like specific days of week
                        const details = JSON.parse(originalTask.recurrence_details || '{}');
                        const daysOfWeek = details.daysOfWeek || []; // e.g., ["Monday", "Wednesday"]
                        if (daysOfWeek.length > 0) {
                            let foundNextDay = false;
                            let tempDate = new Date(nextOccurrence);
                            tempDate.setDate(tempDate.getDate() + 1); // Start checking from next day

                            for (let i = 0; i < 7 && !foundNextDay; i++) { // Check up to 7 days
                                const dayName = tempDate.toLocaleDateString('en-US', { weekday: 'long' });
                                if (daysOfWeek.includes(dayName)) {
                                    nextOccurrence = tempDate;
                                    foundNextDay = true;
                                } else {
                                    tempDate.setDate(tempDate.getDate() + 1);
                                }
                            }
                            if (!foundNextDay) { // If no day found in current week, advance by a week
                                nextOccurrence.setDate(nextOccurrence.getDate() + 7);
                                // Then find the first day of week recurrence in that new week
                                let firstDayFound = false;
                                let tempDateNewWeek = new Date(nextOccurrence);
                                while (!firstDayFound) {
                                    const dayName = tempDateNewWeek.toLocaleDateString('en-US', { weekday: 'long' });
                                    if (daysOfWeek.includes(dayName)) {
                                        nextOccurrence = tempDateNewWeek;
                                        firstDayFound = true;
                                    } else {
                                        tempDateNewWeek.setDate(tempDateNewWeek.getDate() + 1);
                                    }
                                }
                            }
                        } else {
                             // Fallback if custom details are invalid/empty, advance by 1 day
                            nextOccurrence.setDate(nextOccurrence.getDate() + 1);
                        }
                        break;
                }
            }

            // Update the next_occurrence_date for the original recurring task
            db.run(`UPDATE tasks SET next_occurrence_date = ? WHERE id = ?`, [nextOccurrence.toISOString(), originalTask.id], (err) => {
                if (err) {
                    console.error(`Error updating next_occurrence_date for task ${originalTask.id}:`, err.message);
                }
            });
        }
    });
}


// --- API Endpoints ---

// User Registration
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed: users.username")) {
                    return res.status(409).json({ message: "Username already exists." });
                }
                console.error("Error during user registration:", err.message);
                return res.status(500).json({ message: "Failed to register user." });
            }
            res.status(201).json({ message: "User registered successfully!" });
        });
    } catch (error) {
        console.error("Error hashing password:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// User Login
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) {
            console.error("Error during login (DB query):", err.message);
            return res.status(500).json({ message: "Login failed." });
        }
        if (!user) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        req.session.userId = user.id; // Store user ID in session
        req.session.username = user.username; // Store username in session
        req.session.isLoggedIn = true; // Set a flag for login status

        console.log(`User ${user.username} logged in. Session ID: ${req.session.id}`);
        res.json({ message: "Logged in successfully!", username: user.username });
    });
});

// User Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).json({ message: "Failed to log out." });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.json({ message: "Logged out successfully!" });
    });
});

// Check Session Status
app.get("/session-status", (req, res) => {
    if (req.session.isLoggedIn) {
        res.json({ isLoggedIn: true, username: req.session.username });
    } else {
        res.json({ isLoggedIn: false });
    }
});


// Middleware to protect routes (optional, but good for real apps)
// function isAuthenticated(req, res, next) {
//     if (req.session.isLoggedIn) {
//         next(); // User is authenticated, proceed
//     } else {
//         res.status(401).json({ message: "Unauthorized: Please log in." });
//     }
// }


// --- Task API Endpoints ---

// GET all tasks (Main tasks and subtasks)
app.get("/api/tasks", (req, res) => {
  db.all(`SELECT * FROM tasks`, [], (err, rows) => {
    if (err) {
      console.error("Error fetching all tasks:", err.message);
      return res.status(500).json({ message: err.message });
    }
    // Parse JSON fields for all tasks before sending
    const tasks = rows.map(row => ({
      ...row,
      subtasks: JSON.parse(row.subtasks || '[]'),
      recurrence_details: JSON.parse(row.recurrence_details || '{}'),
      completed: Boolean(row.completed),
      isMainTask: Boolean(row.isMainTask)
    }));
    res.json(tasks);
  });
});

// GET a single task by ID
app.get("/api/tasks/:id", getTask, (req, res) => {
    // getTask middleware already fetched and attached task to res.task
    res.json(res.task);
});

// POST a new task
app.post("/api/tasks", (req, res) => {
    const { title, isMainTask = false, main_task_id = null, parent_id = null, recurrence_type = 'none', recurrence_interval = 0, recurrence_details = {}, end_recurrence_date = null } = req.body;

    if (!title) {
        return res.status(400).json({ message: "Task title is required." });
    }

    const subtasks = JSON.stringify([]); // New tasks start with no subtasks
    const parsedRecurrenceDetails = JSON.stringify(recurrence_details);

    db.run(
        `INSERT INTO tasks (title, isMainTask, subtasks, main_task_id, parent_id, recurrence_type, recurrence_interval, recurrence_details, next_occurrence_date, end_recurrence_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, isMainTask ? 1 : 0, subtasks, main_task_id, parent_id, recurrence_type, recurrence_interval, parsedRecurrenceDetails, null, end_recurrence_date], // next_occurrence_date starts as null
        function (err) {
            if (err) {
                console.error("Error inserting new task:", err.message);
                return res.status(500).json({ message: err.message });
            }
            // Return the newly created task including its ID
            db.get(`SELECT * FROM tasks WHERE id = ?`, [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                const newTask = {
                  ...row,
                  subtasks: JSON.parse(row.subtasks || '[]'),
                  recurrence_details: JSON.parse(row.recurrence_details || '{}'),
                  completed: Boolean(row.completed),
                  isMainTask: Boolean(row.isMainTask)
                };
                res.status(201).json(newTask); // 201 Created
            });
        }
    );
});


// PATCH update a task
app.patch("/api/tasks/:id", getTask, (req, res) => {
    const { title, completed, isMainTask, subtasks, completed_at, recurrence_type, recurrence_interval, recurrence_details, next_occurrence_date, end_recurrence_date } = req.body;
    const taskId = req.params.id;

    let updateFields = [];
    let updateValues = [];

    if (title !== undefined) {
        updateFields.push("title = ?");
        updateValues.push(title);
    }
    if (completed !== undefined) {
        updateFields.push("completed = ?");
        updateValues.push(completed ? 1 : 0);
        if (completed) { // Only set completed_at if task is being marked completed
            updateFields.push("completed_at = ?");
            updateValues.push(completed_at || new Date().toISOString());
        } else { // Clear completed_at if task is being uncompleted
            updateFields.push("completed_at = NULL");
        }
    }
    if (isMainTask !== undefined) {
        updateFields.push("isMainTask = ?");
        updateValues.push(isMainTask ? 1 : 0);
    }
    if (subtasks !== undefined) {
        updateFields.push("subtasks = ?");
        updateValues.push(JSON.stringify(subtasks));
    }
    // Handle recurrence fields
    if (recurrence_type !== undefined) {
        updateFields.push("recurrence_type = ?");
        updateValues.push(recurrence_type);
    }
    if (recurrence_interval !== undefined) {
        updateFields.push("recurrence_interval = ?");
        updateValues.push(recurrence_interval);
    }
    if (recurrence_details !== undefined) {
        updateFields.push("recurrence_details = ?");
        updateValues.push(JSON.stringify(recurrence_details));
    }
    if (end_recurrence_date !== undefined) {
        updateFields.push("end_recurrence_date = ?");
        updateValues.push(end_recurrence_date);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    const query = `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(taskId); // Add taskId to the end of values for the WHERE clause

    db.run(query, updateValues, function (err) {
        if (err) {
            console.error("Error updating task:", err.message);
            return res.status(400).json({ message: err.message });
        }
        // Fetch and return the updated task for better client-side sync
        db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            const updatedTask = {
              ...row,
              subtasks: JSON.parse(row.subtasks || '[]'),
              recurrence_details: JSON.parse(row.recurrence_details || '{}'),
              completed: Boolean(row.completed),
              isMainTask: Boolean(row.isMainTask)
            };
            res.json(updatedTask);
        });
    });
});

// DELETE a task
app.delete("/api/tasks/:id", getTask, (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function (err) {
        if (err) {
            console.error("Error deleting task:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: "Task deleted successfully" });
    });
});

// --- Tune API Endpoints (Existing from your file) ---
// Middleware to get a tune by ID
function getTune(req, res, next) {
  const { id } = req.params;
  db.get(`SELECT * FROM tunes WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: "Cannot find tune" });
    }
    res.tune = row;
    next();
  });
}

// GET all tunes
app.get("/api/tunes", (req, res) => {
  db.all("SELECT * FROM tunes", [], (err, rows) => {
    if (err) {
      throw err;
    }
    res.json(rows);
  });
});

// POST a new tune
app.post("/api/tunes", (req, res) => {
  const { title, artist, videoId } = req.body;
  db.run(
    `INSERT INTO tunes (title, artist, videoId) VALUES (?, ?, ?)`,
    [title, artist, videoId],
    function (err) {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// GET a single tune
app.get("/api/tunes/:id", getTune, (req, res) => {
  res.json(res.tune);
});

// PATCH update a tune (using getTune middleware)
app.patch("/api/tunes/:id", getTune, (req, res) => {
  const { title, artist, videoId } = req.body;
  let updateFields = [];
  let updateValues = [];

  if (title !== undefined) {
    updateFields.push("title = ?");
    updateValues.push(title);
  }
  if (artist !== undefined) {
    updateFields.push("artist = ?");
    updateValues.push(artist);
  }
  if (videoId !== undefined) {
    updateFields.push("videoId = ?");
    updateValues.push(videoId);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  const query = `UPDATE tunes SET ${updateFields.join(", ")} WHERE id = ?`;
  updateValues.push(req.params.id);

  db.run(query, updateValues, function (err) {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    // Fetch and return the updated tune for better client-side sync
    db.get(`SELECT * FROM tunes WHERE id = ?`, [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(row);
    });
  });
});

// DELETE a tune (using getTune middleware)
app.delete("/api/tunes/:id", getTune, (req, res) => {
  db.run(`DELETE FROM tunes WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json({ message: "Tune deleted successfully" });
  });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Backend URL:", `http://localhost:${PORT}`);
});

// Call generateRecurringTasks periodically
setInterval(generateRecurringTasks, 1000 * 60 * 60 * 24); // Run once every 24 hours
generateRecurringTasks(); // Call once on startup
