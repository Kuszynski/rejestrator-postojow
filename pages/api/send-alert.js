// API endpoint for sending downtime alerts via EmailJS
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { machine, duration, comment, operator, startTime, endTime } = req.body;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID',
        template_id: process.env.EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID', 
        user_id: process.env.EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY',
        template_params: {
          to_email: process.env.ALERT_EMAIL || 'manager@yourcompany.com',
          machine_name: machine,
          duration_minutes: duration,
          downtime_reason: comment,
          operator_name: operator,
          start_time: startTime,
          end_time: endTime,
          subject: `🚨 Lang Stans Alert - ${machine} (${duration} min)`
        }
      })
    });

    if (response.ok) {
      console.log('Email alert sent successfully for:', machine, duration, 'min');
      res.status(200).json({ message: 'Alert sent successfully' });
    } else {
      throw new Error('EmailJS API error');
    }
  } catch (error) {
    console.error('Failed to send email alert:', error);
    res.status(500).json({ message: 'Failed to send alert' });
  }
}