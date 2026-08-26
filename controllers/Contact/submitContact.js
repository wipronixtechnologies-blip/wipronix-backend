const Lead = require('../../models/Lead.model');

const submitContact = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phoneNum,
      city,
      role,
      businessModel,
      websiteLink,
      education,
      course,
      college,
      passingYear,
      internshipTech,
      internshipDomain,
      orgName,
      portfolioLink,
      message
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Format role-specific information into the Lead's notes
    let notesArr = [];
    notesArr.push(`Inquiry Role: ${role || 'Not Specified'}`);
    
    if (city) {
      notesArr.push(`City/State: ${city}`);
    }

    if (role === 'Client') {
      if (businessModel) notesArr.push(`Business Model: ${businessModel}`);
      if (websiteLink) notesArr.push(`Website Link: ${websiteLink}`);
    } else if (role === 'Student') {
      if (education) notesArr.push(`Education: ${education}`);
      if (course) notesArr.push(`Course: ${course}`);
      if (college) notesArr.push(`College: ${college}`);
      if (passingYear) notesArr.push(`Passing Year: ${passingYear}`);
      if (internshipTech) notesArr.push(`Technology: ${internshipTech}`);
      if (internshipDomain) notesArr.push(`Interested Domain: ${internshipDomain}`);
    } else if (role === 'Partner') {
      if (orgName) notesArr.push(`Organization/Brand: ${orgName}`);
    } else if (role === 'Career') {
      if (portfolioLink) notesArr.push(`Portfolio/LinkedIn: ${portfolioLink}`);
    }

    if (message && message.trim()) {
      notesArr.push(`\nMessage:\n${message.trim()}`);
    }

    const leadNotes = notesArr.join('\n');

    // Create the Lead in the database
    const lead = new Lead({
      name: fullName.trim(),
      email: email ? email.trim() : undefined,
      phone: phoneNum ? phoneNum.trim() : undefined,
      source: 'Other',
      status: 'New',
      notes: leadNotes
    });

    await lead.save();

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully!',
      data: lead
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact inquiry',
      error: error.message
    });
  }
};

module.exports = submitContact;
