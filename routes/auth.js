import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { sendOTPEmail } from '../utils/mailer.js';

const router = express.Router();

// SIGNUP 
router.post('/signup', async (req, res) => {
  const { salonName, email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase.from('users').insert([
    { salon_name: salonName, email, password: hashedPassword },
  ]);

  if (error) return res.status(400).json({ message: error.message });

  res.json({ message: 'Signup successful' });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data)
    return res.status(401).json({ message: 'Invalid credentials' });

  const match = await bcrypt.compare(password, data.password);
  if (!match)
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: data.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, user: { id: data.id, salonName: data.salon_name, email: data.email } });
});

// FORGOT PASSWORD (SEND OTP)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Delete old OTPs
  await supabase.from('password_resets').delete().eq('email', email);

  // Insert OTP (expiry handled by DB)
  await supabase.from('password_resets').insert([
    {
      email,
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
  ]);

  await sendOTPEmail(email, otp);

  res.json({ message: 'OTP sent to registered email' });
});


// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  // Get OTP record
  const { data: record } = await supabase
    .from('password_resets')
    .select('*')
    .eq('email', email)
    .eq('otp', otp)
    .limit(1)
    .maybeSingle();

  if (!record) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // TIME COMPARISON (FIXED)
  const now = Date.now(); // milliseconds
  const expiry = new Date(record.expires_at).getTime();

  if (now > expiry) {
    return res.status(400).json({ message: 'OTP expired' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('email', email);

  // Delete OTP after success
  await supabase
    .from('password_resets')
    .delete()
    .eq('email', email);

  res.json({ message: 'Password reset successful' });
});



export default router;
