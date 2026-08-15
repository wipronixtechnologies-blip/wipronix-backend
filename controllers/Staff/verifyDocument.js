const Staff = require('../../models/Staff.model');
const { logActivity } = require('../Activity/activityController');

// Verify or reject a staff document
exports.verifyDocument = async (req, res) => {
  try {
    // 1. Validate Request Context
    if (!req.staff) {
      console.error('[verifyDocument] Error: req.staff is missing.');
      return res.status(401).json({ success: false, message: 'Unauthorized: Staff context missing' });
    }

    const { id } = req.params;
    const { documentType, status } = req.body;

    // 2. Validate required fields
    if (!id) {
      return res.status(400).json({ success: false, message: 'Staff ID is required' });
    }

    if (!documentType) {
      return res.status(400).json({ success: false, message: 'Document type is required' });
    }

    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be either "verified" or "rejected"' });
    }

    // 3. Validate ID format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Staff ID format' });
    }

    // 4. Get the target staff member
    const targetStaff = await Staff.findById(id);

    if (!targetStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // 5. Validate document type
    const validDocumentTypes = [
      'identityProof',
      'panCard',
      'educationalCertificate',
      'offerLetter',
      'experienceLetter',
      'medicalDocument',
      'otherDocument'
    ];

    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // 6. Update the document status
    const documents = targetStaff.documents || {};
    const currentDoc = documents[documentType];

    // Handle different document structures
    let updateField;
    if (Array.isArray(currentDoc)) {
      // If it's an array, update the first item's status
      updateField = { [`documents.${documentType}.0.status`]: status };
    } else if (typeof currentDoc === 'object' && currentDoc !== null) {
      // If it's an object with url/status
      updateField = { [`documents.${documentType}.status`]: status };
    } else {
      // Create new document object
      updateField = { [`documents.${documentType}`]: { url: '', status } };
    }

    // 7. Check if ANY document is verified after this update
    // First, get the updated documents to check verification status
    const updatedDocuments = { ...documents };
    if (Array.isArray(updatedDocuments[documentType])) {
      if (updatedDocuments[documentType].length > 0) {
        updatedDocuments[documentType] = [{ ...updatedDocuments[documentType][0], status }];
      }
    } else {
      updatedDocuments[documentType] = { ...updatedDocuments[documentType], status };
    }

    // Check if any document is verified
    const anyDocumentVerified = Object.values(updatedDocuments).some((doc) => {
      if (!doc) return false;
      if (Array.isArray(doc)) {
        return doc.some(d => d && d.status === 'verified');
      }
      return doc.status === 'verified';
    });

    // Add isVerified to update if any document is verified
    if (anyDocumentVerified) {
      updateField.isVerified = true;
    }

    // 8. Perform the update
    const staff = await Staff.findByIdAndUpdate(
      id,
      { $set: updateField },
      { new: true, runValidators: true }
    ).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found during update'
      });
    }

    console.log(`[verifyDocument] Document ${documentType} for staff ${id} marked as ${status}`);

    res.status(200).json({
      success: true,
      message: `Document ${status} successfully`,
      data: {
        documentType,
        status,
        isVerified: staff.isVerified
      }
    });

    // Log Activity
    logActivity({
      type: 'document_verified',
      user: req.staff.fullName,
      actorId: req.staff._id,
      action: `${status} ${documentType} for ${staff.fullName}`,
      target: staff.fullName,
      targetId: id,
      metadata: { documentType, status, isVerified: staff.isVerified }
    });

  } catch (error) {
    console.error('[verifyDocument] Error verifying document:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Staff ID format',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to verify document',
      error: error.message
    });
  }
};

