import 'dotenv/config'; // ← THIS fixes everything

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import salonRoutes from './routes/salon.js';
import barberRoutes from './routes/barber.js';
import customersRoutes from './routes/customer.js';
import customerBulkRoutes from './routes/customerBulk.js';
import customerSmsRoutes from './routes/customerSms.js';


console.log('SUPABASE_URL =>', process.env.SUPABASE_URL);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('public'));
app.use('/api/auth', authRoutes);
app.use('/api/salon', salonRoutes);
app.use('/api/barber', barberRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/customerBulkRoutes', customerBulkRoutes);
app.use('/api/customerSmsRoutes', customerSmsRoutes)

app.listen(5000, () => {
  console.log('Server running on port 5000');
});
