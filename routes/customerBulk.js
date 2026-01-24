import express from 'express';
import XLSX from 'xlsx';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post(
    '/bulk-upload',
    authMiddleware,
    upload.single('file'),
    async (req, res) => {
        const salon_id = req.user.salon_id;

        if (!req.file) {
            return res.status(400).json({ message: 'Excel file required' });
        }

        // 1️⃣ Read Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
            return res.status(400).json({ message: 'Empty Excel file' });
        }

        // 2️⃣ Extract mobile numbers
        const mobileNumbers = rows
            .map(r => String(r.mobile_no).trim())
            .filter(Boolean);

        // 3️⃣ Fetch existing customers in ONE query
        const { data: existing } = await supabase
            .from('customers')
            .select('mobile_no')
            .eq('salon_id', salon_id)
            .in('mobile_no', mobileNumbers);

        const existingSet = new Set(existing.map(e => e.mobile_no));

        const toInsert = [];
        const skipped = [];

        // 4️⃣ Separate new vs existing
        for (const row of rows) {
            const mobile = String(row.mobile_no).trim();

            if (!row.first_name || !mobile) {
                skipped.push({ ...row, reason: 'Missing mandatory fields' });
                continue;
            }

            if (existingSet.has(mobile)) {
                skipped.push({ ...row, reason: 'Mobile already exists' });
                continue;
            }

            toInsert.push({
                salon_id,
                first_name: row.first_name,
                last_name: row.last_name || null,
                mobile_no: mobile,
                gender: row.gender || null,
                date_of_birth: row.date_of_birth || null
            });
        }

        // 5️⃣ Bulk insert
        if (toInsert.length) {
            await supabase.from('customers').insert(toInsert);
        }

        // 6️⃣ Response
        res.json({
            total_rows: rows.length,
            inserted: toInsert.length,
            skipped: skipped.length,
            skipped_records: skipped
        });
    }
);

router.get('/download', authMiddleware, async (req, res) => {
    const salon_id = req.user.salon_id;

    // Fetch customers
    const { data: customers, error } = await supabase
        .from('customers')
        .select(`
      first_name,
      last_name,
      mobile_no,
      gender,
      date_of_birth,
      total_visit,
      created_at
    `)
        .eq('salon_id', salon_id)
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    if (!customers.length) {
        return res.status(404).json({ message: 'No customers found' });
    }

    // Convert to worksheet
    const worksheet = XLSX.utils.json_to_sheet(customers);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    // Convert to buffer
    const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
    });

    // Send file
    res.setHeader(
        'Content-Disposition',
        'attachment; filename=customers.xlsx'
    );
    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);
});
export default router;
