const { generateOfferLetter } = require('./controllers/Staff/generateOfferLetter');
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Staff = require('./models/Staff.model');
        const staff = await Staff.findOne();
        
        const req = { params: { id: staff._id } };
        const res = {
            setHeader: (k, v) => console.log('Header:', k, v),
            send: (buf) => console.log('Sent buffer, size:', buf.length),
            status: (code) => ({
                json: (obj) => console.log('Status:', code, 'JSON:', obj)
            })
        };

        console.log('Running generator for staff:', staff.fullName);
        await generateOfferLetter(req, res);
        console.log('Done');
    } catch (e) {
        console.error('CRASHED:', e);
    } finally {
        mongoose.disconnect();
    }
}

test();
