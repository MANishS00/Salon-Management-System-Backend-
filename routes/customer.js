import express from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// VERIFY CUSTOMER BY MOBILE
router.post('/verify', authMiddleware, async (req, res) => {
    const { mobile_no } = req.body;
    const salon_id = req.user.salon_id;

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('salon_id', salon_id)
        .eq('mobile_no', mobile_no)
        .single();

    if (data) {
        return res.json({
            exists: true,
            customer: data
        });
    }

    return res.json({
        exists: false
    });
});


// ADD CUSTOMER
router.post('/', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;

    const { first_name, last_name, date_of_birth, mobile_no, gender } = req.body;

    const { error } = await supabase
        .from('customers')
        .insert([{
            salon_id,
            first_name,
            last_name,
            date_of_birth,
            mobile_no,
            gender
        }]);

    if (error) {
        return res.status(400).json({ message: error.message });
    }

    res.json({ message: 'Customer added successfully' });
});


// UPDATE CUSTOMER
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const salon_id = req.user.salon_id;

    const { error } = await supabase
        .from('customers')
        .update(req.body)
        .eq('id', id)
        .eq('salon_id', salon_id);

    if (error) {
        return res.status(400).json({ message: error.message });
    }

    res.json({ message: 'Customer updated successfully' });
});

// GET ALL CUSTOMERS
router.get('/', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('salon_id', salon_id)
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(400).json({ message: error.message });
    }

    res.json(data);
});

// DELETE MULTIPLE
router.delete('/bulk-delete', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'ids array required' });
    }

    const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', ids)
        .eq('salon_id', salon_id);

    if (error) {
        return res.status(400).json({ message: error.message });
    }

    res.json({ message: 'Customers deleted successfully' });
});


// DELETE SINGLE
router.delete('/:id', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;
    const { id } = req.params;

    await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('salon_id', salon_id);

    res.json({ message: 'Customer deleted' });
});


export default router;
