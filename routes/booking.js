import express from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import cron from "node-cron";
import path from 'path';
import { sendBookingSMS } from "../config/snsService.js";

const router = express.Router();

router.get("/availability/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: salon } = await supabase
            .from("salon_details")
            .select("*")
            .eq("public_slug", slug)
            .single();

        if (!salon) {
            return res.status(404).json({
                success: false,
                message: "Salon not found"
            });
        }

        const openingTime = salon.opening_time || "10:00";
        const closingTime = salon.closing_time || "21:00";

        const { count: barberCount } = await supabase
            .from("barbers")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id);

        const totalBarbers = barberCount || 1;

        const today = new Date();
        const tomorrow = new Date();

        tomorrow.setDate(today.getDate() + 1);

        const todayDate = today.toISOString().split("T")[0];
        const tomorrowDate = tomorrow.toISOString().split("T")[0];

        const { data: todayBookings = [] } = await supabase
            .from("bookings")
            .select("slot_start")
            .eq("salon_id", salon.id)
            .eq("booking_date", todayDate);

        const { data: tomorrowBookings = [] } = await supabase
            .from("bookings")
            .select("slot_start")
            .eq("salon_id", salon.id)
            .eq("booking_date", tomorrowDate);

        const generateSlots = (bookings) => {
            const slots = [];

            let current = parseInt(openingTime.split(":")[0]);
            let end = parseInt(closingTime.split(":")[0]);

            while (current < end) {
                const start = `${String(current).padStart(2, "0")}:00`;
                const slotEnd = `${String(current + 1).padStart(2, "0")}:00`;

                const bookedCount = bookings.filter(
                    b => String(b.slot_start).slice(0, 5) === start
                ).length;

                slots.push({
                    start,
                    end: slotEnd,
                    // total_barbers: totalBarbers,
                    // booked: bookedCount,
                    available: Math.max(
                        0,
                        totalBarbers - bookedCount
                    )
                });

                current++;
            }

            return slots;
        };

        return res.json({
            success: true,
            salon_name: salon.salon_name,
            phone: salon.phone,

            today: {
                date: todayDate,
                slots: generateSlots(todayBookings)
            },

            tomorrow: {
                date: tomorrowDate,
                slots: generateSlots(tomorrowBookings)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/book-slot", async (req, res) => {
    try {
        const {
            slug,
            customer_name,
            customer_phone,
            service_name,
            booking_date,
            slot_start
        } = req.body;

        const { data: salon } = await supabase
            .from("salon_details")
            .select("*")
            .eq("public_slug", slug)
            .single();

        if (!salon) {
            return res.status(404).json({
                success: false,
                message: "Salon not found"
            });
        }

        const { count: barberCount } = await supabase
            .from("barbers")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id);

        const totalBarbers = barberCount || 1;

        const { data: existingBookings } = await supabase
            .from("bookings")
            .select("*")
            .eq("salon_id", salon.id)
            .eq("booking_date", booking_date)
            .eq("slot_start", slot_start);

        if (existingBookings.length >= totalBarbers) {
            return res.status(400).json({
                success: false,
                message: "Slot full"
            });
        }

        const endHour =
            parseInt(slot_start.split(":")[0]) + 1;

        const slot_end =
            `${String(endHour).padStart(2, "0")}:00`;

        const { data, error } = await supabase
            .from("bookings")
            .insert({
                salon_id: salon.id,
                customer_name,
                customer_phone,
                service_name: service_name || null,
                booking_date,
                slot_start,
                slot_end,
                payment_status: "pay_at_shop"
            })
            .select()
            .single();

        if (error) throw error;

        // try {
        //     await sendBookingSMS({
        //         phone: customer_phone,
        //         customerName: customer_name,
        //         salonName: salon.salon_name,
        //         bookingDate: booking_date,
        //         slotStart: slot_start,
        //         slotEnd: slot_end,
        //         serviceName: service_name
        //     });
        // } catch (err) {
        //     console.log("SMS Failed");
        //     console.log(err);
        // }
        return res.json({
            success: true,
            message: "Booking confirmed",
            booking: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

cron.schedule("*/10 * * * *", async () => {
    try {
        const now = new Date();

        const { data: bookings } = await supabase
            .from("bookings")
            .select("*");

        for (const booking of bookings || []) {

            const expiryTime = new Date(
                `${booking.booking_date}T${booking.slot_end}`
            );

            expiryTime.setHours(
                expiryTime.getHours() + 1
            );

            if (expiryTime <= now) {

                await supabase
                    .from("booking_history")
                    .insert({
                        ...booking,
                        moved_at: new Date()
                    });

                await supabase
                    .from("bookings")
                    .delete()
                    .eq("id", booking.id);
            }
        }
    } catch (err) {
        console.error(err);
    }
});

router.get(
    "/today",
    authMiddleware,
    async (req, res) => {

        const today =
            new Date().toISOString().split("T")[0];

        const { data } = await supabase
            .from("bookings")
            .select("*")
            .eq("salon_id", req.user.salon_id)
            .eq("booking_date", today)
            .order("slot_start");

        return res.json({
            success: true,
            total_bookings: data.length,
            bookings: data
        });
    });

router.get(
    "/history",
    authMiddleware,
    async (req, res) => {

        const { data } = await supabase
            .from("booking_history")
            .select("*")
            .eq("salon_id", req.user.salon_id)
            .order("booking_date", {
                ascending: false
            });

        return res.json({
            success: true,
            total: data.length,
            history: data
        });
    });

router.get("/salon/:slug/booking", (req, res) => {
    res.sendFile(
        path.join(
            process.cwd(),
            "public",
            "book-appointment.html"
        )
    );
});
export default router;
