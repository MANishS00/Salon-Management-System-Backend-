import express from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET SALON DETAILS
router.get('/me', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const { data: salon } = await supabase
        .from('salon_details')
        .select(`
      *,
      barbers (*)
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (!salon) {
        return res.json({ detailsFilled: false });
    }

    res.json({
        detailsFilled: true,
        salon,
    });
});

// CREATE SALON DETAILS
router.post('/create', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const {
        phone,
        alternatePhone,
        address,
        pincode,
        openingTime,
        closingTime,
        barbers,
    } = req.body;

    if (!barbers || barbers.length < 1) {
        return res.status(400).json({ message: 'At least one barber required' });
    }

    // Get user data
    const { data: user } = await supabase
        .from('users')
        .select('salon_name, email')
        .eq('id', userId)
        .single();

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Check if salon already exists
    const { data: existing } = await supabase
        .from('salon_details')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        return res.status(400).json({ message: 'Salon details already exist' });
    }

    // Insert salon details (AUTO values)
    const { data: salon } = await supabase
        .from('salon_details')
        .insert([
            {
                user_id: userId,
                salon_name: user.salon_name,
                email: user.email,
                phone,
                alternate_phone: alternatePhone,
                address,
                pincode,
                opening_time: openingTime,
                closing_time: closingTime,
            },
        ])
        .select()
        .single();

    // Insert barbers
    const barberData = barbers.map(b => ({
        salon_id: salon.id,
        barber_name: b.barberName,
        age: b.age,
        mobile: b.mobile,
    }));

    await supabase.from('barbers').insert(barberData);

    res.json({ message: 'Salon details created successfully' });
});


// UPDATE SALON DETAILS
router.put('/update', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const {
        phone,
        alternatePhone,
        address,
        pincode,
        openingTime,
        closingTime,
    } = req.body;

    await supabase
        .from('salon_details')
        .update({
            phone,
            alternate_phone: alternatePhone,
            address,
            pincode,
            opening_time: openingTime,
            closing_time: closingTime,
        })
        .eq('user_id', userId);

    res.json({ message: 'Salon details updated successfully' });
});


export default router;
