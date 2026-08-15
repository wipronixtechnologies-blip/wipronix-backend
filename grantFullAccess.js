require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff.model');
const connectDB = require('./src/config/db');

const grantFullAccess = async () => {
    try {
        await connectDB();
        
        const targetId = '69861494fb6ff1855c52de1c';
        
        console.log(`Searching for staff ID: ${targetId}...`);
        
        const staff = await Staff.findById(targetId);
        
        if (!staff) {
            console.error('Staff member not found with this ID!');
            
            // Try searching by email if ID fails, though user gave specific ID
            console.log('Searching by email wipronix@gmail.com as fallback...');
            const fallbackStaff = await Staff.findOne({ email: 'wipronix@gmail.com' });
            if (fallbackStaff) {
                console.log(`Found staff by email. ID is: ${fallbackStaff._id}`);
                await applyPermissions(fallbackStaff);
            } else {
                console.error('No staff found by email either.');
            }
        } else {
            await applyPermissions(staff);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('Error granting access:', error);
        process.exit(1);
    }
};

const applyPermissions = async (staff) => {
    console.log(`Current data for ${staff.email}: Role=${staff.role}, SystemRole=${staff.systemRole}, Active=${staff.isActive}`);
    
    // Set to super_admin to grant all access in controllers/middlewares
    staff.role = 'super_admin';
    staff.systemRole = 'super_admin';
    staff.isActive = true;
    
    // Also ensure permissions array has necessary values if the system uses them
    // Based on previous views, it seems role based is primary, but let's be safe
    staff.permissions = ['all', 'delete', 'edit', 'activate', 'deactivate'];
    
    try {
        await staff.save();
        console.log(`Successfully updated permissions for ${staff.email}.`);
    } catch (err) {
        console.warn('Mongoose save failed, attempting updateOne fallback...');
        await Staff.updateOne(
            { _id: staff._id },
            { 
                $set: { 
                    role: 'super_admin', 
                    systemRole: 'super_admin',
                    isActive: true,
                    permissions: ['all', 'delete', 'edit', 'activate', 'deactivate']
                } 
            }
        );
        console.log('UpdateOne fallback successful.');
    }
};

grantFullAccess();
