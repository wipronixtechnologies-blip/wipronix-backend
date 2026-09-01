const College = require('../../models/College.model');

const getAllColleges = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      city,
      state,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.state': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (city) {
      filter['location.city'] = city;
    }

    if (state) {
      filter['location.state'] = state;
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10) || 1;
    const isNoLimit = limit === 'all' || limit === '0' || limit === 0 || limit === '-1' || Number(limit) === 0;
    const limitNum = isNoLimit ? 0 : (parseInt(limit, 10) || 10);
    const skip = isNoLimit ? 0 : (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch colleges with pagination
    let queryExec = College.find(filter).sort(sort);
    if (!isNoLimit && limitNum > 0) {
      queryExec = queryExec.skip(skip).limit(limitNum);
    }
    const colleges = await queryExec
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    // Get total count
    const total = await College.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'Colleges fetched successfully',
      data: {
        colleges,
        pagination: {
          currentPage: pageNum,
          totalPages: isNoLimit || limitNum === 0 ? 1 : Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: isNoLimit ? total : limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching colleges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch colleges',
      error: error.message
    });
  }
};

module.exports = getAllColleges;

