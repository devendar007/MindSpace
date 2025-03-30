// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Auth routes loaded');

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP configuration error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'MindSpace Registration OTP',
    text: `Your OTP for MindSpace registration is: ${otp}. It expires in 10 minutes.`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}: ${info.messageId}`);
  } catch (err) {
    console.error('Email sending failed:', err.message, err.response);
    throw err;
  }
};

// Register User - Step 1: Send OTP
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check for existing email
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'Email already exists' });
    }

    // Check for existing username
    user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: 'Username already taken' });
    }

    const otp = generateOTP();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

    await sendOTPEmail(email, otp);
    console.log(`OTP sent to ${email}: ${otp}`);
    res.json({ msg: 'OTP sent to your email. Please verify.' });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Verify OTP and Complete Registration - Step 2
router.post('/verify-otp', async (req, res) => {
  const { email, otp, username, password } = req.body;

  try {
    const storedOTP = otpStore[email];
    if (!storedOTP) {
      return res.status(400).json({ msg: 'No OTP found or it has expired' });
    }

    if (storedOTP.otp !== otp || Date.now() > storedOTP.expires) {
      delete otpStore[email];
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    const user = new User({
      username,
      email,
      password: await bcrypt.hash(password, 10),
    });

    await user.save();
    delete otpStore[email];

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log(`User registered: ${email}`);
    res.json({ token });
  } catch (err) {
    console.error('OTP verification error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;