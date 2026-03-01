#!/usr/bin/env python3
"""
Traqd Email Sequence Sender
Sends the correct email(s) to subscribers based on what's owed.
Usage: python3 send_emails.py [--catch-up] [--single EMAIL STAGE]
  --catch-up: Send all owed emails (dashboard says sent but never actually sent)
  --single EMAIL STAGE: Send a specific stage email to a specific subscriber
"""

import smtplib
import sys
import json
import os
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.environ['CASPER_SMTP_HOST']
SMTP_PORT = int(os.environ['CASPER_SMTP_PORT'])
EMAIL_FROM = os.environ['CASPER_EMAIL']
EMAIL_PASS = os.environ['CASPER_EMAIL_PASSWORD']

def get_email_template(stage, name):
    templates = {
        1: {
            "subject": "Welcome to Traqd — You're In 🎉",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">You're on the list, {name}.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    You just took the first step toward actually seeing your full financial picture. No more guessing. No more scattered spreadsheets. No more "I'll figure it out later."
  </p>
  
  <div style="text-align: center; margin: 30px 0; background: #000; border-radius: 16px; padding: 20px;">
    <img src="https://casperops.vercel.app/traqd-hero-phone.jpg" alt="Traqd Dashboard" style="max-width: 300px; width: 100%; height: auto;" />
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;"><strong>Here's what happens next:</strong></p>
  
  <ul style="font-size: 16px; line-height: 1.8; color: #333; padding-left: 20px;">
    <li>You'll get early access before anyone else</li>
    <li>Your launch price is <strong>locked in forever</strong></li>
    <li>We'll share tips on tracking your income smarter</li>
  </ul>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    We built Traqd because we were tired of juggling 5 platforms and having zero clarity on what we actually earned. If that sounds familiar — you're in the right place.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Talk soon,<br/><strong>Kofi & Curtis</strong><br/><span style="color: #666;">Founders, Traqd</span>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        2: {
            "subject": "Be honest — do you actually know how much you made last month?",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">Here's what no one talks about, {name}.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    You worked hard last month. Clients paid you. Your shop made sales. Maybe a side gig came through. But if someone asked you <strong>"exactly how much did you make?"</strong> — could you answer?
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Most people earning from multiple sources can't. Not because they're bad with money — but because the money is <strong>scattered everywhere</strong>.
  </p>
  
  <ul style="font-size: 16px; line-height: 1.8; color: #333; padding-left: 20px;">
    <li>Freelance payments in one app</li>
    <li>Shop revenue in another</li>
    <li>Side gig money in a third</li>
    <li>Bank statements that don't match any of it</li>
  </ul>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Then tax season hits. And suddenly you're spending <strong>days</strong> trying to piece together what you earned, from where, and when.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Sound familiar? Tomorrow we'll show you how we're fixing this. For good.
  </p>
  
  <div style="background: #000; border-radius: 16px; padding: 20px; margin: 30px 0; text-align: center;">
    <img src="https://casperops.vercel.app/traqd-ai-cfo.jpg" alt="Traqd AI — Your Personal CFO" style="max-width: 100%; border-radius: 12px;" />
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    — Kofi & Curtis
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        3: {
            "subject": "Screenshot your income. AI does the rest.",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">{name}, meet Traqd.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Yesterday we talked about the problem. Today — the solution.
  </p>
  
  <div style="text-align: center; margin: 30px 0; background: #000; border-radius: 16px; padding: 20px;">
    <img src="https://casperops.vercel.app/traqd-analytics.jpg" alt="Traqd Analytics Dashboard" style="max-width: 300px; width: 100%; height: auto;" />
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>Traqd works in 3 steps:</strong>
  </p>
  
  <div style="background: #f8f8f8; border-radius: 12px; padding: 24px; margin: 20px 0;">
    <p style="font-size: 16px; margin: 0 0 12px 0;"><strong>1. Capture</strong> — Screenshot your earnings from any platform. Upload bank statements. The AI reads it instantly.</p>
    <p style="font-size: 16px; margin: 0 0 12px 0;"><strong>2. See everything</strong> — One dashboard shows ALL your income streams, expenses, and net profit in real time.</p>
    <p style="font-size: 16px; margin: 0;"><strong>3. Share</strong> — Generate a clean, shareable link for your accountant. Tax season in seconds, not days.</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    No manual entry. No spreadsheets. No accounting degree required. Works with <strong>100+ platforms</strong> — Upwork, Shopify, YouTube, Airbnb, Stripe, PayPal, and more.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Built for people who hustle, not accountants.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    — Kofi & Curtis
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        4: {
            "subject": "\"I finally know exactly what I earn\" — here's what people are saying",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">You're not the only one tired of guessing, {name}.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Here's what early testers are telling us:
  </p>
  
  <div style="border-left: 3px solid #22C55E; padding: 16px 20px; margin: 20px 0; background: #f8fdf8; border-radius: 0 8px 8px 0;">
    <p style="font-size: 16px; margin: 0; color: #333; font-style: italic;">"I was using 3 different spreadsheets to track income from my Etsy shop, freelance work, and Airbnb. With Traqd I just screenshot my dashboards and it's all in one place. I can't go back."</p>
    <p style="font-size: 14px; margin: 8px 0 0 0; color: #666;">— Side hustler, 4 income streams</p>
  </div>
  
  <div style="border-left: 3px solid #22C55E; padding: 16px 20px; margin: 20px 0; background: #f8fdf8; border-radius: 0 8px 8px 0;">
    <p style="font-size: 16px; margin: 0; color: #333; font-style: italic;">"Tax season used to take me a full week. Now I generate a link and send it to my accountant. Done in minutes."</p>
    <p style="font-size: 14px; margin: 8px 0 0 0; color: #666;">— Freelance developer</p>
  </div>
  
  <div style="border-left: 3px solid #22C55E; padding: 16px 20px; margin: 20px 0; background: #f8fdf8; border-radius: 0 8px 8px 0;">
    <p style="font-size: 16px; margin: 0; color: #333; font-style: italic;">"I thought I was making good money. Turns out two of my income streams were barely breaking even. Traqd showed me where to focus."</p>
    <p style="font-size: 14px; margin: 8px 0 0 0; color: #666;">— E-commerce seller</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    You're already on the list. When we launch, you'll be first in line.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">— Kofi & Curtis</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        5: {
            "subject": "The AI feature that changes everything",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">{name}, imagine asking your money a question.</h1>
  
  <div style="text-align: center; margin: 30px 0; background: #000; border-radius: 16px; padding: 20px;">
    <img src="https://casperops.vercel.app/traqd-hero-phone.jpg" alt="Traqd Dashboard" style="max-width: 300px; width: 100%; height: auto;" />
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    "How much did I make from Shopify this quarter?"<br/>
    "Which income stream grew the most?"<br/>
    "What's my monthly average across all platforms?"
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    With <strong>Traqd AI</strong>, you just ask. No formulas. No pivot tables. No digging through bank statements. Just plain-language questions and instant answers from your real data.
  </p>
  
  <div style="background: #0D0D0D; border-radius: 12px; padding: 24px; margin: 20px 0; color: #fff;">
    <p style="font-size: 14px; color: #22C55E; margin: 0 0 8px 0;">You asked:</p>
    <p style="font-size: 16px; margin: 0 0 16px 0;">"What's my best performing platform this year?"</p>
    <p style="font-size: 14px; color: #22C55E; margin: 0 0 8px 0;">Traqd AI:</p>
    <p style="font-size: 16px; margin: 0;">"Your Shopify store generated the most revenue at $4,230, up 47% from last quarter. YouTube is your fastest growing source at +28% month over month."</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;"><strong>Other features you'll love:</strong></p>
  
  <ul style="font-size: 16px; line-height: 1.8; color: #333; padding-left: 20px;">
    <li>📸 Screenshot capture — AI reads your earnings instantly</li>
    <li>🏦 Bank statement upload — CSV or PDF from any bank</li>
    <li>📊 Real-time dashboard — all income streams at a glance</li>
    <li>🔗 Shareable reports — one link for your accountant</li>
    <li>🔒 Bank-level encryption — AES-256, we never store raw screenshots</li>
  </ul>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">— Kofi & Curtis</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        6: {
            "subject": "\"But I already use spreadsheets...\"",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">Let's address the elephant in the room, {name}.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    We hear these a lot. Let's be real about each one:
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>"I already track things in a spreadsheet."</strong><br/>
    How many hours a month does that take? Do you update it every time money comes in? When was the last time it was accurate? Traqd does it in seconds with a screenshot.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>"QuickBooks/FreshBooks handles this."</strong><br/>
    Those are built for accountants running businesses with invoices and payroll. You're a creator/freelancer/hustler earning from 5 different platforms. Different problem, different solution. Also — they cost $37-137/month. Traqd starts at $8.25/month.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>"I'll just figure it out at tax time."</strong><br/>
    That's what everyone says. Then tax season arrives and you're spending 3-5 days reconstructing a year of income from memory, bank statements, and platform dashboards. Every year. Same pain, on repeat.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>"Is my data safe?"</strong><br/>
    AES-256 encryption. We never store raw screenshots — only encrypted, extracted data. Bank-level security, because your financial data deserves it.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Still have questions? Reply to this email — we read every one.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">— Kofi & Curtis</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        7: {
            "subject": "Launch prices won't last — here's what you're locking in",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">{name}, your spot is secured — but the price won't stay this low.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Because you joined the waitlist, you've locked in our <strong>launch pricing forever</strong>. Here's what that looks like:
  </p>
  
  <div style="background: #f8f8f8; border-radius: 12px; padding: 24px; margin: 20px 0;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
      <div><strong>Starter</strong><br/><span style="color: #666;">5 income sources, 10 AI imports/mo</span></div>
      <div style="text-align: right;"><strong>$8.25/mo</strong><br/><span style="color: #666;">$99/year</span></div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
      <div><strong>Pro</strong> ⭐<br/><span style="color: #666;">Unlimited everything</span></div>
      <div style="text-align: right;"><strong>$12.42/mo</strong><br/><span style="color: #666;">$149/year</span></div>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <div><strong>Business</strong><br/><span style="color: #666;">Up to 5 businesses</span></div>
      <div style="text-align: right;"><strong>$20.75/mo</strong><br/><span style="color: #666;">$249/year</span></div>
    </div>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Compare that to QuickBooks ($37-137/mo) or FreshBooks ($19-60/mo) — and those aren't even built for multi-income earners.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>After launch, prices go up.</strong> Waitlist members keep their price locked. That's the deal.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Launch is imminent. Stay tuned.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">— Kofi & Curtis</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        },
        8: {
            "subject": "We're almost live — are you ready?",
            "html": f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <img src="https://traqd.io/traqd-logo.png" alt="Traqd" style="height: 32px; margin-bottom: 30px;" />
  
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #000;">{name}, this is it.</h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Over the past week, we've shown you:
  </p>
  
  <ul style="font-size: 16px; line-height: 1.8; color: #333; padding-left: 20px;">
    <li>The real problem with tracking multiple income streams</li>
    <li>How Traqd solves it in 3 simple steps</li>
    <li>What early testers think</li>
    <li>The AI that lets you talk to your money</li>
    <li>Why spreadsheets and accounting software aren't the answer</li>
    <li>The launch pricing you've locked in</li>
  </ul>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Now it's almost time.
  </p>
  
  <div style="background: #0D0D0D; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
    <p style="font-size: 20px; font-weight: 700; color: #22C55E; margin: 0 0 8px 0;">🚀 Launch is imminent</p>
    <p style="font-size: 16px; color: #ccc; margin: 0;">You'll be the first to know. Watch your inbox.</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    When we go live, waitlist members get:
  </p>
  
  <ul style="font-size: 16px; line-height: 1.8; color: #333; padding-left: 20px;">
    <li>✅ First access — before the public</li>
    <li>✅ Launch price locked forever</li>
    <li>✅ Priority onboarding support</li>
  </ul>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    Every day without Traqd is another day you don't know your real numbers. That changes soon.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    See you on the other side,<br/><strong>Kofi & Curtis</strong><br/><span style="color: #666;">Founders, Traqd</span>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">You're receiving this because you signed up for the Traqd waitlist. <a href="https://traqd.io" style="color: #999;">traqd.io</a></p>
</div>"""
        }
    }
    return templates.get(stage)

def send_email(to_email, to_name, stage):
    template = get_email_template(stage, to_name)
    if not template:
        print(f"❌ No template for stage {stage}")
        return False
    
    msg = MIMEMultipart('alternative')
    msg['From'] = f"Traqd <{EMAIL_FROM}>"
    msg['To'] = to_email
    msg['Subject'] = template['subject']
    msg.attach(MIMEText(template['html'], 'html'))
    
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_FROM, EMAIL_PASS)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        print(f"✅ Email #{stage} sent to {to_name} ({to_email})")
        return True
    except Exception as e:
        print(f"❌ Failed to send Email #{stage} to {to_name} ({to_email}): {e}")
        return False

if __name__ == "__main__":
    if "--catch-up" in sys.argv:
        # Catch-up mode: send all owed emails
        subscribers = json.loads(sys.argv[sys.argv.index("--catch-up") + 1])
        for sub in subscribers:
            for stage in sub['owed_stages']:
                send_email(sub['email'], sub['name'], stage)
                time.sleep(1)  # Rate limit
    elif "--single" in sys.argv:
        idx = sys.argv.index("--single")
        email = sys.argv[idx + 1]
        name = sys.argv[idx + 2]
        stage = int(sys.argv[idx + 3])
        send_email(email, name, stage)
