const PassingYear = require('../../models/PassingYear.model');

const getAllPassingYear = async (req, res) => {
  try {
    let options = await PassingYear.find().sort({ name: 1 });
    
    // Seed default values if the collection is empty
    if (options.length === 0) {
      const defaults = ["2024", "2025", "2026", "2027", "2028"];
      const seedPromises = defaults.map(name => new PassingYear({ name }).save());
      await Promise.all(seedPromises);
      options = await PassingYear.find().sort({ name: 1 });
    }

    res.status(200).json({
      success: true,
      message: 'Passing Year options fetched successfully',
      data: options
    });
  } catch (error) {
    console.error('Error fetching Passing Year options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Passing Year options',
      error: error.message
    });
  }
};

module.exports = getAllPassingYear;
