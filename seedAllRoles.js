require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff.model');
const connectDB = require('./src/config/db');

const rolesToSeed = [
    {
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@wipronix.com',
        role: 'admin',
        systemRole: 'admin',
        designation: 'Administrator',
        department: 'Administration'
    },
    {
        firstName: 'System',
        lastName: 'HR',
        email: 'hr@wipronix.com',
        role: 'hr',
        systemRole: 'hr',
        designation: 'HR Executive',
        department: 'HR'
    },
    {
        firstName: 'System',
        lastName: 'HR Manager',
        email: 'hrmanager@wipronix.com',
        role: 'hr_manager',
        systemRole: 'hr_manager',
        designation: 'HR Manager',
        department: 'HR'
    },
    {
        firstName: 'System',
        lastName: 'Project Manager',
        email: 'projectmanager@wipronix.com',
        role: 'project_manager',
        systemRole: 'project_manager',
        designation: 'Project Manager',
        department: 'Management'
    },
    {
        firstName: 'System',
        lastName: 'Marketing Manager',
        email: 'marketingmanager@wipronix.com',
        role: 'marketing_manager',
        systemRole: 'marketing_manager',
        designation: 'Marketing Manager',
        department: 'Marketing'
    },
    {
        firstName: 'System',
        lastName: 'Development Manager',
        email: 'developmentmanager@wipronix.com',
        role: 'development_manager',
        systemRole: 'development_manager',
        designation: 'Development Manager',
        department: 'Development'
    },
    {
        firstName: 'System',
        lastName: 'Operation Manager',
        email: 'operationmanager@wipronix.com',
        role: 'operation_manager',
        systemRole: 'operation_manager',
        designation: 'Operation Manager',
        department: 'Operations'
    },
    {
        firstName: 'System',
        lastName: 'Training Head',
        email: 'traininghead@wipronix.com',
        role: 'training_head',
        systemRole: 'training_head',
        designation: 'Training Head',
        department: 'Training'
    },
    {
        firstName: 'System',
        lastName: 'BDE',
        email: 'bde@wipronix.com',
        role: 'bde',
        systemRole: 'bde',
        designation: 'Business Development Executive',
        department: 'Sales'
    },
    {
        firstName: 'System',
        lastName: 'Bidder',
        email: 'bidder@wipronix.com',
        role: 'bidder',
        systemRole: 'bidder',
        designation: 'Bidder',
        department: 'Sales'
    },
    {
        firstName: 'System',
        lastName: 'Employee',
        email: 'employee@wipronix.com',
        role: 'employee',
        systemRole: 'employee',
        designation: 'Software Engineer',
        department: 'Development'
    }
];

const seedAllRoles = async () => {
    try {
        await connectDB();
        
        const password = 'password123';
        const permissions = ['all', 'delete', 'edit', 'activate', 'deactivate'];
        
        for (const roleData of rolesToSeed) {
            console.log(`Seeding role user: ${roleData.email} (${roleData.role})...`);
            
            let user = await Staff.findOne({ email: roleData.email });
            
            if (!user) {
                user = new Staff({
                    ...roleData,
                    fullName: `${roleData.firstName} ${roleData.lastName}`,
                    password: password,
                    isActive: true,
                    permissions: permissions
                });
                await user.save();
                console.log(`Successfully created new user: ${roleData.email}`);
            } else {
                user.firstName = roleData.firstName;
                user.lastName = roleData.lastName;
                user.fullName = `${roleData.firstName} ${roleData.lastName}`;
                user.role = roleData.role;
                user.systemRole = roleData.systemRole;
                user.designation = roleData.designation;
                user.department = roleData.department;
                user.password = password; // triggers pre-save bcrypt hash
                user.isActive = true;
                user.permissions = permissions;
                
                await user.save();
                console.log(`Successfully updated existing user: ${roleData.email}`);
            }
        }
        
        console.log('All roles seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR seeding roles:', error);
        process.exit(1);
    }
};

seedAllRoles();
