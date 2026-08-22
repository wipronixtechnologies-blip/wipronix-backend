const HighestEducation = require('../../models/HighestEducation.model');

const getAllHighestEducation = async (req, res) => {
  try {
    let options = await HighestEducation.find().sort({ createdAt: 1 });
    
    // Seed default values if the collection is empty
    if (options.length === 0) {
      const defaults = ["10th", "12th", "Graduate", "Post Graduate"];
      const seedPromises = defaults.map(name => new HighestEducation({ name }).save());
      await Promise.all(seedPromises);
      options = await HighestEducation.find().sort({ createdAt: 1 });
    }

    res.status(200).json({
      success: true,
      message: 'Highest Education options fetched successfully',
      data: options
    });
  } catch (error) {
    console.error('Error fetching Highest Education options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Highest Education options',
      error: error.message
    });
  }
};

module.exports = getAllHighestEducation;
