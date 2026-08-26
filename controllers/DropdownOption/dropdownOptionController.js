const DropdownOption = require('../../models/DropdownOption.model');

// Seed defaults helper
const DEFAULTS = {
  technology: [
    "React & Node.js (MERN)",
    "Next.js & Tailwind CSS",
    "Python & Django/FastAPI",
    "Java Spring Boot & Microservices",
    "Mobile App (Flutter / React Native)",
    "UI/UX & Product Design",
    "AI / ML & Data Science"
  ],
  domain: [
    "CSE (Computer Science)",
    "IT (Information Technology)",
    "ECE (Electronics & Comm)",
    "Other"
  ],
  businessModel: [
    "Services",
    "Logistics",
    "E-commerce",
    "Healthcare",
    "Education",
    "Real Estate",
    "Other"
  ]
};

// GET all dropdown options (with optional filtering by type)
exports.getAllOptions = async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
    if (type) {
      if (!['technology', 'domain', 'businessModel'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dropdown type'
        });
      }
      query.type = type;
    }

    let options = await DropdownOption.find(query).sort({ createdAt: 1 });

    // Seed defaults if specific type or all is empty
    if (type && options.length === 0) {
      const seedPromises = DEFAULTS[type].map(name => 
        new DropdownOption({ name, type }).save()
      );
      await Promise.all(seedPromises);
      options = await DropdownOption.find({ type }).sort({ createdAt: 1 });
    } else if (!type) {
      // Check if we need to seed anything when no type filter is applied
      const counts = await DropdownOption.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } }
      ]);
      const existingTypes = counts.map(c => c._id);
      
      const seedPromises = [];
      for (const t of ['technology', 'domain', 'businessModel']) {
        if (!existingTypes.includes(t)) {
          DEFAULTS[t].forEach(name => {
            seedPromises.push(new DropdownOption({ name, type: t }).save());
          });
        }
      }
      if (seedPromises.length > 0) {
        await Promise.all(seedPromises);
        options = await DropdownOption.find().sort({ createdAt: 1 });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Dropdown options fetched successfully',
      data: options
    });
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dropdown options',
      error: error.message
    });
  }
};

// POST create a new dropdown option
exports.createOption = async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!type || !['technology', 'domain', 'businessModel'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid type is required (technology, domain, or businessModel)'
      });
    }

    const trimmedName = name.trim();

    // Check uniqueness within the same type
    const existingOption = await DropdownOption.findOne({
      type,
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });

    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: `Option "${trimmedName}" already exists for ${type}`
      });
    }

    const newOption = new DropdownOption({
      name: trimmedName,
      type
    });

    await newOption.save();

    res.status(201).json({
      success: true,
      message: 'Dropdown option created successfully',
      data: newOption
    });
  } catch (error) {
    console.error('Error creating dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dropdown option',
      error: error.message
    });
  }
};

// PUT update a dropdown option
exports.updateOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const option = await DropdownOption.findById(id);
    if (!option) {
      return res.status(444).json({
        success: false,
        message: 'Dropdown option not found'
      });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      // Check for name duplicates in the same type
      const existingOption = await DropdownOption.findOne({
        _id: { $ne: id },
        type: option.type,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
      });

      if (existingOption) {
        return res.status(400).json({
          success: false,
          message: `Option "${trimmedName}" already exists for ${option.type}`
        });
      }
      option.name = trimmedName;
    }

    if (isActive !== undefined) {
      option.isActive = isActive;
    }

    await option.save();

    res.status(200).json({
      success: true,
      message: 'Dropdown option updated successfully',
      data: option
    });
  } catch (error) {
    console.error('Error updating dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dropdown option',
      error: error.message
    });
  }
};

// DELETE a dropdown option
exports.deleteOption = async (req, res) => {
  try {
    const { id } = req.params;

    const option = await DropdownOption.findById(id);
    if (!option) {
      return res.status(444).json({
        success: false,
        message: 'Dropdown option not found'
      });
    }

    await DropdownOption.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Dropdown option deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dropdown option',
      error: error.message
    });
  }
};
