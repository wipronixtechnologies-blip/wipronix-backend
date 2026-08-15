const Student = require('../../models/Student.model');
const FeePayment = require('../../models/FeePayment.model');
const College = require('../../models/College.model');
const StudentInteraction = require('../../models/StudentInteraction.model');

exports.getAdmissionOverview = async (req, res) => {
    try {
        let query = {};
        let collegeNames = [];

        // Apply BDE filtering
        if (req.staff.role === 'bde') {
            const assignedColleges = await College.find({ assignedTo: req.staff._id });
            collegeNames = assignedColleges.map(c => c.name);
            if (collegeNames.length > 0) {
                query.college = { $in: collegeNames };
            } else {
                return res.status(200).json({
                    success: true,
                    data: {
                        totalStudents: 0,
                        todayAdmissions: 0,
                        totalCollection: 0,
                        todayCollection: 0,
                        recentPayments: []
                    }
                });
            }
        }

        const [totalStudents, todayAdmissions, allStudents] = await Promise.all([
            Student.countDocuments(query),
            Student.countDocuments({ ...query, createdAt: { $gte: new Date().setHours(0,0,0,0) } }),
            Student.find(query).select('_id')
        ]);

        const studentIds = allStudents.map(s => s._id);
        const feePayments = await FeePayment.find({ student: { $in: studentIds } }).sort({ createdAt: -1 });

        const totalCollection = feePayments.reduce((sum, payment) => sum + (payment.status === 'Paid' ? payment.amount : 0), 0);
        
        // Today's collection
        const todayCollection = feePayments
            .filter(p => new Date(p.date) >= new Date().setHours(0,0,0,0) && p.status === 'Paid')
            .reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                totalStudents,
                todayAdmissions,
                totalCollection,
                todayCollection,
                recentPayments: feePayments.slice(0, 5)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudents = async (req, res) => {
    try {
        let query = {};
        if (req.staff.role === 'bde') {
            const assignedColleges = await College.find({ assignedTo: req.staff._id });
            const collegeNames = assignedColleges.map(c => c.name);
            if (collegeNames.length > 0) {
                query.college = { $in: collegeNames };
            } else {
                return res.status(200).json({ success: true, data: [] });
            }
        }

        const students = await Student.find(query).select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: students });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addStudent = async (req, res) => {
     try {
         const student = new Student(req.body);
         await student.save();
         res.status(201).json({ success: true, data: student });
     } catch (error) {
         res.status(400).json({ success: false, message: error.message });
     }
};

exports.addFeePayment = async (req, res) => {
    try {
        const payment = new FeePayment({ ...req.body, collectedBy: req.staff._id });
        await payment.save();
        res.status(201).json({ success: true, data: payment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getFeePayments = async (req, res) => {
    try {
        let query = {};
        if (req.staff.role === 'bde') {
            const assignedColleges = await College.find({ assignedTo: req.staff._id });
            const collegeNames = assignedColleges.map(c => c.name);
            if (collegeNames.length > 0) {
                const students = await Student.find({ college: { $in: collegeNames } }).select('_id');
                const studentIds = students.map(s => s._id);
                query.student = { $in: studentIds };
            } else {
                return res.status(200).json({ success: true, data: [] });
            }
        }

        const payments = await FeePayment.find(query).populate('student', 'fullName email').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addStudentInteraction = async (req, res) => {
    try {
        const interaction = new StudentInteraction({
            ...req.body,
            staff: req.staff._id
        });
        await interaction.save();
        res.status(201).json({ success: true, data: interaction });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getStudentInteractions = async (req, res) => {
    try {
        const interactions = await StudentInteraction.find({ student: req.params.studentId })
            .populate('staff', 'fullName')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: interactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

