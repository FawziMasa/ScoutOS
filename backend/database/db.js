const db = mysql.createPool({
    host: "sql12.freesqldatabase.com",
    port: 3306,
    user: "sql12831129",
    password: "GzWdNS7NYm",
    database: "sql12831129",

    charset: "utf8mb4",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
export default db;