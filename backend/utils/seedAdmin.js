const User = require('../models/User');
const { ROLES } = require('./constants');

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    if (adminExists) {
      return;
    }

    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@approvalflow.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: ROLES.ADMIN,
      department: 'Operations',
      isActive: true
    });

    console.log(`Default admin created: ${admin.email}`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
