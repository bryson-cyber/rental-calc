/**
 * Promo Drip — Affiliate Arbitrage campaign content (0percentfunded.com).
 *
 * GENERATED from the campaign copy in "funding tool/output/" —
 * affiliate-arbitrage-email-campaign.md + affiliate-arbitrage-sms.md.
 * Email subjects use subject-line option 1 from each email's options list.
 * Email bodies are markdown-stripped plain text (rendered with
 * plainTextToEmailHtml at send time — deliberate: minimal HTML stays out of
 * Gmail's Promotions tab). SMS bodies are GSM-7 normalized (straight quotes,
 * hyphens, "..." — avoids Unicode 67-char segment billing).
 *
 * Content edits after seeding happen in the DB via the admin UI, not here.
 */

export interface PromoStepSeed {
  channel: "email" | "sms";
  stepKey: string;
  sequenceOrder: number;
  dayOffset: number;
  /** Send time in Eastern Time, "HH:MM" 24h. Day-0 steps send at launch instead. */
  sendTimeEt: string;
  subject?: string;
  body: string;
}

/** Normalize text to GSM-7-safe characters so SMS bill as 153-char segments, not 67. */
export function toGsm7Safe(s: string): string {
  return s
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** CAN-SPAM physical address for the promo email footer — mirrors the footer
 * address configured in HubSpot (Settings → Marketing → Email → Footer). */
export const PROMO_POSTAL_ADDRESS = "Coach Inayah, Las Vegas, Nevada";

/** The HubSpot Active list "SQL" — Pre Qualification contains "SQL", already
 * excluding members of "All Program Buyers (excluding subs)" (list 3745). */
export const AFFILIATE_ARBITRAGE_LIST_ID = "3756";
export const AFFILIATE_ARBITRAGE_LIST_NAME = "SQL";
export const AFFILIATE_ARBITRAGE_CAMPAIGN_NAME = "Affiliate Arbitrage — 0percentfunded.com";

export const AFFILIATE_ARBITRAGE_STEPS: PromoStepSeed[] = [
  {
    channel: "email",
    stepKey: "email_d0",
    sequenceOrder: 1,
    dayOffset: 0,
    sendTimeEt: "09:00",
    subject: "You're doing the hard part. This is the easy part.",
    body: `Hey,

I'm gonna be straight with you.

You already know how arbitrage works.

Lease a unit. Furnish it. List it. Collect the spread.

The MODEL isn't complicated.

The problem is what has to happen BEFORE you ever sign that first lease.

Because most of you are stuck at the same two things.

1) You don't have a proper LLC set up.

Or you used one of those $49 formation sites… and now your entity is a mess that no landlord or bank would take seriously.

2) You don't have the capital to actually LAUNCH.

You know the math. Deposits, first month, furniture… you're looking at real money for that first unit.

And you're either staring at your savings account doing mental gymnastics…

Thinking about cutting in a partner you don't really want…

Or just sitting on the sideline "researching" for another month.

Meanwhile…

You SHOULD be spending your time learning the markets. Talking to landlords. Getting ready to move when you find the right deal.

NOT Googling "what is a registered agent."

NOT sitting on hold with the IRS trying to get an EIN.

NOT watching some random YouTube video at 1am about which state to file in.

That's government paperwork homework.

And you didn't get into arbitrage to do government paperwork homework.

So I want to introduce you to a team I've been working with.

They're called 0percentfunded.com.

And they handle BOTH of those problems… FOR you.

Like… literally for you.

They file your LLC in your chosen state. Done.

They obtain your EIN. Done.

They set up your registered agent and business address. Done.

Then they run your Funding Snapshot… build you a personalized 90-Day Capital Gameplan…

And a real human sits with you for 45–60 minutes on a call to walk through the whole thing.

You don't fill out state forms.

You don't call the IRS.

You don't piece together conflicting advice from six different Reddit threads.

They handle the setup. You handle learning the business.

And the Capital Gameplan? It maps out how to get you approved for 0% intro APR business credit.

Through real banks. Chase. Amex. Wells Fargo. Truist.

No equity. No investors. No partners taking a cut of YOUR business before it even exists.

The first step is a free 90-second Funding Snapshot.

Soft pull only. Zero impact on your credit score. No credit card. No obligation.

You answer a few questions…

And it gives you a readiness score, an estimated funding range based on real approval data from similar profiles, and a personalized 90-Day Capital Gameplan.

Takes less time than scrolling through Airbnb listings you can't fund yet.

Take the Free 90-Second Funding Snapshot → https://0percentfunded.com/

If you're serious about getting your first unit launched without bleeding your savings dry…

And you'd rather spend your time actually learning to be a great operator instead of drowning in entity paperwork…

This is where you start.

More on this throughout the week.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d0",
    sequenceOrder: 2,
    dayOffset: 0,
    sendTimeEt: "14:00",
    body: `It's Inayah! I partnered with a funding team that sets up your LLC - all the paperwork done FOR you - then maps your 0% business funding plan. Step 1 is their free 90-second funding check (it won't touch your credit score): https://0percentfunded.com/ Reply STOP to opt out.`,
  },
  {
    channel: "email",
    stepKey: "email_d1",
    sequenceOrder: 3,
    dayOffset: 1,
    sendTimeEt: "09:00",
    subject: "She got $120K at 0% for STRs",
    body: `Hey there,

Meet Jaida Marks.

She's a medical device rep in Dallas.

She also runs short-term rental properties.

And she secured $120,000 in 0% intro APR business credit to fund them.

Let that sit for a second.

A hundred and twenty thousand dollars.

At zero percent.

No investors knocking on her door asking for equity.

No partners taking a slice of every booking.

No draining her personal savings and praying the first few months go well.

Just clean capital… from real banks… at 0%.

Now here's why I'm telling you this.

Most of you reading this email understand the model.

You've done the research. You've watched the breakdowns. You can probably run comps in your sleep at this point.

But there's a capital ceiling keeping you from actually STARTING.

You're either trying to figure out how to fund that first unit out of pocket…

Which feels like jumping off a cliff with no parachute…

Or you're stuck in "analysis paralysis" because the financial risk feels too heavy when it's all YOUR money on the line.

Jaida broke through that ceiling.

And the team that helped her is the same team I've been telling you about.

0percentfunded.com.

They didn't just point her at some cards and wish her luck.

They mapped her funding plan. Taught her the sequence. Walked her through the whole process — and she followed the steps.

And here's what I want you to notice…

Jaida's day job is selling medical devices. Her side hustle is managing short-term rentals.

She's busy.

She doesn't have time to research which state is best for formation… or figure out the "right order" to apply for business credit… or sit on hold with government agencies.

She shouldn't HAVE to.

Her time is better spent finding properties and managing guests.

Which is exactly why this team exists.

They handle the entity setup. They handle the funding roadmap. They handle the strategy.

You handle the part you're actually good at.

If you want to see where YOU stand…

The first step is their free 90-second Funding Snapshot.

Soft pull. Zero score impact. No card. No obligation.

Just your readiness score, an estimated funding range, and a gameplan.

See Your Funding Snapshot (Free, 90 Seconds) → https://0percentfunded.com/

Because knowing the arbitrage model is great.

But capital is what turns knowledge into keys.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d1",
    sequenceOrder: 4,
    dayOffset: 1,
    sendTimeEt: "14:00",
    body: `That funding team I told you about - their client Jaida got approved for $120K at 0% interest for her short-term rentals. Every profile's different and banks decide. But their free 90-second check shows YOUR estimated 0% range, without touching your credit score: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d3",
    sequenceOrder: 5,
    dayOffset: 3,
    sendTimeEt: "09:00",
    subject: "Stop planning to fund your first unit with savings",
    body: `Okay, real talk —

Let's talk about the part of arbitrage nobody romanticizes.

The LAUNCH COST.

You already know the math.

Security deposit. First month's rent. Furniture. Supplies. Maybe a photographer if you're smart about it.

For your first unit, you're looking at real money.

And if you're planning to fund that entirely out of your personal savings…

It's terrifying.

It makes you second-guess every deal you look at.

It makes you hesitant to pull the trigger — even on GOOD ones.

And it puts your personal finances at risk if the unit takes a few weeks to ramp up.

This is exactly why I keep pointing you toward 0% intro APR business credit.

Because instead of draining your bank account to get started…

You can use capital from Chase, Amex, Wells Fargo, Truist…

At zero percent intro APR.

Judy Truong did exactly this.

She's from Philadelphia. She was 20 years old. Thin credit file. Paycheck to paycheck.

She got approved for $50,000 at 0%.

And launched her Airbnb in San Diego barely using her own money.

No partners. No investors. Nobody asking for ownership of anything.

Twenty years old.

If that doesn't make you feel a little embarrassed about still "waiting for the right time"…

I don't know what will.

(It's cool. It made ME feel embarrassed too.)

Now here's the part I really want you to hear.

You don't have to become a legal expert to make this happen.

No weekends researching state filing requirements.

No calling the IRS yourself.

No Googling "what is a registered agent" at midnight… then "do I actually need a registered agent"… then "cheapest registered agent"… then giving up and watching Netflix.

Because the team at 0percentfunded.com does all of that FOR you.

They file your LLC. They get your EIN. They set up your registered agent and business address.

Then they build you a personalized 90-Day Capital Gameplan — three phases, what to fix, in what order.

And a real human walks you through the whole thing on a call.

Judy's path was simple: learn how credit actually works, follow the plan, go get the keys.

Yours can be even simpler — because the setup part is done for you.

You're already trying to learn this business. Markets, comps, pricing tools, listing optimization, guest communication…

The LAST thing you need is to add "figure out government paperwork" to that list.

So let someone else handle it.

The first step for anyone is the same.

A free 90-second Funding Snapshot.

Soft pull only. Zero impact on your score. No credit card required.

You get a readiness score, an estimated funding range based on real approvals from similar profiles, and a 90-Day Capital Gameplan.

Take the Free Funding Snapshot → https://0percentfunded.com/

Stop planning to fund your first unit with money that should be in your emergency fund.

And stop spending your Saturday nights on LLC tutorials.

There's a smarter way.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d3",
    sequenceOrder: 6,
    dayOffset: 3,
    sendTimeEt: "14:00",
    body: `Deposits, furniture, supplies - a first Airbnb adds up fast. Their client Judy launched hers barely touching her savings, using 0% business credit instead. Their free 90-second check shows what you could work toward - no impact on your credit score: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d5",
    sequenceOrder: 7,
    dayOffset: 5,
    sendTimeEt: "09:00",
    subject: "That $49 LLC is costing you thousands",
    body: `Hey,

Quick question.

Do you have an LLC?

If your answer is "no"…

Or "I set one up on one of those cheap sites but I'm not sure if it's right"…

Or — and this is the most common one — "I keep meaning to do it but haven't gotten around to it yet"…

Then this email is for you.

Because here's what I see ALL the time with people learning arbitrage.

They understand the model inside and out.

They've got a market picked. Units bookmarked. Numbers running in spreadsheets.

But when it comes time to actually sign a lease…

Apply for business credit…

Or get taken seriously by a landlord…

They either don't have an entity at all…

Or they've got a janky LLC from a budget formation site that's missing half of what it needs.

No registered agent. No business address. EIN maybe filed wrong.

And then they wonder why landlords ghost them.

Or why banks won't approve business credit.

Here's the thing most people don't realize…

Your LLC isn't just a legal formality.

It's the FOUNDATION of your funding eligibility.

Banks want to see a properly formed entity.

Landlords want to see a legitimate business.

And if your LLC looks like it was slapped together during a lunch break…

That's exactly how people will treat your application.

Now here's where it gets good.

Because I know what you're thinking.

"Great, so now I have to figure out which state to file in, what forms to submit, how to get an EIN, what a registered agent even IS, whether I need a business address…"

No. You don't.

You don't have to do ANY of that.

That's the whole point.

The team at 0percentfunded.com does it all FOR you.

Their flagship package — $699 plus your state filing fee — isn't just "formation."

Here's what they actually do:

— They file your LLC in your chosen state. Done for you.
— They obtain your EIN. Done for you.
— They set up your registered agent and business address. Done for you.
— They run your personalized Funding Snapshot. Done for you.
— They build your 90-Day Capital Gameplan — three phases, what to fix, in what order. Done for you.
— A real human walks you through everything on a 45–60 minute call.

Year-one compliance is included. After that it's $39/month, cancel anytime.

You don't fill out state forms. You don't sit on hold with the IRS. You don't watch a single YouTube tutorial about registered agents.

You don't have to become a legal expert to start a business.

You just have to learn how to find good deals and be a great host.

THAT'S where your time and energy should go.

Nothing is charged online. You pick your package on the call.

But before any of that…

The first step is free.

The 90-second Funding Snapshot.

Soft pull. Zero score impact. No credit card.

It tells you where you stand RIGHT NOW… and what your path to 0% business credit actually looks like.

Get Your Free Funding Snapshot → https://0percentfunded.com/

Because the arbitrage model works.

But it works a LOT better when your business foundation isn't held together with duct tape.

And it works BEST when you're not the one who had to tape it together.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d5",
    sequenceOrder: 8,
    dayOffset: 5,
    sendTimeEt: "14:00",
    body: `Real talk: the LLC paperwork is the part that stalls everyone. This team files your LLC, gets your EIN, sets up your registered agent - you never touch a form - then builds your 0% funding plan. See where you stand with their free 90-second check (won't touch your score): https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d7",
    sequenceOrder: 9,
    dayOffset: 7,
    sendTimeEt: "09:00",
    subject: "Will this wreck my credit score?",
    body: `Hey there,

I know what some of you are thinking.

"This sounds great, but I don't want anything messing with my credit score."

Fair.

Your score matters. Especially when you're getting ready to sign your first lease.

You need it for applications. For future financing. For life in general.

So let me be crystal clear about something.

The Funding Snapshot I've been telling you about?

It's a soft pull.

ZERO impact on your credit score.

It's the same kind of check that happens when you get those pre-approval mailers in the mail.

Nobody sees it. Nothing changes. Your score stays exactly where it is.

No credit card required. No obligation. No commitment.

You literally just answer a few questions for 90 seconds… and get your readiness score, estimated funding range, and a gameplan.

That's it.

Now let me tell you about Rochelle Zaldivar.

She's 24. Lives in Boca Raton.

When she started, she had NO LLC.

And she was genuinely afraid that going through any kind of funding process would tank her credit.

Sound familiar?

Here's the thing though.

She didn't have to figure any of it out alone.

Not which state to file in. Not the EIN. Not the funding sequence.

She put her trust in the team, followed the steps they laid out — entity setup, funding plan, application sequence — and they walked her through every one of them.

Her only job was to follow the plan.

And today it's even more hands-off. The Launch & Funded package files the LLC FOR you. Gets your EIN FOR you. Sets up your registered agent and business address FOR you.

No IRS hold music. No midnight registered-agent rabbit holes. No conflicting Reddit advice.

You follow the plan. They handle the paperwork.

She ended up with over $60,000 in 0% intro APR business credit…

Across THREE separate business accounts.

And she used that capital to furnish her first property.

At 24.

Starting from zero.

With the same fear YOU probably have right now.

The difference between Rochelle and most people reading this email…

Is she took the first step despite being scared.

And the first step didn't cost her anything.

Not a dollar. Not a credit point. Not even two minutes of her time.

Take the Free 90-Second Snapshot (Soft Pull, Zero Score Impact) → https://0percentfunded.com/

You've been studying this business. Learning the markets. Running the numbers in your head.

You don't need MORE homework.

You need someone to handle the setup so you can focus on what actually gets you to that first unit.

At least find out where you stand.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d7",
    sequenceOrder: 10,
    dayOffset: 7,
    sendTimeEt: "14:00",
    body: `Worried a funding check will hurt your credit? This one won't. It's the same type of check as when you look at your own score - invisible to lenders. Their client Rochelle was nervous too... then got approved for $60K+ at 0%. Free, takes 90 seconds: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d9",
    sequenceOrder: 11,
    dayOffset: 9,
    sendTimeEt: "09:00",
    subject: "240+ funded deals. 3 denials.",
    body: `Hey,

I've been telling you stories all week.

Today I'm just going to lay the numbers on the table.

Because at some point, you either trust the data or you don't.

Here's what 0percentfunded.com has tracked:

240+ fully funded deals.

Of 312 tracked deals… only 3 were denied.

Every other deal ended fully or partially funded.

Average funding amount: $27,105 at 0% intro APR.

Average client FICO score: 763.

Over $11 million secured across 500+ business owners.

4.6 out of 5 on Trustpilot.

Now think about that average for a second.

$27,105.

That's roughly the launch cost of your first arbitrage unit.

Meaning the average person who goes through this process…

Gets enough 0% capital to cover the deposits, the furniture, the supplies — and actually get started.

Some get WAY more.

Jaida got $120K. Judy got $50K at 20 years old. Rochelle got $60K+ at 24.

And then there's Donnetta Haynes.

She's an RN from Philadelphia who left the bedside.

She secured $31,000 at 0%.

And used it to cover the initial expenses of her first Airbnb listing in St. Louis…

Before her first guest even arrived.

Read that again.

She was FUNDED before she had a single booking.

That's the difference between hoping the math works out…

And KNOWING you have the capital to execute.

Now here's what I want you to notice about ALL these people.

Jaida. Judy. Rochelle. Donnetta.

None of them pieced together a funding strategy from YouTube videos and Reddit threads at midnight.

They worked with a team. Followed a plan built for their actual profile. Got walked through it, step by step, by a real human.

Their job was to focus on the business. The team's job was the strategy.

And for you, the done-for-you side goes even further — the Launch & Funded package files your LLC, gets your EIN, sets up your registered agent and business address, runs your Snapshot, and builds your 90-Day Capital Gameplan.

All of it. Done for you.

You handle the revenue. They handle the setup.

That's the whole model.

Every single one of these people — Jaida, Judy, Rochelle, Donnetta — they're all short-term rental operators.

This isn't some generic business funding play.

These are people doing exactly what YOU want to do.

And they all started in the same place you're in right now.

Before the first unit. Before the first guest. Before the first booking.

They just made sure the entity and the capital were handled FIRST.

So when they found the right deal… they could actually take it.

And they all started the same way.

With a free 90-second Funding Snapshot.

Soft pull. Zero score impact. No credit card. No obligation.

Get Your Free Funding Snapshot → https://0percentfunded.com/

The proof is there.

The done-for-you system is there.

The question is whether you're going to keep sitting on it.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded. Past client results are not a guarantee of future outcomes.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d9",
    sequenceOrder: 12,
    dayOffset: 9,
    sendTimeEt: "14:00",
    body: `Numbers on this funding team: 240+ clients fully funded, $27,105 average approval at 0% interest, 4.6/5 on Trustpilot. A track record, not a promise. Their free 90-second check estimates YOUR 0% range - zero impact on your credit: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d11",
    sequenceOrder: 13,
    dayOffset: 11,
    sendTimeEt: "09:00",
    subject: "Your \"money partner\" is eating your lunch",
    body: `Hey,

Let me paint a picture I see way too often.

You find a unit. Great location. The numbers check out. You KNOW it'll cash flow.

But you don't have the capital to launch it.

So what do you do?

You bring in a "money partner."

Someone who fronts the deposits, the furniture, the first month…

In exchange for 50% of the profits.

FIFTY. PERCENT.

Of a deal YOU found. A unit YOU'RE going to manage. Guests YOU'RE going to communicate with.

And that partner? They wrote a check and went back to the couch.

Look… I'm not saying partnerships are always bad.

Sometimes they make sense.

But when you're launching your FIRST unit?

Giving away half your business because you think it's the only way to get started…

That's not a partnership. That's a tax on not having a plan.

Judy Truong — the 20-year-old I told you about — she secured $50,000 in 0% intro APR business credit.

From real banks. Chase. Amex. Wells Fargo. Truist.

No partner. No equity split. No one asking for ownership of anything.

Her words: "No one asking for ownership of it."

That $50K was HERS. The business was HERS. Every dollar of profit… HERS.

And she was twenty years old with a thin credit file.

Meanwhile, some of you with 750+ scores are out here mentally rehearsing how to pitch a money partner…

For your FIRST deal.

That should sting a little.

(It's okay. It stung me too when I realized it.)

Here's the thing most people miss about 0percentfunded.com.

They don't just help you get funding.

They handle the stuff that makes funding POSSIBLE.

They file your LLC in your chosen state. Done for you.

They get your EIN. Done for you.

They set up your registered agent and business address. Done for you.

They run your Funding Snapshot and build your personalized 90-Day Capital Gameplan — three phases, what to fix, in what order.

Then a real human sits with you for 45–60 minutes and walks you through the whole thing.

You never have to fill out state forms. You never have to sit on hold with the IRS. You never have to google "what is a registered agent" at 1 AM.

You focus on learning the model and finding your first unit.

They handle the setup.

And the first step costs you absolutely nothing.

90-second Funding Snapshot. Soft pull. Zero score impact. No credit card.

You get your readiness score, estimated funding range, and your Gameplan.

Take the Free Funding Snapshot → https://0percentfunded.com/

Keep 100% of your first deal.

You're going to earn it.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d11",
    sequenceOrder: 14,
    dayOffset: 11,
    sendTimeEt: "14:00",
    body: `You don't need a money partner for your first unit. With 0% business credit you fund the launch yourself and keep 100% of the deal. They handle the LLC setup AND the funding plan. Free 90-second check, no credit impact: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d12",
    sequenceOrder: 15,
    dayOffset: 12,
    sendTimeEt: "09:00",
    subject: "Here's everything you get for $699",
    body: `Hey there,

I've been emailing you about 0percentfunded.com for almost two weeks now.

And I realized something.

I've told you the stories. Shown you the numbers. Explained the concept.

But I haven't actually laid out exactly what you GET.

Which is kind of a big miss on my part. So let me fix that right now.

No fluff. No buildup. Just the goods.

Their flagship package is called Launch & Funded LLC.

It's $699 plus your state filing fee.

Here's what's included:

— Done-for-you LLC filing in your chosen state
— Done-for-you EIN (Employer Identification Number)
— Year one of registered agent service + business address
— Your personalized Funding Snapshot with readiness score and estimated 0% funding range
— A 90-Day Capital Gameplan (three phases, what to fix, in what order)
— A 45–60 minute walkthrough call with a real human being
— Year-one compliance included

After month 12, it's $39/month for ongoing compliance. Cancel anytime.

That's it. That's the whole thing.

Now let me point out what you DON'T have to do.

You don't file state paperwork. They do it.

You don't sit on hold with the IRS for your EIN. They handle it.

You don't have to figure out what a registered agent is, or where to get a business address. It's included.

You don't have to guess what banks want to see, or in what order. That's what the Gameplan is for.

You don't have to piece it all together from YouTube videos and Reddit threads and hope you didn't miss a step.

You focus on learning the model and finding your first unit.

They handle the entity, the setup, and the funding roadmap.

And here's the part I really want you to hear…

Nothing is charged online.

You don't put in a credit card on some checkout page and hope for the best.

You take the free Snapshot first.

Then you hop on a call.

And on that call, you pick what makes sense for YOU.

If it's not a fit… you leave with your Snapshot, your readiness score, and your Gameplan. For free.

If it IS a fit… you choose your package right there on the call with a human who can actually answer your questions.

That's how it should work.

No pressure. No tricks. Just a conversation.

Start With the Free Snapshot → https://0percentfunded.com/

Now you know exactly what you're looking at.

The only question left is whether you want to find out where you stand.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d12",
    sequenceOrder: 16,
    dayOffset: 12,
    sendTimeEt: "14:00",
    body: `What it costs, once: $699 + your state filing fee. Full LLC setup - filing, EIN, registered agent, business address - plus your personal 0% funding plan and a real call with their team. Nothing charged online. Start with the free 90-second check: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d13",
    sequenceOrder: 17,
    dayOffset: 13,
    sendTimeEt: "09:00",
    subject: "Your questions, handled",
    body: `Real talk —

You've been reading these emails. You're interested.

But there's a handful of questions bouncing around your head that are keeping you from actually doing anything.

So let me just knock them out. Rapid fire.

"Will the Snapshot hurt my credit?"

No. It's a soft pull. Zero impact on your score. Same kind of check that happens when Capital One sends you junk mail. Nobody sees it. Nothing changes.

A hard pull only happens later — if and when YOU decide to actually apply at a bank. And that's entirely your choice.

"Do they guarantee I'll get funded?"

No. And honestly? Be very cautious of anyone who does.

What they give you is an estimated funding range based on real approval data from similar profiles. But banks make the final call. Always.

"I already have an LLC. Is this still for me?"

Yep. The Funding Snapshot and 90-Day Capital Gameplan work regardless of whether you need formation. If your LLC is already solid, they skip that part. You still get the funding roadmap.

"My credit history is thin. I'm young. Is this even realistic?"

Judy was 20 with a thin credit file. She got $50K at 0%.

Rochelle was 24. Got $60K+ across three accounts.

A thin file doesn't automatically mean a denial. It means you need the right strategy. Which is exactly what the Gameplan is for — three phases, what to fix, in what order.

"What does it cost to find out?"

Nothing.

The Snapshot is free. The readiness score is free. The estimated range is free. The Gameplan is free.

You don't pay a dime unless you decide — on a call, with a real human — that you want to move forward.

And even then, nothing is charged online. You pick your package on the call.

"What if I don't know anything about LLCs or EINs or registered agents?"

Perfect. That's literally what the done-for-you setup is for.

They file it. They get the EIN. They set up the registered agent and business address.

You never have to google "what is a registered agent." You never have to sit on hold with the IRS. You never have to wonder if you filled out a state form wrong.

You focus on finding your first unit. They handle the infrastructure.

Get Your Free Snapshot and Find Out Where You Stand → https://0percentfunded.com/

No more wondering.

Just answers.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d13",
    sequenceOrder: 18,
    dayOffset: 13,
    sendTimeEt: "14:00",
    body: `Quick answers: the free check never touches your credit score (a hard check only happens later IF you decide to apply at a bank). And if you already have an LLC, they build your funding plan around it. 90 seconds: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d14",
    sequenceOrder: 19,
    dayOffset: 14,
    sendTimeEt: "09:00",
    subject: "One approval ≈ your first unit launched",
    body: `Let me put something in perspective for you.

The average funding amount for 0percentfunded.com clients is $27,105.

At 0% intro APR.

Now think about what that number means in YOUR world.

If you're getting into arbitrage…

Your launch cost for a first unit — deposits, first month, furniture, supplies, photos — usually falls right around that range.

Which means the AVERAGE person going through this process…

Gets enough 0% capital to launch their first unit. Maybe even their second.

Without touching savings. Without a partner. Without maxing out personal cards and losing sleep.

And that's the AVERAGE.

Some people get way more. Jaida got $120K. Judy got $50K at 20 years old.

But even at the average…

You're looking at enough capital to actually GET IN THE GAME.

Not "research" the game. Not "plan to eventually start" the game.

Actually get in it.

Here's another number worth sitting with.

Of 312 tracked deals… only 3 were denied.

Three.

Every other deal ended fully or partially funded.

That's a 77% full-funding rate. And 99% funded at least partially.

Those aren't projections. That's tracked data from real clients.

Now… for those of you who already have your entity set up and want to move faster once you're ready…

They also have something called the Funding Sprint.

It's $1,500 — or three payments of $600.

It's a 60-day done-with-you program. They tell you which banks, what order, when to apply, how to manage utilization. Plus ongoing chat access throughout.

It's for people who have the foundation in place and just want to accelerate.

But for most of you reading this…

You're still at the starting line.

And that's totally fine.

Because the free Snapshot is still the right first step.

90 seconds. Soft pull. Zero score impact. No card.

You get your readiness score, your estimated funding range, and a 90-Day Capital Gameplan that tells you exactly what to do — three phases, what to fix, in what order.

Take the Free Funding Snapshot → https://0percentfunded.com/

The math is there.

The data is there.

The only thing missing is you actually checking.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded. Past client results are not a guarantee of future outcomes.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d14",
    sequenceOrder: 20,
    dayOffset: 14,
    sendTimeEt: "14:00",
    body: `Their average client is approved for $27,105 at 0% interest - that's deposit + furniture money for a first unit. Banks decide, results vary. The free 90-second check shows your estimated range without touching your credit: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d15",
    sequenceOrder: 21,
    dayOffset: 15,
    sendTimeEt: "09:00",
    subject: "What they CAN'T promise you",
    body: `Alright, I want to do something a little unusual today.

Instead of telling you why you SHOULD work with 0percentfunded.com…

I want to tell you what they CANNOT do.

Because I'd rather you trust them for the right reasons than sign up with the wrong expectations.

Here's what they cannot promise:

They cannot guarantee you'll get funded.

They cannot guarantee a specific dollar amount.

Banks make those decisions. Not them. Not me. Not anyone on a sales call.

And honestly?

If someone IS guaranteeing you a specific funding amount before they even know your profile…

Run.

That's a red flag the size of a billboard.

Now here's what they CAN do.

They can form your LLC properly. Done for you. Filed in your chosen state. With an EIN, registered agent, and business address.

No state forms for you to fill out. No IRS hold music. No googling "what is a registered agent" at midnight. No guessing whether you did it right.

They handle it.

They can give you a personalized Funding Snapshot based on real approval data from similar profiles.

They can build you a 90-Day Capital Gameplan — three phases, what to fix, in what order — so you know exactly what to do before you ever apply anywhere.

They can sit with you for 45–60 minutes on a real call and walk you through the whole thing.

And they can put you in the best possible position to get approved.

That's what they do. No more. No less.

You focus on learning the model and finding your first unit.

They handle the entity, the infrastructure, and the funding roadmap.

Here's exactly what happens when you take the Snapshot:

You answer a few quick questions. Takes about 90 seconds.

It runs a soft pull. Zero impact on your score.

You get a readiness score, an estimated funding range, and your Gameplan.

Then — if you want — you hop on a free call with a real person who walks you through your options.

Nothing is charged online. No card required. No obligation at any point.

If it's not a fit, you walk away with free data about where you stand.

If it IS a fit, you choose your package on the call.

That's it. That's the whole process.

Take the Free 90-Second Snapshot → https://0percentfunded.com/

I've sent you a lot of emails about this.

This one might be the most important.

Because the best partnerships start with honesty about what's actually on the table.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded. Past client results are not a guarantee of future outcomes.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d15",
    sequenceOrder: 22,
    dayOffset: 15,
    sendTimeEt: "14:00",
    body: `How it actually works: free 90-second check (no credit impact) -> you see your estimated 0% funding range -> free call with a real human who walks you through it. Nothing charged online, no pressure: https://0percentfunded.com/`,
  },
  {
    channel: "email",
    stepKey: "email_d16",
    sequenceOrder: 23,
    dayOffset: 16,
    sendTimeEt: "09:00",
    subject: "Last thing I'll say about this",
    body: `This is my last email about 0percentfunded.com.

I've said everything I can say.

I showed you the stories.

Jaida — $120K at 0%. Judy — $50K at 20 years old with a thin credit file. Rochelle — $60K+ at 24. Donnetta — funded before her first guest checked in.

I showed you the numbers.

240+ fully funded deals. Only 3 denials out of 312 tracked. $27K average at 0% intro APR. $11M+ secured across 500+ business owners.

I told you exactly what's included. Exactly what it costs. Exactly what they can and can't promise.

I answered the questions I knew you had.

And I was honest with you about all of it.

So at this point… it's not about information.

You have all the information.

It's about whether you're going to DO something with it.

Because here's what I know about most people in this space.

You've got the knowledge. You understand the model. You've watched the YouTube videos. You've run the practice numbers. You've probably even bookmarked listings you wish you could grab.

But you haven't launched yet.

And the thing standing between where you are and where you want to be…

Isn't more education.

It's a funded entity and a real plan.

That's it.

And the beautiful part?

You don't have to figure out the entity stuff yourself.

They file the LLC. They get the EIN. They set up the registered agent and business address. They build the Gameplan. They walk you through it on a real call.

You never touch a state form. You never sit on hold with the IRS. You never have to wonder if your entity is set up wrong.

You focus on finding your first unit.

They handle everything that needs to happen BEFORE that.

The Snapshot is free. It takes 90 seconds. Soft pull. Zero score impact. No credit card.

You literally have nothing to lose by finding out where you stand.

Take the Free Funding Snapshot → https://0percentfunded.com/

I hope you do it.

But either way… I'm rooting for you.

Go get your first unit.

Inayah

Disclosure: I partner with 0percentfunded.com and may be compensated if you choose to work with them. I only recommend them because my people keep getting funded. Past client results are not a guarantee of future outcomes.`,
  },
  {
    channel: "sms",
    stepKey: "sms_d16",
    sequenceOrder: 24,
    dayOffset: 16,
    sendTimeEt: "14:00",
    body: `One-breath recap, since my last email just went out: this team does your LLC paperwork FOR you and builds your 0% funding plan. 240+ clients funded, $27K average at 0%. The free 90-second check is where it starts: https://0percentfunded.com/`,
  },
  {
    channel: "sms",
    stepKey: "sms_d18",
    sequenceOrder: 25,
    dayOffset: 18,
    sendTimeEt: "14:00",
    body: `Last nudge, promise. If the money part is what's kept you from your first Airbnb - they handle the LLC paperwork, they build the funding plan, you go find your unit. The free check takes 90 seconds and won't touch your credit: https://0percentfunded.com/`,
  },
];
