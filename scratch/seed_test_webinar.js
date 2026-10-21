const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Webinar = require('../models/Webinar.model');
const WebinarRegistration = require('../models/WebinarRegistration.model');

const connStr = process.env.MONGODB_URI;

async function seed() {
  await mongoose.connect(connStr);
  console.log('Connected to DB');

  // Check if any webinar exists
  let webinar = await Webinar.findOne({ isActive: true });
  if (!webinar) {
    webinar = await Webinar.create({
      title: 'Building Enterprise AI Agents: Architecture, Fine-Tuning & Production LLMs',
      description: 'Join Wipronix for a comprehensive deep-dive into building production-ready AI agents and Full Stack AI applications. Learn industry architectures, prompt optimization, vector databases, and real-time deployment frameworks from Mohali\'s premier AI engineering team.',
      photoUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
      speakerName: 'Dr. Karan Varma',
      speakerRole: 'Principal AI Architect & Research Lead',
      speakerBio: '12+ years in Distributed Systems and Deep Learning. Formerly at leading cloud research labs, currently pioneering autonomous AI agents at Wipronix.',
      speakerPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days ahead
      startTime: '06:00 PM IST',
      duration: '90 Mins',
      platform: 'Google Meet',
      meetingLink: 'https://meet.google.com/wipronix-ai-webinar',
      isActive: true,
      isLive: false,
      tags: ['AI Agents', 'LLMs', 'Full Stack', 'Cloud']
    });
    console.log('Created sample webinar:', webinar._id);
  } else {
    console.log('Active webinar already exists:', webinar._id, webinar.title);
  }

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Error seeding webinar:', err);
  process.exit(1);
});
