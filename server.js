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
// app.get("/", (req, res) => {
//  res.sendFile(path.join(__dirname, "..", "index.html"));
// });
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

// --- SQLite Database Setup ---
const DB_PATH = "./task_buddy.db"; // This will create a file named task_buddy.db in your backend folder

// --- Helper function for date calculations ---
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0]; // Format YYYY-MM-DD
}

function addWeeks(date, weeks) {
    const result = new Date(date);
    result.setDate(result.getDate() + (weeks * 7));
    return result.toISOString().split('T')[0]; // Format YYYY-MM-DD
}

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString().split('T')[0]; // Format YYYY-MM-DD
}

function addYears(date, years) {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result.toISOString().split('T')[0]; // Format YYYY-MM-DD
}

// Function to calculate the next occurrence date based on recurrence rules
function calculateNextOccurrence(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

    let lastOccurrenceDate = new Date(task.next_occurrence_date || task.dateAdded);
    lastOccurrenceDate.setHours(0, 0, 0, 0); // Normalize the base date

    let nextDate = null;

    // If the task was completed, and we are generating a new instance,
    // the 'next_occurrence_date' should reflect the completion date + interval,
    // *or* if it's a recurring task where a new instance is generated regardless of completion,
    // it depends on your specific logic. For simplicity, we'll use `next_occurrence_date`
    // as the reference for when the *next* instance should be due.

    // If next_occurrence_date is in the past or today, we need to find a future date.
    while (lastOccurrenceDate <= today) {
        let tempDate = new Date(lastOccurrenceDate); // Use a temporary date for calculation
        switch (task.recurrence_type) {
            case 'daily':
                nextDate = addDays(tempDate, task.recurrence_interval || 1);
                break;
            case 'weekly':
                nextDate = addWeeks(tempDate, task.recurrence_interval || 1);
                // You might add logic here for specific days of the week if recurrence_details is used
                break;
            case 'monthly':
                nextDate = addMonths(tempDate, task.recurrence_interval || 1);
                // You might add logic here for specific day of the month
                break;
            case 'yearly':
                nextDate = addYears(tempDate, task.recurrence_interval || 1);
                break;
            case 'none':
            default:
                return null; // Not a recurring task
        }
        if (nextDate) {
            lastOccurrenceDate = new Date(nextDate);
            lastOccurrenceDate.setHours(0, 0, 0, 0);
        } else {
            return null; // Should not happen for recurring types
        }
    }

    // Check against end_recurrence_date
    if (task.end_recurrence_date) {
        const endDate = new Date(task.end_recurrence_date);
        endDate.setHours(0, 0, 0, 0);
        if (new Date(nextDate) > endDate) {
            return null; // Recurrence has ended
        }
    }

    return nextDate; // Return YYYY-MM-DD
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Could not connect to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database!");
    // Create tables if they don't exist
    db.serialize(() => {
      // Tasks table (ALL COLUMNS DEFINED HERE, including subtasks)
      db.run(
        `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    isMainTask INTEGER DEFAULT 0,
    subtasks TEXT DEFAULT '[]', -- Subtasks directly in CREATE TABLE
    dateAdded TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT, -- Added: To store the timestamp of completion for trends
    main_task_id INTEGER, -- Added: For subtasks and main task relationships
    parent_id INTEGER, -- Added: For nested subtasks
    -- Premium Recurrence Columns --
    recurrence_type TEXT DEFAULT 'none', -- e.g., 'none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'
    recurrence_interval INTEGER DEFAULT 0, -- e.g., 1 for every day/week/month, 2 for every two days/weeks/months
    recurrence_details TEXT DEFAULT '{}', -- JSON string for complex rules (e.g., specific days of week for 'weekly')
    original_task_id INTEGER, -- Stores the ID of the 'parent' recurring task if this is an instance
    next_occurrence_date TEXT, -- Stores the date when the next instance should be created (YYYY-MM-DD)
    end_recurrence_date TEXT, -- Optional: date when recurrence should stop (YYYY-MM-DD)
    FOREIGN KEY (main_task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
    
    )`,
        (err) => {
          if (err) {
            console.error("Error creating tasks table:", err.message);
          } else {
            console.log("Tasks table is ready.");
          }
        }
      );

      // Tunes table (UPDATED: id is now AUTOINCREMENT for consistency)
      db.run(
        `CREATE TABLE IF NOT EXISTS tunes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                videoId TEXT NOT NULL,
                title TEXT NOT NULL,
                dateAdded TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
        (err) => {
          if (err) {
            console.error("Error creating tunes table:", err.message);
          } else {
            console.log("Tunes table is ready.");
          }
        }
      );
      db.run (
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL);`
      );
    });
  }
});
// --- END SQLite Database Setup ---

