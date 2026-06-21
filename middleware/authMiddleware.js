import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: salon, error } = await supabase
      .from('salon_details')
      .select('id, fast2sms_api_key')
      .eq('user_id', decoded.id)
      .single();

    if (error || !salon) {
      return res.status(403).json({ message: 'Salon not found' });
    }

    req.user = {
      id: decoded.id,
      salon_id: salon.id,
      fast2sms_api_key: salon.fast2sms_api_key?.trim()
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const userAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
