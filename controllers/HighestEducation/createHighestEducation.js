const HighestEducation = require('../../models/HighestEducation.model');

const createHighestEducation = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const existingOption = await HighestEducation.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: 'This Highest Education option already exists'
      });
    }

    const newOption = new HighestEducation({
      name: name.trim()
    });

    await newOption.save();

    res.status(201).json({
      success: true,
      message: 'Highest Education option created successfully',
      data: newOption
    });
  } catch (error) {
    console.error('Error creating Highest Education option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Highest Education option',
      error: error.message
    });
  }
};

module.exports = createHighestEducation;