// --- Middleware to get a task by ID (CORRECTED) ---
function getTask(req, res, next) {
    db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: 'Cannot find task' });
        }

        // --- IMPORTANT FIX: Parse JSON and convert boolean/integer fields ---
        row.subtasks = JSON.parse(row.subtasks || "[]");
        // Add recurrence details parsing (crucial for editing recurring tasks)
        row.recurrence_details = JSON.parse(row.recurrence_details || "{}");
        row.completed = Boolean(row.completed); // Convert 0/1 to boolean
        row.isMainTask = Boolean(row.isMainTask); // Convert 0/1 to boolean

        res.task = row;
        next();
    });
}
// --- Middleware to get a tune by ID ---
async function getTune(req, res, next) {
  db.get(`SELECT * FROM tunes WHERE id = ?`, [req.params.id], (err, row) => {
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

// --- Function to generate new instances of recurring tasks ---
async function generateRecurringTasks() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`[Recurring Tasks] Checking for tasks due today (${today})...`);

    db.all(`SELECT * FROM tasks WHERE recurrence_type != 'none' AND next_occurrence_date <= ?`, [today], async (err, recurringTasks) => {
        if (err) {
            console.error("[Recurring Tasks] Error fetching recurring tasks:", err.message);
            return;
        }

        if (recurringTasks.length === 0) {
            console.log("[Recurring Tasks] No recurring tasks due today.");
            return;
        }

        console.log(`[Recurring Tasks] Found ${recurringTasks.length} recurring tasks due.`);

        for (const task of recurringTasks) {
            const nextDue = calculateNextOccurrence(task);

            if (nextDue === null) {
                // If recurrence has ended or is invalid, update the task to 'none'
                db.run(`UPDATE tasks SET recurrence_type = 'none', next_occurrence_date = NULL WHERE id = ?`, [task.id], (updateErr) => {
                    if (updateErr) console.error(`[Recurring Tasks] Error ending recurrence for task ${task.id}:`, updateErr.message);
                    else console.log(`[Recurring Tasks] Recurrence ended for task: ${task.title} (ID: ${task.id})`);
                });
                continue;
            }

            // Create a new task instance
            const newTitle = task.title; // You might want to append date/number to title
            const newSubtasks = JSON.parse(task.subtasks || '[]');
            const originalTaskId = task.id; // Link to the original recurring task

            db.run(
                `INSERT INTO tasks (title, completed, isMainTask, subtasks, main_task_id, parent_id, original_task_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newTitle, 0, task.isMainTask, JSON.stringify(newSubtasks), task.main_task_id, task.parent_id, originalTaskId],
                function (insertErr) {
                    if (insertErr) {
                        console.error(`[Recurring Tasks] Error creating new instance for task ${task.id}:`, insertErr.message);
                        return;
                    }
                    console.log(`[Recurring Tasks] Created new instance for "${task.title}" (Original ID: ${task.id}). New task ID: ${this.lastID}`);

                    // Update the original recurring task's next_occurrence_date
                    db.run(`UPDATE tasks SET next_occurrence_date = ? WHERE id = ?`, [nextDue, task.id], (updateErr) => {
                        if (updateErr) console.error(`[Recurring Tasks] Error updating next_occurrence_date for task ${task.id}:`, updateErr.message);
                        else console.log(`[Recurring Tasks] Updated next occurrence date for "${task.title}" to ${nextDue}`);
                    });
                }
            );
        }
    });
}

// --- API Routes ---

// Basic route to test the server
// app.get("/", (req, res) => {
 // res.send("Task Buddy Backend (SQLite) is running!");
//});

// --- TASK API ROUTES ---

// GET all tasks
app.get("/api/tasks", (req, res) => {
  db.all(`SELECT * FROM tasks ORDER BY dateAdded DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    // Parse subtasks JSON string back to array of objects and convert booleans
    const tasksWithParsedData = rows.map((task) => ({
      ...task,
      subtasks: JSON.parse(task.subtasks || "[]"),
      completed: Boolean(task.completed),
      isMainTask: Boolean(task.isMainTask),
    }));
    res.json(tasksWithParsedData);
  });
});

// Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Hash the password
        const salt = await bcrypt.genSalt(10); // Generate a salt
        const password_hash = await bcrypt.hash(password, salt); // Hash the password with the salt

        // Insert new user into the database
        db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, 
            [username, password_hash], 
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed: users.username')) {
                        return res.status(409).json({ message: 'Username already exists' });
                    }
                    return res.status(500).json({ message: err.message });
                }
                // Registration successful, log the user in automatically
                req.session.userId = this.lastID; // Store user ID in session
                res.status(201).json({ 
                    message: 'User registered successfully', 
                    userId: this.lastID,
                    username: username // Send username for client-side display
                });
            }
        );
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login a user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Find the user by username
        db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Compare provided password with hashed password
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Authentication successful, store user ID in session
            req.session.userId = user.id;
            res.status(200).json({ 
                message: 'Logged in successfully', 
                userId: user.id,
                username: user.username // Send username for client-side display
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Logout a user
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// POST a new task
app.post("/api/tasks", (req, res) => {
    const {
        title,
        completed = false,
        isMainTask = false,
        subtasks = [],
        completed_at = null, // New: for recording completion time
        main_task_id = null, // New: for parent-child task relationships
        parent_id = null,    // New: for nested subtasks if applicable
        recurrence_type = 'none',
        recurrence_interval = 0,
        recurrence_details = '{}',
        original_task_id = null,
        next_occurrence_date = null,
        end_recurrence_date = null,
    } = req.body;

    const subtasksJson = JSON.stringify(subtasks);
    const recurrenceDetailsJson = JSON.stringify(recurrence_details); // Ensure recurrence_details is stringified

    const sql = `INSERT INTO tasks (
        title, completed, isMainTask, subtasks, completed_at, main_task_id, parent_id,
        recurrence_type, recurrence_interval, recurrence_details,
        original_task_id, next_occurrence_date, end_recurrence_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        title,
        completed ? 1 : 0,
        isMainTask ? 1 : 0,
        subtasksJson,
        completed_at,
        main_task_id,
        parent_id,
        recurrence_type,
        recurrence_interval,
        recurrenceDetailsJson,
        original_task_id,
        next_occurrence_date,
        end_recurrence_date,
    ];

    db.run(sql, values, function (err) {
        if (err) {
            console.error("Error inserting task:", err.message);
            return res.status(400).json({ message: err.message });
        }
        // Return the newly created task including the auto-generated ID and all fields
        db.get(`SELECT * FROM tasks WHERE id = ?`, [this.lastID], (err, row) => {
            if (err) {
                console.error("Error fetching newly created task:", err.message);
                return res.status(500).json({ message: err.message });
            }
            const parsedTask = {
                ...row,
                subtasks: JSON.parse(row.subtasks || "[]"),
                completed: Boolean(row.completed),
                isMainTask: Boolean(row.isMainTask),
                recurrence_details: JSON.parse(row.recurrence_details || "{}"), // Parse recurrence_details
            };
            res.status(201).json(parsedTask);
        });
    });
});

// GET a single task
app.get("/api/tasks/:id", getTask, (req, res) => {
  const task = res.task;
  // Parse subtasks JSON string back to array of objects and convert booleans
  const parsedTask = {
    ...task,
    subtasks: JSON.parse(task.subtasks || "[]"),
    completed: Boolean(task.completed),
    isMainTask: Boolean(task.isMainTask),
  };
  res.json(parsedTask);
});

// UPDATE a task (CORRECTED: Added completed_at logic and recurrence fields)
app.patch('/api/tasks/:id', getTask, (req, res) => {
    // Get the previous task state from the middleware
    const previousTask = res.task;

    // Get the fields from the request body
    const { 
        title, 
        completed, 
        isMainTask, 
        subtasks,
        recurrence_type,
        recurrence_interval,
        recurrence_details,
        end_recurrence_date
    } = req.body;
    
    const updateFields = [];
    const updateValues = [];

    // Check for title update
    if (title != null) {
        updateFields.push('title = ?');
        updateValues.push(title);
    }
    
    // Check for completed status update
    if (completed != null) {
        updateFields.push('completed = ?');
        updateValues.push(completed ? 1 : 0);

        // --- IMPORTANT FIX: Logic for setting/clearing completed_at ---
        if (completed && !previousTask.completed) {
            // Task is being marked complete AND was previously incomplete
            updateFields.push('completed_at = ?');
            updateValues.push(new Date().toISOString());
        } else if (!completed && previousTask.completed) {
            // Task is being marked incomplete AND was previously complete
            updateFields.push('completed_at = ?');
            updateValues.push(null); // Clear the timestamp
        }
    }
    
    // Check for isMainTask update
    if (isMainTask != null) {
        updateFields.push('isMainTask = ?');
        updateValues.push(isMainTask ? 1 : 0);
    }
    
    // Check for subtasks update
    if (subtasks != null) {
        updateFields.push('subtasks = ?');
        updateValues.push(JSON.stringify(subtasks));
    }

    // --- Recurrence Fields Updates ---
    if (recurrence_type != null) {
        updateFields.push('recurrence_type = ?');
        updateValues.push(recurrence_type);
    }
    if (recurrence_interval != null) {
        updateFields.push('recurrence_interval = ?');
        updateValues.push(recurrence_interval);
    }
    if (recurrence_details != null) {
        updateFields.push('recurrence_details = ?');
        updateValues.push(JSON.stringify(recurrence_details));
    }
    if (end_recurrence_date != null) {
        updateFields.push('end_recurrence_date = ?');
        updateValues.push(end_recurrence_date);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    const query = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(req.params.id);

    db.run(query, updateValues, function(err) {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        
        // Fetch and return the updated task for better client-side sync
        db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            
            // Re-parse the fetched row to return correct types to the client
            const parsedTask = {
                ...row,
                subtasks: JSON.parse(row.subtasks || '[]'),
                recurrence_details: JSON.parse(row.recurrence_details || '{}'),
                completed: Boolean(row.completed),
                isMainTask: Boolean(row.isMainTask)
            };
            res.json(parsedTask);
        });
    });
});

// DELETE a task
app.delete("/api/tasks/:id", getTask, (req, res) => {
  db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json({ message: "Task deleted successfully" });
  });
});

// --- TUNE API ROUTES ---

// GET all tunes
app.get("/api/tunes", (req, res) => {
  db.all(`SELECT * FROM tunes ORDER BY dateAdded DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json(rows);
  });
});

