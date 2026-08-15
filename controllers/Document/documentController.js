const Document = require('../../models/Document.model');
const Staff = require('../../models/Staff.model');
const Activity = require('../../models/Activity.model');
const storageService = require('../../src/services/storageService');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('file');

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.staff._id;

    if (id === 'reset') return exports.resetMyDocuments(req, res);

    const document = await Document.findById(id);
    if (!document) {
      console.error(`Document not found: ${id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Security check: Only owner or admin can delete
    const isOwner = (document.uploadedFor && document.uploadedFor.toString() === employeeId.toString()) || 
                    (document.uploadedBy && document.uploadedBy.toString() === employeeId.toString());
    const isAdmin = ['super_admin', 'hr'].includes(req.staff.role);
    
    if (!isOwner && !isAdmin) {
      console.error(`Unauthorized delete attempt by ${employeeId} for document ${id}. Doc owner: ${document.uploadedFor}, uploader: ${document.uploadedBy}`);
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this document' });
    }

    // Extract file path from URL or search it (simple approach: extract from URL)
    // For now, let's just delete from DB and update Staff record. 
    // In a production app, we'd use the filePath stored in the DB if we added it.
    // Since we don't have filePath in Document modelYet, let's just delete from DB.

    // Update Staff model to remove the link - Use updateOne to bypass validation of other fields
    const docName = (document.name || '').toLowerCase();
    const resetData = { url: '', status: 'missing' };
    let updateField = '';

    if (docName.includes('aadhar')) updateField = 'documents.identityProof';
    else if (docName.includes('pan card')) updateField = 'documents.panCard';
    else if (docName.includes('degree') || docName.includes('marksheet')) updateField = 'documents.educationalCertificate';
    else if (docName.includes('offer letter')) updateField = 'documents.offerLetter';
    else if (docName.includes('experience')) updateField = 'documents.experienceLetter';

    if (updateField) {
        await Staff.updateOne(
            { _id: document.uploadedFor },
            { $set: { [updateField]: resetData } }
        );
    }

    await Document.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
};

// Reset all documents for current user
exports.resetMyDocuments = async (req, res) => {
    try {
        const employeeId = req.staff._id;

        // Delete all documents from DB where user is owner or uploader
        await Document.deleteMany({ 
            $or: [
                { uploadedFor: employeeId },
                { uploadedBy: employeeId }
            ]
        });

        // Reset Staff model using updateOne
        await Staff.updateOne(
            { _id: employeeId },
            { 
                $set: { 
                    "documents.identityProof": { url: '', status: 'missing' },
                    "documents.panCard": { url: '', status: 'missing' },
                    "documents.educationalCertificate": { url: '', status: 'missing' },
                    "documents.offerLetter": { url: '', status: 'missing' },
                    "documents.experienceLetter": { url: '', status: 'missing' }
                } 
            }
        );

        res.status(200).json({
            success: true,
            message: 'All documents reset successfully'
        });
    } catch (error) {
        console.error('Error resetting documents for staff:', employeeId, error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset documents',
            error: error.message
        });
    }
};

// Get all documents available for the user (personal + public policies)
exports.getMyDocuments = async (req, res) => {
  try {
    const employeeId = req.staff._id;

    // Fetch personal documents
    const personalDocs = await Document.find({ uploadedFor: employeeId }).sort({ createdAt: -1 });

    // Fetch public policies/company documents
    const publicDocs = await Document.find({ isPublic: true }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        personal: personalDocs,
        public: publicDocs
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
};

// Get documents for a specific staff (Admin only)
exports.getStaffDocuments = async (req, res) => {
  try {
    const { staffId } = req.params;
    const documents = await Document.find({ uploadedFor: staffId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching staff documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff documents',
      error: error.message
    });
  }
};

// Upload document
exports.uploadDocument = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      const { name, category } = req.body;
      const employeeId = req.staff._id;

      // Upload to Firebase Storage
      const uploadResult = await storageService.uploadFile(req.file, 'documents');
      
      if (!uploadResult.success) {
        return res.status(400).json({ success: false, message: uploadResult.error });
      }

      const docUrl = uploadResult.data.fileUrl;

      const document = new Document({
        name: name || req.file.originalname,
        type: req.file.mimetype.split('/')[1] || 'pdf',
        url: docUrl,
        size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        category: category || 'Personal',
        uploadedBy: employeeId,
        uploadedFor: employeeId,
        isPublic: false,
        status: 'pending'
      });

      await document.save();

      // Sync specific documents to Staff model
      const staff = await Staff.findById(employeeId);
      if (staff) {
          if (!staff.documents) staff.documents = {};
          
          const docName = (name || req.file.originalname).toLowerCase();
          const syncData = { url: docUrl, status: 'pending' };

          if (docName.includes('aadhar')) {
              staff.documents.identityProof = syncData;
          } else if (docName.includes('pan card')) {
              staff.documents.panCard = syncData;
          } else if (docName.includes('degree') || docName.includes('marksheet')) {
              staff.documents.educationalCertificate = syncData;
          } else if (docName.includes('offer letter')) {
              staff.documents.offerLetter = syncData;
          } else if (docName.includes('experience')) {
              staff.documents.experienceLetter = syncData;
          }
          
          await staff.save();

          // Log Activity
          await Activity.create({
              type: 'document_uploaded',
              user: staff.fullName,
              actorId: employeeId,
              action: 'uploaded a document',
              target: name || req.file.originalname,
              targetId: document._id,
              metadata: { category: category || 'Personal' }
          });
      }

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload document',
        error: error.message
      });
    }
  });
};

// Verify/Reject document
exports.verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    document.status = status;
    document.verificationNotes = remarks;
    await document.save();

    // Sync status back to Staff model if it's a primary doc
    const staff = await Staff.findById(document.uploadedFor);
    if (staff && staff.documents) {
        const docName = document.name.toLowerCase();
        const updateObj = { url: document.url, status: status };

        if (docName.includes('aadhar')) staff.documents.identityProof = updateObj;
        else if (docName.includes('pan card')) staff.documents.panCard = updateObj;
        else if (docName.includes('degree') || docName.includes('marksheet')) staff.documents.educationalCertificate = updateObj;
        else if (docName.includes('offer letter')) staff.documents.offerLetter = updateObj;
        else if (docName.includes('experience')) staff.documents.experienceLetter = updateObj;

        await staff.save();
    }

    // Log activity
    await Activity.create({
      type: 'request_actioned',
      user: req.staff.fullName,
      actorId: req.staff._id,
      action: `${status} document`,
      target: document.name,
      targetId: document._id,
      metadata: { status, remarks }
    });

    res.status(200).json({
      success: true,
      message: `Document ${status} successfully`,
      data: document
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document',
      error: error.message
    });
  }
};
