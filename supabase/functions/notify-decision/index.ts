import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  request_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@isteathan.local'

    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
      return json({ error: 'server_misconfigured' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'CLASS_STAFF' && profile.role !== 'ADMIN')) {
      return json({ error: 'forbidden' }, 403)
    }

    const body = (await req.json()) as Body
    const requestId = body.request_id?.trim()
    if (!requestId) {
      return json({ error: 'request_id_required' }, 400)
    }

    const { data: request, error: reqErr } = await admin
      .from('permission_requests')
      .select('id, status, rejection_reason, guardian_id, student_id, students(full_name)')
      .eq('id', requestId)
      .maybeSingle()

    if (reqErr || !request) {
      return json({ error: 'request_not_found' }, 404)
    }

    if (request.status !== 'APPROVED' && request.status !== 'REJECTED') {
      return json({ error: 'not_decided' }, 400)
    }

    const studentName =
      (request.students as { full_name?: string } | null)?.full_name ?? 'الطالب'
    const title =
      request.status === 'APPROVED' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب'
    const bodyText =
      request.status === 'APPROVED'
        ? `تمت الموافقة على طلب خروج ${studentName}.`
        : `تم رفض طلب خروج ${studentName}${
            request.rejection_reason ? `: ${request.rejection_reason}` : '.'
          }`

    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', request.guardian_id)

    if (subErr) {
      return json({ error: subErr.message }, 500)
    }

    if (!subs?.length) {
      return json({ ok: true, sent: 0, reason: 'no_subscriptions' })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const payload = JSON.stringify({
      title,
      body: bodyText,
      url: '/parent/requests',
      tag: `decision-${request.id}`,
    })

    let sent = 0
    const staleIds: string[] = []

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          )
          sent += 1
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id)
          }
        }
      }),
    )

    if (staleIds.length) {
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }

    return json({ ok: true, sent })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'unexpected_error' },
      500,
    )
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