// POST a new tune (UPDATED: NO id passed, uses this.lastID for response)
app.post("/api/tunes", (req, res) => {
  const { videoId, title } = req.body;

  db.run(
    `INSERT INTO tunes (videoId, title) VALUES (?, ?)`,
    [videoId, title],
    function (err) {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      // Return the newly created tune including the auto-generated ID
      db.get(`SELECT * FROM tunes WHERE id = ?`, [this.lastID], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json(row);
      });
    }
  );
});

// GET a single tune
app.get("/api/tunes/:id", getTune, (req, res) => {
  res.json(res.tune);
});

// UPDATE a tune
app.patch("/api/tunes/:id", getTune, (req, res) => {
  const { videoId, title } = req.body;
  const updateFields = [];
  const updateValues = [];

  if (videoId != null) {
    updateFields.push("videoId = ?");
    updateValues.push(videoId);
  }
  if (title != null) {
    updateFields.push("title = ?");
    updateValues.push(title);
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

// DELETE a tune
app.delete("/api/tunes/:id", getTune, (req, res) => {
  db.run(`DELETE FROM tunes WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.json({ message: "Tune deleted successfully" });
  });
});

// Start the server
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Backend URL:", `http://localhost:${PORT}`);

    // Run task generation on startup
    generateRecurringTasks();

    // Schedule task generation to run once every 24 hours (86400000 ms)
    // In a real production app, consider using a dedicated scheduler like 'node-cron'
    // or a cloud-based scheduler to avoid issues if the server restarts frequently.
    setInterval(generateRecurringTasks, 24 * 60 * 60 * 1000); // Every 24 hours
});
