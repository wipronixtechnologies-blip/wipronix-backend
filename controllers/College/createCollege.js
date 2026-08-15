const College = require('../../models/College.model');

const createCollege = async (req, res) => {
  try {
    const { 
      name, 
      location, 
      contact, 
      technologies, 
      educationPrograms,
      poc,
      notes 
    } = req.body;

    // Check if college with same name exists
    const existingCollege = await College.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCollege) {
      return res.status(400).json({
        success: false,
        message: 'College with this name already exists'
      });
    }

    // Get staff ID from authenticated staff
    const staffId = req.staff?._id || req.body.createdBy;

    const college = new College({
      name,
      location,
      contact,
      technologies,
      educationPrograms,
      poc,
      notes,
      createdBy: staffId,
      updatedBy: staffId
    });

    await college.save();

    res.status(201).json({
      success: true,
      message: 'College added successfully',
      data: { college }
    });
  } catch (error) {
    console.error('Error creating college:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add college',
      error: error.message
    });
  }
};

module.exports = createCollege;

