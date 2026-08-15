const Trainer = require('../../models/Trainer.model');

// Get all trainers
exports.getAllTrainers = async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    const trainers = await Trainer.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: trainers
    });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainers',
      error: error.message
    });
  }
};

// Get trainer by ID
exports.getTrainerById = async (req, res) => {
  try {
    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }
    res.status(200).json({
      success: true,
      data: trainer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainer',
      error: error.message
    });
  }
};

// Create trainer
exports.createTrainer = async (req, res) => {
  try {
    const trainer = new Trainer(req.body);
    await trainer.save();
    res.status(201).json({
      success: true,
      data: trainer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create trainer',
      error: error.message
    });
  }
};

// Update trainer
exports.updateTrainer = async (req, res) => {
  try {
    const trainer = await Trainer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }
    res.status(200).json({
      success: true,
      data: trainer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update trainer',
      error: error.message
    });
  }
};

// Delete trainer
exports.deleteTrainer = async (req, res) => {
  try {
    const trainer = await Trainer.findByIdAndDelete(req.params.id);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Trainer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete trainer',
      error: error.message
    });
  }
};
