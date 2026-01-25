import express from 'express';
import axios from 'axios';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/fast2sms-details', authMiddleware, async (req, res) => {
    const apiKey = req.user.fast2sms_api_key;

    if (!apiKey) {
        return res.status(400).json({
            message: 'Fast2SMS API key not configured for this salon'
        });
    }

    try {
        const response = await axios.get(
            'https://www.fast2sms.com/dev/wallet',
            {
                headers: {
                    Authorization: apiKey,
                    'Content-Type': 'application/json'
                }

            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch Fast2SMS details',
            error: err.response?.data || err.message
        });
    }
});

router.post('/send-sms', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;
    const apiKey = req.user.fast2sms_api_key;
    const { message } = req.body;

    if (!apiKey) {
        return res.status(400).json({
            message: 'Fast2SMS API key not configured for this salon'
        });
    }

    const { data: customers } = await supabase
        .from('customers')
        .select('first_name, mobile_no')
        .eq('salon_id', salon_id);

    const sent = [];
    const failed = [];

    for (const customer of customers) {
        const personalizedMessage = message.replace(
            '{name}',
            customer.first_name
        );

        try {
            await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                {
                    route: 'q',
                    message: personalizedMessage,
                    language: 'english',
                    numbers: customer.mobile_no
                },
                {
                    headers: {
                        authorization: apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            sent.push(customer.mobile_no);
        } catch (err) {
            failed.push(customer.mobile_no);
        }
    }

    res.json({
        total: customers.length,
        sent: sent.length,
        failed: failed.length
    });
});

export default router;
