const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');
const Student = require('../../models/Student.model');
const Result = require('../../models/Result.model');

/**
 * Aggregates all unique college names across the entire system:
 * - Registered colleges in College model
 * - Placement drives & test events in EventTest model
 * - College names from Student records
 * - College names from Test Result records
 */
const getAllCollegeNames = async (req, res) => {
  try {
    const [collegeDocs, eventDocs, studentColleges, resultColleges] = await Promise.all([
      College.find().distinct('name').catch(() => []),
      EventTest.find().distinct('collegeName').catch(() => []),
      Student.find().distinct('college').catch(() => []),
      Result.find().distinct('collegeName').catch(() => [])
    ]);

    const set = new Set();
    [...collegeDocs, ...eventDocs, ...studentColleges, ...resultColleges].forEach(name => {
      if (typeof name === 'string' && name.trim()) {
        set.add(name.trim());
      }
    });

    const sortedNames = Array.from(set).sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      count: sortedNames.length,
      data: sortedNames
    });
  } catch (error) {
    console.error('Error fetching all college names:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch college names',
      data: []
    });
  }
};

module.exports = getAllCollegeNames;
