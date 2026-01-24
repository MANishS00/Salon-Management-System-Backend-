import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch salon linked to user
    const { data: salon, error } = await supabase
      .from('salon_details')
      .select('id')
      .eq('user_id', decoded.id)
      .single();

    if (error || !salon) {
      return res.status(403).json({ message: 'Salon not found for user' });
    }

    req.user = {
      id: decoded.id,
      salon_id: salon.id
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
