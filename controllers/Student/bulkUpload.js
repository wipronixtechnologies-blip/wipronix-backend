const Student = require("../../models/Student.model");

/**
 * Bulk upload students into the system with mode support (skip or overwrite)
 */
const bulkUpload = async (req, res) => {
    try {
        const { students, mode = 'skip' } = req.body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: "No student data provided" });
        }

        const createdStudents = [];
        const updatedStudents = [];
        let duplicateCount = 0;

        for (const data of students) {
            try {
                const sEmail = data.email ? data.email.toLowerCase().trim() : '';
                const sPhone = data.phoneNumber ? data.phoneNumber.trim() : '';

                // Check if email or phone number already exists
                const existingStudent = await Student.findOne({
                    $or: [
                        { email: sEmail },
                        { phoneNumber: sPhone && sPhone.length >= 7 ? sPhone : 'xxx-impossible-duplicate' }
                    ]
                });

                if (existingStudent) {
                    if (mode === 'overwrite') {
                        // Update existing record with any newly provided details
                        if (data.fullName && data.fullName !== 'Unknown' && !data.fullName.startsWith('Student (')) {
                            existingStudent.fullName = data.fullName;
                        }
                        if (data.college && data.college !== 'Unknown College') {
                            existingStudent.college = data.college;
                        }
                        if (data.course) existingStudent.course = data.course;
                        if (data.semester) existingStudent.semester = data.semester;
                        if (data.passingYear) existingStudent.passingYear = data.passingYear;
                        if (data.city) existingStudent.city = data.city;
                        await existingStudent.save();
                        updatedStudents.push(existingStudent);
                    } else {
                        duplicateCount++;
                    }
                    continue;
                }

                data.source = 'import';
                if (!data.password) {
                    data.password = 'Password123!';
                }
                const newStudent = new Student(data);
                await newStudent.save();
                createdStudents.push(newStudent);
            } catch (err) {
                if (err.code === 11000) {
                    duplicateCount++;
                    console.log(`Duplicate skipped via MongoIndex: ${data.email}`);
                } else {
                    console.error("Error creating student:", err);
                }
            }
        }

        let message = `Successfully imported ${createdStudents.length} new leads.`;
        if (updatedStudents.length > 0) {
            message += ` Updated ${updatedStudents.length} existing leads.`;
        }
        if (duplicateCount > 0) {
            message += ` (${duplicateCount} duplicate leads skipped)`;
        }

        res.status(201).json({
            success: true,
            message,
            createdCount: createdStudents.length,
            updatedCount: updatedStudents.length,
            duplicateCount,
            data: [...createdStudents, ...updatedStudents]
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
            success: false,
            message: "Internal server error while bulk uploading"
        });
    }
};

/**
 * Pre-check duplicates before actual upload so the user can inspect duplicates
 * and give permission to either add/overwrite or skip duplicates.
 */
const checkDuplicates = async (req, res) => {
    try {
        const { students } = req.body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: "No student data provided" });
        }

        const emails = students.map(s => s.email?.toLowerCase().trim()).filter(Boolean);
        const phones = students.map(s => s.phoneNumber?.trim()).filter(p => p && p.length >= 7);

        // Find all existing records in database matching any incoming email or phone
        const existingRecords = await Student.find({
            $or: [
                { email: { $in: emails } },
                { phoneNumber: { $in: phones } }
            ]
        }).select('_id fullName email phoneNumber college course counselingStatus');

        const emailMap = new Map();
        const phoneMap = new Map();

        existingRecords.forEach(rec => {
            if (rec.email) emailMap.set(rec.email.toLowerCase().trim(), rec);
            if (rec.phoneNumber) phoneMap.set(rec.phoneNumber.trim(), rec);
        });

        const duplicates = [];
        const unique = [];
        const seenInFile = new Set();

        students.forEach((s, index) => {
            const sEmail = s.email?.toLowerCase().trim();
            const sPhone = s.phoneNumber?.trim();
            const fileKey = sPhone ? `phone:${sPhone}` : (sEmail ? `email:${sEmail}` : `idx:${index}`);

            // Check if already seen earlier in this same Excel file
            const isInternalDuplicate = seenInFile.has(fileKey);
            seenInFile.add(fileKey);

            const matchByEmail = sEmail ? emailMap.get(sEmail) : null;
            const matchByPhone = sPhone ? phoneMap.get(sPhone) : null;
            const match = matchByPhone || matchByEmail;

            if (match || isInternalDuplicate) {
                duplicates.push({
                    incoming: s,
                    existing: match ? {
                        _id: match._id,
                        fullName: match.fullName,
                        email: match.email,
                        phoneNumber: match.phoneNumber,
                        college: match.college,
                        course: match.course,
                        counselingStatus: match.counselingStatus
                    } : null,
                    reason: isInternalDuplicate 
                        ? 'Duplicate entry within the same Excel sheet' 
                        : (matchByEmail && matchByPhone 
                            ? 'Matches existing email & phone in database' 
                            : (matchByPhone ? 'Phone number already registered' : 'Email already registered'))
                });
            } else {
                unique.push(s);
            }
        });

        return res.status(200).json({
            success: true,
            total: students.length,
            duplicateCount: duplicates.length,
            newCount: unique.length,
            duplicates,
            unique
        });

    } catch (error) {
        console.error('Check duplicates error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to check duplicates"
        });
    }
};

module.exports = {
    bulkUpload,
    checkDuplicates
};
