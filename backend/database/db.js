import mysql from "mysql2/promise";

const db = await mysql.createConnection({
    host: "sql12.freesqldatabase.com",
    port: 3306,
    user: "sql12831129",
    password: "GzWdNS7NYm",
    database: "sql12831129",
});

export default db;