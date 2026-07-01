import mysql from "mysql2/promise";
import "../config/env.js";

function connectionFromUrl() {
    const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
    if (!databaseUrl) return null;

    const url = new URL(databaseUrl);

    return {
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, "") || "defaultdb",
    };
}

const urlConnection = connectionFromUrl();
const envConnection = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const connection = urlConnection || envConnection;
const requiredVariables = ["host", "user", "password", "database"];

for (const variable of requiredVariables) {
    if (!connection[variable]) {
        throw new Error(
            "Missing database configuration. Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME.",
        );
    }
}

const db = mysql.createPool({
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database,

    charset: "utf8mb4",
    ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export default db;
