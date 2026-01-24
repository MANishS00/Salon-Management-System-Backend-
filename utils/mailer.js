import nodemailer from 'nodemailer';

export const sendOTPEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Salon App" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Password Reset OTP',
    html: `<h2>Your OTP: ${otp}</h2><p>Valid for 10 minutes</p>`,
  });
};
