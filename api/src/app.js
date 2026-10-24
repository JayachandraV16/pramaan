const express = require("express");
const path = require("path");

const config = require("./config");
const modulesRouter = require("./modules");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { securityHeaders, corsAllowList } = require("./middleware/security");
const { verifyUploadSignature } = require("./utils/integrity");

const app = express();

if (config.trustProxy) {
    app.set("trust proxy", 1);
}
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(corsAllowList);
app.use(express.json({ limit: "1mb" }));

// Uploaded files (attachments, certificate PDFs) are NOT public: a link only
// works with a valid, unexpired HMAC signature. The API adds the signature to
// every `file_url` / `certificate_file_url` it returns (see utils/ApiResponse).
app.get("/uploads/*splat", (req, res, next) => {
    const requested = decodeURIComponent(req.path.replace(/^\/uploads/, ""));
    const uploadPath = `/uploads${requested}`;

    if (!verifyUploadSignature(uploadPath, req.query.exp, req.query.sig)) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired file link",
        });
    }

    const absolute = path.resolve(config.uploadDir, "." + requested);
    if (!absolute.startsWith(config.uploadDir + path.sep)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(absolute, { dotfiles: "deny" }, (err) => {
        if (err) next(err.code === "ENOENT" ? undefined : err);
    });
});

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
