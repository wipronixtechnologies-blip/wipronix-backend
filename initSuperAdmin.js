require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff.model');
const connectDB = require('./src/config/db');

const initializeSuperAdmin = async () => {
    try {
        await connectDB();
        
        const email = 'wipronixtechnologies@gmail.com';
        const password = '7807308542'; 
        
        console.log(`Initializing Super Admin: ${email}...`);
        
        let superAdmin = await Staff.findOne({ email });
        
        if (!superAdmin) {
            console.log('User not found. Creating new Super Admin...');
            superAdmin = new Staff({
                firstName: 'Wipronix',
                lastName: 'Technologies',
                fullName: 'Wipronix Technologies',
                email: email,
                password: password,
                role: 'super_admin',
                systemRole: 'super_admin',
                isActive: true,
                designation: 'Super Administrator',
                department: 'Management',
                permissions: ['all', 'delete', 'edit', 'activate', 'deactivate']
            });
            await superAdmin.save();
            console.log('New Super Admin created successfully.');
        } else {
            console.log('User found. Updating permissions...');
            superAdmin.role = 'super_admin';
            superAdmin.systemRole = 'super_admin';
            superAdmin.isActive = true;
            superAdmin.password = password; // Reset password as requested
            superAdmin.permissions = ['all', 'delete', 'edit', 'activate', 'deactivate'];
            
            await superAdmin.save();
            console.log('Existing user updated/promoted to Super Admin.');
        }
        
        console.log(`Final ID: ${superAdmin._id}`);
        console.log('Super Admin initialization complete.');
        process.exit(0);
        
    } catch (error) {
        console.error('CRITICAL ERROR during initialization:', error);
        process.exit(1);
    }
};

initializeSuperAdmin();
