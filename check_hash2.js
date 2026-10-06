const bcrypt = require('bcryptjs');
const hash = "$2b$10$3GvxSxIHlnvxDCLdjpznUObkQ6JoAnxgY5dIUNRAu7g5T2.9rpMaW";
const commonPasswords = [
    "7896541230", "Priya@1234", "priya@gmail.com", "Sharma@123", "sharma123", "Marketing@123", "Employee@123", "Wipronix@2026", "admin"
];

async function check() {
    for (let p of commonPasswords) {
        if (await bcrypt.compare(p, hash)) {
            console.log("MATCH FOUND: " + p);
            return;
        }
    }
    console.log("No match found in common passwords.");
}
check();
