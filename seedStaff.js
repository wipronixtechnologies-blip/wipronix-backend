// Seed script to create initial Super Admin
// Run: node seedStaff.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Use the Staff model directly
const Staff = require('./models/Staff.model');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/occeana-tech');
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await Staff.findOne({ role: 'super_admin' });
    
    if (existingAdmin) {
      console.log('Super Admin already exists:', existingAdmin.email);
      console.log('To update password, delete the existing record and run this script again.');
      process.exit(0);
    }

    // Create Super Admin
    const superAdmin = new Staff({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@wipronix.com',
      password: 'admin123', // Will be hashed by pre-save middleware
      role: 'super_admin',
      systemRole: 'super_admin',
      department: 'Administration',
      designation: 'Super Administrator',
      phoneNumber: '+919646706114',
      isActive: true,
      permissions: [
        'manage_users',
        'manage_staff',
        'manage_courses',
        'manage_students',
        'view_analytics',
        'manage_settings',
        'manage_roles',
        'view_all_data'
      ]
    });

    await superAdmin.save();
    console.log('✅ Super Admin created successfully!');
    console.log('Email: admin@wipronix.com');
    console.log('Password: admin123');
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();

