const Staff = require('../../models/Staff.model');

// Get all unique departments
exports.getDepartments = async (req, res) => {
  try {
    // Get unique departments from staff collection
    const departments = await Staff.distinct('department');
    
    // Filter out empty/null departments and sort alphabetically
    const validDepartments = departments
      .filter(dept => dept && dept.trim() !== '')
      .sort();

    // Predefined departments as fallback/additional options
    const defaultDepartments = ['IT', 'HR', 'Finance', 'Marketing', 'Operations'];
    
    // Merge unique departments from DB with default departments
    const allDepartments = [...new Set([...defaultDepartments, ...validDepartments])].sort();

    res.status(200).json({
      success: true,
      data: allDepartments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
};

