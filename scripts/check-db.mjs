import Database from 'better-sqlite3';
const db = new Database('E:/data/bot.db');
const apps = db.prepare('SELECT id, applicant_id, status, thread_id FROM applications').all();
console.table(apps);
db.close();
