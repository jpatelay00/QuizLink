import "dotenv/config";
import { openDatabase } from "./db.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run promote -- name@example.com");
  process.exit(1);
}
const database = openDatabase();
const result = database.prepare("UPDATE users SET role='admin' WHERE email=?").run(email);
database.close();
if (!result.changes) {
  console.error("No registered account has that email.");
  process.exit(1);
}
console.log(`Admin role granted to ${email}`);
