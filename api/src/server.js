require("dotenv").config();

const config = require("./config");
const app = require("./app");
const { startScheduler } = require("./jobs/scheduler");
const { assertNoDevAccounts } = require("./utils/startupChecks");

async function main() {
    // Fail closed: no seeded/demo accounts (known passwords) in production.
    await assertNoDevAccounts({ isProduction: process.env.NODE_ENV === "production" });

    app.listen(config.port, () => {
        console.log(`Pramaan API running on port ${config.port}`);
        // Expiry sweep + reminders (disable with JOBS_INTERVAL_MINUTES=0)
        startScheduler();
    });
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
