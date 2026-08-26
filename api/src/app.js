const express = require("express");
const cors = require("cors");

const modulesRouter = require("./modules");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Pramaan API is running"
    });
});

// All module routes live under /api — see modules/index.js for the full list
app.use("/api", modulesRouter);

// Order matters below: notFound catches unmatched routes, errorHandler
// must be registered last so Express treats it as the error handler.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
