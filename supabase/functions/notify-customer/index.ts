import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const body = await req.text()
    if (!body) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), { status: 400 })
    }

    const { booking_id } = JSON.parse(body)
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'Missing booking_id' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_name, status, start_time, customer_id')
      .eq('id', booking_id)
      .single()

    if (!booking) return new Response('Booking not found', { status: 404 })

    const { data: userData } = await supabase.auth.admin.getUserById(booking.customer_id)
    const customerEmail = userData?.user?.email

    if (!customerEmail) return new Response('No email found', { status: 400 })

    const date = new Date(booking.start_time).toLocaleString()
    const statusText = booking.status === 'approved' ? 'approved ✅' : 'declined ❌'

    const { error } = await supabase.auth.admin.sendRawEmail({
      to: customerEmail,
      subject: `Your booking has been ${booking.status}`,
      html: `
        <h2>Booking Update</h2>
        <p>Hi ${booking.customer_name},</p>
        <p>Your booking on <strong>${date}</strong> has been <strong>${statusText}</strong>.</p>
        <p>Thank you for choosing Bombshell Haven! 💅</p>
      `,
    })

    if (error) return new Response(JSON.stringify({ error }), { status: 500 })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})