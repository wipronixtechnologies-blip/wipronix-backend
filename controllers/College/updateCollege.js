const College = require("../../models/College.model");

const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get staff ID from authenticated staff
    const staffId = req.staff?._id || req.body.updatedBy;
    
    // Add updatedBy field
    updateData.updatedBy = staffId;

    const college = await College.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email')
     .populate('updatedBy', 'fullName email');

    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'College updated successfully',
      data: { college }
    });
  } catch (error) {
    console.error('Error updating college:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update college',
      error: error.message
    });
  }
};

module.exports = updateCollege;

