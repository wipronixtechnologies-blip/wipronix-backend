const bcrypt = require('bcryptjs'); // Assuming bcryptjs is installed in backend
const hash = "$2b$10$3GvxSxIHlnvxDCLdjpznUObkQ6JoAnxgY5dIUNRAu7g5T2.9rpMaW";
const commonPasswords = [
    "123456", "12345678", "password", "Admin@123", "Priya@123", "priya@123", "Priya123", "priya123",
    "Wipronix@123", "wipronix@123", "admin123", "123456789", "000000", "Priya"
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
