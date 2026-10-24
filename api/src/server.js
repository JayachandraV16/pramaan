require("dotenv").config();

const config = require("./config");
const app = require("./app");
const { startScheduler } = require("./jobs/scheduler");

app.listen(config.port, () => {
    console.log(`Pramaan API running on port ${config.port}`);
    // Expiry sweep + reminders (disable with JOBS_INTERVAL_MINUTES=0)
    startScheduler();
});
