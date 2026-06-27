import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({

    region: process.env.AWS_REGION,

    credentials: {

        accessKeyId: process.env.AWS_ACCESS_KEY_ID,

        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY

    }

});

function formatTime(time) {

    let hour = parseInt(time.split(":")[0]);

    const minute = time.split(":")[1];

    const suffix = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;

    return `${hour}:${minute} ${suffix}`;

}

function formatDate(dateString) {

    const date = new Date(dateString);

    return date.toLocaleDateString("en-IN", {

        weekday: "short",

        day: "numeric",

        month: "short",

        year: "numeric"

    });

}

export async function sendBookingSMS({

    phone,

    customerName,

    salonName,

    bookingDate,

    slotStart,

    slotEnd,

    serviceName

}) {

    let message =
        `Dear ${customerName},

Your appointment has been confirmed.

Salon : ${salonName}

Date : ${formatDate(bookingDate)}

Time : ${formatTime(slotStart)} - ${formatTime(slotEnd)}
`;

    if (serviceName) {

        message += `Service : ${serviceName}\n`;

    }

    message += `
Payment : Pay at Shop

Thank you for choosing ${salonName}.

See you soon!`;

    const command = new PublishCommand({

        PhoneNumber: `+91${phone}`,

        Message: message,

        MessageAttributes: {

            "AWS.SNS.SMS.SMSType": {

                DataType: "String",

                StringValue: "Transactional"

            },

            "AWS.SNS.SMS.SenderID": {

                DataType: "String",

                StringValue: process.env.AWS_SMS_SENDER_ID

            }

        }

    });

    return await sns.send(command);

}