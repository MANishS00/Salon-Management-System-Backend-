import express from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import path from "path";

import { supabase } from "../config/supabase.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Generate QR Code
 */
router.post("/generate-qr", authMiddleware, async (req, res) => {
    try {
        const { data: salon, error } = await supabase
            .from("salon_details")
            .select("*")
            .eq("user_id", req.user.id)
            .single();

        if (error || !salon) {
            return res.status(404).json({
                success: false,
                message: "Salon not found",
            });
        }

        let slug = salon.public_slug;

        if (!slug) {
            slug =
                salon.salon_name
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "") +
                "-" +
                Math.random().toString(36).substring(2, 7);

            await supabase
                .from("salon_details")
                .update({ public_slug: slug })
                .eq("id", salon.id);
        }

        const publicUrl = `${req.protocol}://${req.get(
            "host"
        )}/api/qr/salon/${slug}`;

        const qrBuffer = await QRCode.toBuffer(publicUrl);

        const fileName = `${slug}.png`;

        const { error: uploadError } = await supabase.storage
            .from("qr-codes")
            .upload(fileName, qrBuffer, {
                contentType: "image/png",
                upsert: true,
            });

        if (uploadError) throw uploadError;

        const { data: publicFile } = supabase.storage
            .from("qr-codes")
            .getPublicUrl(fileName);

        const qrCodeUrl = publicFile.publicUrl;

        await supabase
            .from("salon_details")
            .update({
                qr_code_url: qrCodeUrl,
            })
            .eq("id", salon.id);

        return res.json({
            success: true,
            salon_url: publicUrl,
            qr_code_url: qrCodeUrl,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * Public salon page
 * URL:
 * http://localhost:5000/salon/royal-salon-abc12
 */
/**
 * Serve public salon page from public folder
 */
router.get("/salon/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: salon, error } = await supabase
            .from("salon_details")
            .select("id")
            .eq("public_slug", slug)
            .single();

        if (error || !salon) {
            return res.status(404).send(`
                <h1 style="text-align:center; font-family:sans-serif; margin-top:50px;">Salon Not Found</h1>
            `);
        }

        res.sendFile(path.resolve("public/salon.html"));
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

/**
 * Serve public customer registration page
 */
router.get("/salon/:slug/register", async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: salon, error } = await supabase
            .from("salon_details")
            .select("id")
            .eq("public_slug", slug)
            .single();

        if (error || !salon) {
            return res.status(404).send(`
                <h1 style="text-align:center; font-family:sans-serif; margin-top:50px;">Salon Not Found</h1>
            `);
        }

        res.sendFile(path.resolve("public/register-customer.html"));
    } catch (error) {
        console.error(error);

        res.status(500).send("Internal Server Error");
    }
});

/**
 * Fetch salon details publicly (no auth)
 */
router.get("/public-salon/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const { data, error } = await supabase
            .from("salon_details")
            .select(`
                salon_name,
                phone,
                email,
                address
            `)
            .eq("public_slug", slug)
            .single();

        if (error || !data) {
            return res.status(404).json({
                message: "Salon not found"
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

/**
 * Add customer details publicly (no auth)
 */
router.post("/salon/:slug/add-customer", async (req, res) => {
    try {
        const { slug } = req.params;
        const { first_name, last_name, date_of_birth, mobile_no, gender } = req.body;

        if (!first_name || !mobile_no) {
            return res.status(400).json({
                success: false,
                message: "First name and mobile number are required"
            });
        }

        // Get salon ID from slug
        const { data: salon, error: salonError } = await supabase
            .from("salon_details")
            .select("id")
            .eq("public_slug", slug)
            .single();

        if (salonError || !salon) {
            return res.status(404).json({
                success: false,
                message: "Salon not found"
            });
        }

        // Check if customer already exists for this salon by mobile number
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("salon_id", salon.id)
            .eq("mobile_no", mobile_no)
            .maybeSingle();

        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: "Customer with this mobile number is already registered at this salon"
            });
        }

        // Insert new customer under this salon
        const { error: insertError } = await supabase
            .from("customers")
            .insert([{
                salon_id: salon.id,
                first_name,
                last_name: last_name || null,
                date_of_birth: date_of_birth || null,
                mobile_no,
                gender: gender || null
            }]);

        if (insertError) {
            throw insertError;
        }

        return res.json({
            success: true,
            message: "Customer registered successfully"
        });
    } catch (error) {
        console.error("Error registering customer:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to register customer"
        });
    }
});

export default router;
