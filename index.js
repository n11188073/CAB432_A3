const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const processRoutes = require("./routes/process");
const imageRoutes = require("./routes/images");

const app = express();

// JSON parsing
app.use(bodyParser.json());

// Serve tmp folder for temporary images
app.use("/tmp", express.static(path.join(__dirname, "tmp"))); // <-- Add this line

// Serve uploaded and processed images
app.use("/images/uploads", express.static(path.join(__dirname, "data/uploads")));
app.use("/images/processed", express.static(path.join(__dirname, "data/processed")));

// Serve frontend
app.use(express.static(path.join(__dirname, "static/src")));

// Routes
app.use("/auth", authRoutes);
app.use("/upload", uploadRoutes);
app.use("/process", processRoutes);
app.use("/images", imageRoutes);

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static/src/index.html"));
});

// Catch-all
app.use((req, res) => {
  res.status(404).send("Not Found");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
