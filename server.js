require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
// No need for 'uuid' anymore since all IDs are AUTOINCREMENT
const path = require('path'); // Add this line at the top with other imports


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'MVP.html'));
});

// Middleware
app.use(express.json()); // Allows Express to parse JSON bodies from requests
app.use(cors()); // Enable CORS for all routes

// --- SQLite Database Setup ---
const DB_PATH = './task_buddy.db'; // This will create a file named task_buddy.db in your backend folder

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not connect to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database!');
        // Create tables if they don't exist
        db.serialize(() => {
            // Tasks table (ALL COLUMNS DEFINED HERE, including subtasks)
            db.run(`CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                isMainTask INTEGER DEFAULT 0,
                subtasks TEXT DEFAULT '[]', -- Subtasks directly in CREATE TABLE
                dateAdded TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error("Error creating tasks table:", err.message);
                } else {
                    console.log("Tasks table is ready.");
                }
            });

            // Tunes table (UPDATED: id is now AUTOINCREMENT for consistency)
            db.run(`CREATE TABLE IF NOT EXISTS tunes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                videoId TEXT NOT NULL,
                title TEXT NOT NULL,
                dateAdded TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error("Error creating tunes table:", err.message);
                } else {
                    console.log("Tunes table is ready.");
                }
            });
        });
    }
});
// --- END SQLite Database Setup ---


// --- Middleware to get a task by ID ---
async function getTask(req, res, next) {
    db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: 'Cannot find task' });
        }
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
            return res.status(404).json({ message: 'Cannot find tune' });
        }
        res.tune = row;
        next();
    });
}


// --- API Routes ---

// Basic route to test the server
app.get('/', (req, res) => {
    res.send('Task Buddy Backend (SQLite) is running!');
});


// --- TASK API ROUTES ---

// GET all tasks
app.get('/api/tasks', (req, res) => {
    db.all(`SELECT * FROM tasks ORDER BY dateAdded DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        // Parse subtasks JSON string back to array of objects and convert booleans
        const tasksWithParsedData = rows.map(task => ({
            ...task,
            subtasks: JSON.parse(task.subtasks || '[]'),
            completed: Boolean(task.completed),
            isMainTask: Boolean(task.isMainTask)
        }));
        res.json(tasksWithParsedData);
    });
});

// POST a new task (UPDATED: NO id passed, uses this.lastID for response)
app.post('/api/tasks', (req, res) => {
    const { title, completed = false, isMainTask = false, subtasks = [] } = req.body;
    const subtasksJson = JSON.stringify(subtasks); // Store subtasks as a JSON string

    db.run(`INSERT INTO tasks (title, completed, isMainTask, subtasks) VALUES (?, ?, ?, ?)`,
        [title, completed ? 1 : 0, isMainTask ? 1 : 0, subtasksJson],
        function(err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            // Return the newly created task including the auto-generated ID
            db.get(`SELECT * FROM tasks WHERE id = ?`, [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                const parsedTask = {
                    ...row,
                    subtasks: JSON.parse(row.subtasks || '[]'),
                    completed: Boolean(row.completed),
                    isMainTask: Boolean(row.isMainTask)
                };
                res.status(201).json(parsedTask);
            });
        }
    );
});

// GET a single task
app.get('/api/tasks/:id', getTask, (req, res) => {
    const task = res.task;
    // Parse subtasks JSON string back to array of objects and convert booleans
    const parsedTask = {
        ...task,
        subtasks: JSON.parse(task.subtasks || '[]'),
        completed: Boolean(task.completed),
        isMainTask: Boolean(task.isMainTask)
    };
    res.json(parsedTask);
});

// UPDATE a task
app.patch('/api/tasks/:id', getTask, (req, res) => {
    const { title, completed, isMainTask, subtasks } = req.body;
    const updateFields = [];
    const updateValues = [];

    if (title != null) {
        updateFields.push('title = ?');
        updateValues.push(title);
    }
    if (completed != null) {
        updateFields.push('completed = ?');
        updateValues.push(completed ? 1 : 0);
    }
    if (isMainTask != null) {
        updateFields.push('isMainTask = ?');
        updateValues.push(isMainTask ? 1 : 0);
    }
    if (subtasks != null) {
        updateFields.push('subtasks = ?');
        updateValues.push(JSON.stringify(subtasks));
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
            const parsedTask = {
                ...row,
                subtasks: JSON.parse(row.subtasks || '[]'),
                completed: Boolean(row.completed),
                isMainTask: Boolean(row.isMainTask)
            };
            res.json(parsedTask);
        });
    });
});

// DELETE a task
app.delete('/api/tasks/:id', getTask, (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: 'Task deleted successfully' });
    });
});


// --- TUNE API ROUTES ---

// GET all tunes
app.get('/api/tunes', (req, res) => {
    db.all(`SELECT * FROM tunes ORDER BY dateAdded DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// POST a new tune (UPDATED: NO id passed, uses this.lastID for response)
app.post('/api/tunes', (req, res) => {
    const { videoId, title } = req.body;

    db.run(`INSERT INTO tunes (videoId, title) VALUES (?, ?)`,
        [videoId, title],
        function(err) {
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
app.get('/api/tunes/:id', getTune, (req, res) => {
    res.json(res.tune);
});

// UPDATE a tune
app.patch('/api/tunes/:id', getTune, (req, res) => {
    const { videoId, title } = req.body;
    const updateFields = [];
    const updateValues = [];

    if (videoId != null) {
        updateFields.push('videoId = ?');
        updateValues.push(videoId);
    }
    if (title != null) {
        updateFields.push('title = ?');
        updateValues.push(title);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    const query = `UPDATE tunes SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(req.params.id);

    db.run(query, updateValues, function(err) {
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
app.delete('/api/tunes/:id', getTune, (req, res) => {
    db.run(`DELETE FROM tunes WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: 'Tune deleted successfully' });
    });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Backend URL:', `http://localhost:${PORT}`);
});