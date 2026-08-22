const PassingYear = require('../../models/PassingYear.model');

const createPassingYear = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const existingOption = await PassingYear.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: 'This Passing Year option already exists'
      });
    }

    const newOption = new PassingYear({
      name: name.trim()
    });

    await newOption.save();

    res.status(201).json({
      success: true,
      message: 'Passing Year option created successfully',
      data: newOption
    });
  } catch (error) {
    console.error('Error creating Passing Year option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Passing Year option',
      error: error.message
    });
  }
};

module.exports = createPassingYear;
