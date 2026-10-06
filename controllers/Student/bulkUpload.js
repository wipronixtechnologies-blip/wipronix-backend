const Student = require("../../models/Student.model");

const bulkUpload = async (req, res) => {
    try {
        const { students } = req.body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: "No student data provided" });
        }

        const createdStudents = [];
        let duplicateCount = 0;

        for (const data of students) {
            try {
                // Check if email or phone number already exists
                const existingStudent = await Student.findOne({
                    $or: [
                        { email: data.email },
                        { phoneNumber: data.phoneNumber && data.phoneNumber.trim() !== '' ? data.phoneNumber : 'xxx-impossible-duplicate' }
                    ]
                });

                if (existingStudent) {
                    console.log(`Duplicate skipped: ${data.email} or ${data.phoneNumber}`);
                    duplicateCount++;
                    continue;
                }

                data.source = 'import';
                const newStudent = new Student(data);
                await newStudent.save();
                createdStudents.push(newStudent);
            } catch (err) {
                if (err.code === 11000) {
                    duplicateCount++;
                    console.log(`Duplicate skipped via MongoIndex: ${data.email}`);
                } else {
                    console.error(err);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: `Successfully imported ${createdStudents.length} leads. (${duplicateCount} skipped due to existing email/phone)`,
            data: createdStudents
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
            success: false,
            message: "Internal server error while bulk uploading"
        });
    }
};

module.exports = bulkUpload;
