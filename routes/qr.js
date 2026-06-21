import express from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";

import { supabase } from "../config/supabase.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Generate QR
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
router.get("/salon/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: salon, error } = await supabase
            .from("salon_details")
            .select(
                `
        salon_name,
        phone,
        email,
        address
      `
            )
            .eq("public_slug", slug)
            .single();

        if (error || !salon) {
            return res.status(404).send(`
        <h1>Salon Not Found</h1>
      `);
        }

        res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${salon.salon_name}</title>

        <meta name="viewport" content="width=device-width, initial-scale=1">

        <style>
          *{
            margin:0;
            padding:0;
            box-sizing:border-box;
            font-family:Arial,sans-serif;
          }

          body{
            background:#f5f5f5;
            display:flex;
            justify-content:center;
            align-items:center;
            min-height:100vh;
          }

          .card{
            width:90%;
            max-width:500px;
            background:white;
            padding:25px;
            border-radius:16px;
            box-shadow:0 5px 20px rgba(0,0,0,0.1);
          }

          h1{
            text-align:center;
            margin-bottom:25px;
          }

          .item{
            margin-bottom:15px;
          }

          .label{
            font-weight:bold;
            color:#444;
          }

          .value{
            margin-top:4px;
            color:#666;
          }

          .btn{
            width:100%;
            margin-top:20px;
            padding:12px;
            border:none;
            border-radius:10px;
            background:black;
            color:white;
            cursor:pointer;
          }
        </style>
      </head>

      <body>
        <div class="card">

          <h1>${salon.salon_name}</h1>

          <div class="item">
            <div class="label">Phone</div>
            <div class="value">${salon.phone || "-"}</div>
          </div>

          <div class="item">
            <div class="label">Email</div>
            <div class="value">${salon.email || "-"}</div>
          </div>

          <div class="item">
            <div class="label">Address</div>
            <div class="value">${salon.address || "-"}</div>
          </div>

          <button class="btn">
            Booking Coming Soon
          </button>

        </div>
      </body>
      </html>
    `);
    } catch (error) {
        console.error(error);

        res.status(500).send("Internal Server Error");
    }
});

// router.get("/qr", authMiddleware, async (req, res) => {
//     try {
//         const { data, error } = await supabase
//             .from("salon_details")
//             .select("public_slug, qr_code")
//             .eq("user_id", req.user.id)
//             .single();

//         if (error) throw error;

//         return res.json({
//             success: true,
//             salon_url: `${process.env.FRONTEND_URL}/salon/${data.public_slug}`,
//             qr_code: data.qr_code,
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// });

// router.get("/public-salon/:slug", async (req, res) => {
//     try {
//         const { slug } = req.params;

//         const { data, error } = await supabase
//             .from("salon_details")
//             .select(`
//                 salon_name,
//                 phone,
//                 email,
//                 address
//             `)
//             .eq("public_slug", slug)
//             .single();

//         if (error || !data) {
//             return res.status(404).json({
//                 message: "Salon not found"
//             });
//         }

//         res.json(data);

//     } catch (error) {
//         res.status(500).json({
//             message: error.message
//         });
//     }
// });

export default router;
