import express from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();
export default router;

const getSalonId = async (userId) => {
    const { data } = await supabase
        .from('salon_details')
        .select('id')
        .eq('user_id', userId)
        .single();

    return data?.id;
};

router.post('/add', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const {
        firstName,
        lastName,
        gender,
        age,
        phone,
        rating,
    } = req.body;

    const salonId = await getSalonId(userId);
    if (!salonId) {
        return res.status(400).json({ message: 'Create salon details first' });
    }

    await supabase.from('barbers').insert([
        {
            salon_id: salonId,
            first_name: firstName,
            last_name: lastName,
            gender,
            age,
            phone,
            rating,
        },
    ]);

    res.json({ message: 'Barber added successfully' });
});

router.get('/list', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const salonId = await getSalonId(userId);
    if (!salonId) {
        return res.json([]);
    }

    const { data } = await supabase
        .from('barbers')
        .select('*')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: true });

    res.json(data);
});

router.put('/update/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const barberId = req.params.id;

    const {
        firstName,
        lastName,
        gender,
        age,
        phone,
        rating,
    } = req.body;

    const salonId = await getSalonId(userId);

    await supabase
        .from('barbers')
        .update({
            first_name: firstName,
            last_name: lastName,
            gender,
            age,
            phone,
            rating,
        })
        .eq('id', barberId)
        .eq('salon_id', salonId);

    res.json({ message: 'Barber updated successfully' });
});

router.delete('/delete/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const barberId = req.params.id;
  
    const salonId = await getSalonId(userId);
  
    await supabase
      .from('barbers')
      .delete()
      .eq('id', barberId)
      .eq('salon_id', salonId);
  
    res.json({ message: 'Barber deleted successfully' });
  });
  