# Simplified Nurture Email Templates (CTA-Focused)

These templates use HubSpot contact tokens only - no AirDNA API calls required.

## Available HubSpot Tokens
- `{{contact.firstname}}` - First name
- `{{contact.lastname}}` - Last name  
- `{{contact.data_perfection__city}}` - City (from Data Perfection)
- `{{contact.data_perfection__state}}` - State (from Data Perfection)
- `{{contact.email}}` - Email address
- `{{contact.phone}}` - Phone number

---

## Day 1: Welcome Email

**Subject:** Your free {{contact.data_perfection__city}} rental calculator is ready 🏠

**Preview:** See exactly what properties in your area could earn...

**Body:**

Hey {{contact.firstname}}!

Welcome to the Coach Inayah community! I'm so excited you're here.

You're clearly serious about exploring short-term rental investing in {{contact.data_perfection__city}}, {{contact.data_perfection__state}} - and I want to help you make smart decisions from day one.

I built a free tool that shows you exactly what properties in your area could earn as Airbnb rentals. No guesswork, just real market data.

**[Get Your Free Rental Estimate →](https://coachinayahturnkeytool.com)**

Try it out before our webinar this Sunday at 7PM ET - I'll break down everything you need to know about getting started.

Talk soon,
Coach Inayah

P.S. The calculator is completely free. Use it as many times as you want to compare different properties!

---

## Day 2: Value Email

**Subject:** What {{contact.data_perfection__city}} hosts aren't telling you...

**Preview:** The numbers don't lie...

**Body:**

Hey {{contact.firstname}},

Quick question - have you ever wondered what Airbnb hosts in {{contact.data_perfection__city}} are actually making?

Not the Instagram highlight reels. The real numbers.

I've helped hundreds of people analyze markets just like yours, and here's what I've learned: most people either overestimate OR underestimate what's possible.

The truth is somewhere in between - and it's usually pretty exciting when you see the actual data.

**[See Real {{contact.data_perfection__city}} Rental Numbers →](https://coachinayahturnkeytool.com)**

The calculator pulls live market data so you can see exactly what's happening in your area right now.

See you Sunday at 7PM ET!

Coach Inayah

---

## Day 3: Social Proof Email

**Subject:** How beginners are starting with $0 down

**Preview:** You don't need to own property to get started...

**Body:**

{{contact.firstname}},

One of the biggest myths I hear: "I need to buy a house first before I can do Airbnb."

Not true.

Some of my most successful students started with rental arbitrage - renting a property and subletting it on Airbnb. No down payment. No mortgage. Just smart market research.

The key? Knowing which properties in which areas actually cash flow.

That's exactly what I built the calculator for:

**[Find Cash-Flowing Properties in {{contact.data_perfection__city}} →](https://coachinayahturnkeytool.com)**

On Sunday's webinar (7PM ET), I'll show you the exact strategy step by step.

Coach Inayah

---

## Day 4: Objection Handling Email

**Subject:** "Is {{contact.data_perfection__city}} even a good market?"

**Preview:** Here's how to know for sure...

**Body:**

Hey {{contact.firstname}},

I get this question all the time: "Is my city even good for Airbnb?"

Here's the honest answer: it depends on the specific neighborhood, property type, and your strategy.

Some areas in {{contact.data_perfection__city}} might be amazing. Others might be oversaturated. The only way to know is to look at the actual data.

That's why I made the calculator free - so you can check before you commit to anything:

**[Check {{contact.data_perfection__city}} Market Data →](https://coachinayahturnkeytool.com)**

And on Sunday at 7PM ET, I'll show you exactly what to look for when evaluating any market.

Coach Inayah

---

## Day 5: Urgency Email

**Subject:** 2 days until the webinar 🗓️

**Preview:** Don't miss this...

**Body:**

{{contact.firstname}}!

Just a quick reminder - our live webinar is in 2 days (Sunday, 7PM ET).

I'll be covering:
- How to find profitable properties in any market
- The rental arbitrage strategy (no money down)
- Common mistakes that cost beginners thousands
- Live Q&A where I'll answer your specific questions

If you haven't already, play around with the calculator before we meet:

**[Try the Free Calculator →](https://coachinayahturnkeytool.com)**

It'll help you come with specific questions about {{contact.data_perfection__city}}.

See you there!

Coach Inayah

---

## Day 6: Reminder Email

**Subject:** Tomorrow at 7PM ET ⏰

**Preview:** Your spot is saved...

**Body:**

Hey {{contact.firstname}},

Tomorrow's the day!

Our live webinar starts at 7PM ET. I'll be sharing everything I wish I knew when I started in short-term rentals.

**What to do before tomorrow:**
1. Run a few properties through the calculator: [coachinayahturnkeytool.com](https://coachinayahturnkeytool.com)
2. Write down any questions you have about {{contact.data_perfection__city}}
3. Show up ready to learn!

I'll send you the link tomorrow before we start.

Can't wait to see you there,
Coach Inayah

---

## Day 7: Day-Of Email

**Subject:** We're LIVE in 2 hours! 🔴

**Preview:** Join now...

**Body:**

{{contact.firstname}}!

We start in 2 hours!

**[Join the Webinar →](YOUR_WEBINAR_LINK)**

Grab your coffee, open the calculator, and let's do this together.

See you soon,
Coach Inayah

---

## Notes for HubSpot Setup

1. Create these as 7 separate emails in HubSpot
2. Set up a workflow that enrolls contacts when they join your webinar list
3. Schedule emails with appropriate delays (Day 1 = immediate, Day 2 = +1 day, etc.)
4. Replace `YOUR_WEBINAR_LINK` with your actual webinar registration/join link
5. All personalization uses standard HubSpot tokens - no webhooks needed!
