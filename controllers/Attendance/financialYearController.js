const FinancialYear = require('../../models/FinancialYear.model');

// Very first initial seed entry for the system if database has 0 financial years
const FIRST_INITIAL_FY = {
  name: 'FY 2026-2027',
  startMonth: 4,
  startYear: 2026,
  endMonth: 3,
  endYear: 2027,
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  casualLeaves: 12,
  medicalLeaves: 10,
  maternityLeaves: 15,
  isCurrent: true,
};

// GET /api/financial-years
// Fetches all financial years dynamically from DB
const getFinancialYears = async (req, res) => {
  try {
    let list = await FinancialYear.find().sort({ startYear: -1, createdAt: -1 });

    // Seed very first initial entry ONLY if system collection is completely empty
    if (!list || list.length === 0) {
      const initialFY = await FinancialYear.create(FIRST_INITIAL_FY);
      list = [initialFY];
    } else {
      // Ensure any legacy seed with April end date is corrected to 31st March
      for (const fy of list) {
        if (fy.name === 'FY 2026-2027' && (fy.endMonth === 4 || fy.endDate === '2027-04-30')) {
          fy.endMonth = 3;
          fy.endDate = '2027-03-31';
          await fy.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      financialYears: list,
    });
  } catch (error) {
    console.error('Error fetching financial years:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch financial years',
      error: error.message,
    });
  }
};

// POST /api/financial-years (Super Admin Only)
// Dynamically creates a new financial year with custom dates & leaves
const createFinancialYear = async (req, res) => {
  try {
    const {
      name,
      startYear,
      startMonth = 4,
      endYear,
      endMonth = 3,
      startDate: customStartDate,
      endDate: customEndDate,
      casualLeaves = 12,
      medicalLeaves = 10,
      maternityLeaves = 15,
      isCurrent = false,
    } = req.body;

    if (!name || (!startYear && !customStartDate) || (!endYear && !customEndDate)) {
      return res.status(400).json({
        success: false,
        message: 'Financial year name, start date/year, and end date/year are required',
      });
    }

    // Check if name already exists
    const existing = await FinancialYear.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Financial year '${name}' already exists`,
      });
    }

    const sYear = startYear ? Number(startYear) : new Date(customStartDate).getFullYear();
    const sMonth = startMonth ? Number(startMonth) : new Date(customStartDate).getMonth() + 1;
    const eYear = endYear ? Number(endYear) : new Date(customEndDate).getFullYear();
    const eMonth = endMonth ? Number(endMonth) : new Date(customEndDate).getMonth() + 1;

    const sMonthStr = String(sMonth).padStart(2, '0');
    const eMonthStr = String(eMonth).padStart(2, '0');

    // Dynamic start and end date calculation
    const startDate = customStartDate || `${sYear}-${sMonthStr}-01`;
    const lastDayNum = new Date(eYear, eMonth, 0).getDate();
    const lastDay = String(lastDayNum).padStart(2, '0');
    const endDate = customEndDate || `${eYear}-${eMonthStr}-${lastDay}`;

    // If setting as current, unset any other current FY
    if (isCurrent) {
      await FinancialYear.updateMany({}, { isCurrent: false });
    }

    const newFY = await FinancialYear.create({
      name: name.trim(),
      startYear: sYear,
      startMonth: sMonth,
      endYear: eYear,
      endMonth: eMonth,
      startDate,
      endDate,
      casualLeaves: Number(casualLeaves),
      medicalLeaves: Number(medicalLeaves),
      maternityLeaves: Number(maternityLeaves),
      isCurrent: Boolean(isCurrent),
      createdBy: req.staff?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: `Financial Year '${newFY.name}' created successfully`,
      financialYear: newFY,
    });
  } catch (error) {
    console.error('Error creating financial year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create financial year',
      error: error.message,
    });
  }
};

// PUT /api/financial-years/:id (Super Admin Only)
// Update an existing Financial Year
const updateFinancialYear = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      startYear,
      startMonth,
      endYear,
      endMonth,
      startDate: customStartDate,
      endDate: customEndDate,
      casualLeaves,
      medicalLeaves,
      maternityLeaves,
      isCurrent,
    } = req.body;

    const fy = await FinancialYear.findById(id);
    if (!fy) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found',
      });
    }

    if (name && name.trim() !== fy.name) {
      const existing = await FinancialYear.findOne({ name: name.trim(), _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Another Financial Year with name '${name}' already exists`,
        });
      }
      fy.name = name.trim();
    }

    if (startYear !== undefined) fy.startYear = Number(startYear);
    if (startMonth !== undefined) fy.startMonth = Number(startMonth);
    if (endYear !== undefined) fy.endYear = Number(endYear);
    if (endMonth !== undefined) fy.endMonth = Number(endMonth);

    if (customStartDate) {
      fy.startDate = customStartDate;
    } else if (startYear !== undefined || startMonth !== undefined) {
      const sMonthStr = String(fy.startMonth).padStart(2, '0');
      fy.startDate = `${fy.startYear}-${sMonthStr}-01`;
    }

    if (customEndDate) {
      fy.endDate = customEndDate;
    } else if (endYear !== undefined || endMonth !== undefined) {
      const eMonthStr = String(fy.endMonth).padStart(2, '0');
      const lastDayNum = new Date(fy.endYear, fy.endMonth, 0).getDate();
      fy.endDate = `${fy.endYear}-${eMonthStr}-${String(lastDayNum).padStart(2, '0')}`;
    }

    if (casualLeaves !== undefined) fy.casualLeaves = Number(casualLeaves);
    if (medicalLeaves !== undefined) fy.medicalLeaves = Number(medicalLeaves);
    if (maternityLeaves !== undefined) fy.maternityLeaves = Number(maternityLeaves);

    if (isCurrent !== undefined) {
      if (isCurrent) {
        await FinancialYear.updateMany({ _id: { $ne: id } }, { isCurrent: false });
        fy.isCurrent = true;
      } else {
        fy.isCurrent = false;
      }
    }

    await fy.save();

    return res.status(200).json({
      success: true,
      message: `Financial Year '${fy.name}' updated successfully`,
      financialYear: fy,
    });
  } catch (error) {
    console.error('Error updating financial year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update financial year',
      error: error.message,
    });
  }
};

// DELETE /api/financial-years/:id (Super Admin Only)
// Delete a Financial Year
const deleteFinancialYear = async (req, res) => {
  try {
    const { id } = req.params;

    const fy = await FinancialYear.findById(id);
    if (!fy) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found',
      });
    }

    const totalCount = await FinancialYear.countDocuments();
    if (totalCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only Financial Year in the system.',
      });
    }

    if (fy.isCurrent) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the active Financial Year. Please set another Financial Year as active first.',
      });
    }

    await FinancialYear.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Financial Year '${fy.name}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting financial year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete financial year',
      error: error.message,
    });
  }
};

// PUT /api/financial-years/:id/set-current (Super Admin Only)
const setCurrentFinancialYear = async (req, res) => {
  try {
    const { id } = req.params;

    const fy = await FinancialYear.findById(id);
    if (!fy) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found',
      });
    }

    await FinancialYear.updateMany({}, { isCurrent: false });
    fy.isCurrent = true;
    await fy.save();

    return res.status(200).json({
      success: true,
      message: `Set '${fy.name}' as current active Financial Year`,
      financialYear: fy,
    });
  } catch (error) {
    console.error('Error setting current financial year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update current financial year',
      error: error.message,
    });
  }
};

module.exports = {
  getFinancialYears,
  createFinancialYear,
  updateFinancialYear,
  deleteFinancialYear,
  setCurrentFinancialYear,
};
