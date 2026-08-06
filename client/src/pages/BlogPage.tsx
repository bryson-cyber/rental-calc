import { SEOHead, personSchema, organizationSchema, createBreadcrumbSchema, createFAQSchema } from '@/components/SEOHead';
import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Calendar, Clock, User, ChevronRight } from 'lucide-react';

// Blog post data
interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  content: string;
  faqs?: Array<{ question: string; answer: string }>;
}

const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-start-airbnb-rental-arbitrage-2026',
    title: 'How to Start an Airbnb Business with Rental Arbitrage in 2026',
    description: 'A step-by-step guide to starting your first Airbnb through rental arbitrage. Learn how to find properties, run the numbers, set up your listing, and build a profitable short-term rental business without buying property.',
    date: '2026-03-23',
    readTime: '12 min read',
    category: 'Getting Started',
    content: `
Starting an Airbnb business through rental arbitrage means renting a property on a long-term lease and then listing it as a short-term rental on platforms like Airbnb and VRBO. The difference between what you pay in rent and what you earn from guests is your profit.

This model works because short-term rental income is typically higher than long-term rent in the right markets. A two-bedroom apartment that rents for $1,500 per month might generate $3,000 to $4,500 per month on Airbnb, depending on the market, season, and how well you operate.

Here is how to get started, step by step.

## Step 1: Research Your Market

Before you sign any lease, you need to know whether short-term rentals are profitable in your target area. Not every city works. Some markets are oversaturated. Some have regulations that make it difficult or illegal.

Start by looking at three things:

**Average nightly rate.** What are similar properties in the area charging per night? Look at listings with the same number of bedrooms and similar quality.

**Occupancy rate.** What percentage of nights are those properties actually booked? A high nightly rate means nothing if the property sits empty half the month.

**Seasonality.** Does demand drop significantly in certain months? Some markets are strong year-round. Others have a busy season and a dead season. You need to be able to cover rent during the slow months.

You can research this manually by browsing Airbnb listings and checking their calendars, or you can use tools that aggregate market data. The Coach Inayah Turnkey Tool at coachinayahturnkeytool.com lets you search any U.S. market and see revenue projections, nightly rates, and occupancy data for free.

## Step 2: Run the Numbers

Once you have market data, calculate whether a specific property would be profitable.

**Monthly revenue estimate.** Take the average nightly rate and multiply by 30, then multiply by the average occupancy rate. For example: $150/night times 30 nights times 70% occupancy equals $3,150 per month.

**Monthly expenses.** Add up rent, utilities (electric, gas, water, internet, streaming services), cleaning fees (typically $75 to $150 per turnover), supplies (toiletries, coffee, paper products), software (pricing tools, channel managers), and insurance.

**Profit margin.** Subtract total expenses from revenue. If the margin is less than 25 to 30 percent of revenue, the deal is too tight. You need buffer for slow months, damages, and unexpected costs.

A common mistake is underestimating expenses. Budget for everything: the WiFi bill, the replacement towels, the guest who breaks a lamp. If the numbers only work when everything goes perfectly, the numbers do not work.

## Step 3: Find the Right Property

Not every rental is a good Airbnb. Look for properties with these characteristics:

**Location near demand drivers.** Proximity to downtown, hospitals, universities, tourist attractions, or business districts. Guests book properties that are convenient to where they need to be.

**Furnished-friendly layout.** Open floor plans, good natural light, and enough space for guests to be comfortable. Avoid properties with awkward layouts or tiny rooms.

**Landlord who allows subletting.** This is critical. You must have written permission from your landlord to operate a short-term rental. Some landlords are open to it, especially if you present it professionally. Others will say no. Do not try to do this without permission.

**Reasonable rent relative to market revenue.** Your rent should be no more than 40 to 50 percent of your projected monthly revenue. If rent is $2,000 and projected revenue is $3,500, the margins are too thin.

## Step 4: Set Up Your LLC

Before signing a lease, create a limited liability company. An LLC separates your personal assets from your business. If something goes wrong, a guest gets injured, or you face a legal dispute, your personal savings and property are protected.

You can form an LLC through your state's Secretary of State website or through services like LegalZoom or InkFile. The cost is typically $50 to $500 depending on the state.

Open a business bank account in your LLC's name. Keep all business income and expenses separate from your personal finances. This makes tax time easier and strengthens your liability protection.

## Step 5: Furnish and Photograph

The quality of your furnishing directly impacts your nightly rate and occupancy. Guests compare your listing to hotels and other Airbnbs. If your space looks like a college dorm, you will struggle.

**Furniture.** Invest in a quality mattress and bedding. This is the single most important purchase. Guests will forgive a lot, but they will not forgive a bad night of sleep. For everything else, Facebook Marketplace, IKEA, and Amazon are your friends. Budget $5,000 to $10,000 for a full furnish depending on the size of the property.

**Essentials.** Stock the kitchen with basic cookware, dishes, and utensils. Provide fresh towels, toiletries, a hair dryer, an iron, and a first aid kit. Think about what you would want if you were staying somewhere for a few days.

**Photography.** Professional photos are worth the investment. A $200 to $300 photo shoot will pay for itself many times over in higher booking rates. Clean the space thoroughly, stage it with fresh flowers or a bowl of fruit, and shoot during the day with natural light.

## Step 6: Create Your Listing

Write a clear, honest listing description. Include the number of bedrooms and bathrooms, the neighborhood, nearby attractions, parking information, and any house rules. Do not oversell. Guests who arrive expecting something different will leave bad reviews.

Set your pricing using a dynamic pricing tool like PriceLabs or Wheelhouse. These tools adjust your nightly rate based on demand, local events, day of the week, and what comparable listings are charging. Dynamic pricing can increase your revenue by 15 to 25 percent compared to a fixed rate.

Start with a slightly lower price for your first few bookings to attract guests and build reviews. Once you have 5 to 10 positive reviews, gradually increase your rates to market level.

## Step 7: Operate Professionally

**Communication.** Respond to guest messages within an hour. Set up automated messages for booking confirmations, check-in instructions, and checkout reminders. Most hosting platforms have built-in messaging tools, or you can use a channel manager.

**Cleaning.** Hire a reliable cleaning team. Create a detailed checklist that covers every room. Have cleaners send photos after each turnover so you can verify quality without being on-site. A dirty property is the fastest way to get bad reviews.

**Maintenance.** Have a handyman on call for minor repairs. Keep spare supplies (light bulbs, batteries, extra linens) at the property. Fix issues immediately. A broken coffee maker or a dripping faucet might seem minor to you, but it matters to a guest paying $150 a night.

## Common Mistakes to Avoid

**Skipping the market research.** Signing a lease based on a feeling instead of data is the most expensive mistake you can make. Run the numbers first. Every time.

**Choosing a cheap property in a bad location.** Low rent does not equal high profit. A $900 apartment in a neighborhood with no demand will make less money than a $1,800 apartment near downtown.

**Ignoring regulations.** Check your city's short-term rental laws before you start. Some cities require permits. Some limit the number of days you can rent. Some ban non-owner-occupied short-term rentals entirely. Getting shut down after you have invested $10,000 in furnishing is devastating.

**Trying to manage everything yourself.** You can handle one or two properties solo. Beyond that, you need systems: cleaning teams, automated messaging, dynamic pricing, and a maintenance plan. Build the systems early so you can scale without burning out.

## Getting Started Today

The barrier to entry for rental arbitrage is lower than most people think. You do not need to buy property. You do not need a real estate license. You need savings for the first month's rent, security deposit, and furnishing. You need decent credit to sign a lease. And you need to do your homework on the market.

Start by researching one city. Use the free tools at coachinayahturnkeytool.com to check revenue projections. Look at what properties are available for rent. Run the numbers on two or three options. If the math works, take the next step.

The people who succeed in this business are not the ones who jump in fastest. They are the ones who do the research, run the numbers, and make informed decisions. The data is available. Use it.
    `,
    faqs: [
      {
        question: 'What is rental arbitrage?',
        answer: 'Rental arbitrage is renting a property on a long-term lease and listing it as a short-term rental on platforms like Airbnb and VRBO. The difference between your lease payment and short-term rental income is your profit. It allows you to start an Airbnb business without buying property.'
      },
      {
        question: 'How much does it cost to start an Airbnb through rental arbitrage?',
        answer: 'Typical startup costs range from $5,000 to $15,000 per property. This includes first month rent, security deposit, furnishing, supplies, and photography. The exact amount depends on the property size and your market.'
      },
      {
        question: 'Is rental arbitrage legal?',
        answer: 'Rental arbitrage is legal in many cities, but regulations vary. Some cities require short-term rental permits, some limit the number of rental days, and some ban non-owner-occupied short-term rentals. Always check your local regulations and get written permission from your landlord before starting.'
      },
      {
       question: 'How much can you make with Airbnb rental arbitrage?',
        answer: 'Profit varies by market, property, and how well you operate. A typical one-bedroom apartment might generate $500 to $1,500 per month in profit after all expenses. Larger properties in strong markets could profit $1,000 to $3,000 per month. Use market data tools to estimate revenue for specific properties before committing.'
      },
      {
        question: 'Do I need an LLC for Airbnb rental arbitrage?',
        answer: 'While not legally required in most states, an LLC is strongly recommended. It separates your personal assets from your business, providing liability protection. If a guest is injured or you face a legal dispute, your personal savings and property are protected. Formation costs are typically $50 to $500 depending on the state.'
      }
    ]
  }
];

function BlogIndex() {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' }
  ]);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Blog - Short-Term Rental Insights"
        description="Expert insights on Airbnb rental arbitrage, property management, and building a profitable short-term rental business. By Coach Inayah (Inayah McMillan)."
        canonicalPath="/blog"
        structuredData={[organizationSchema, personSchema, breadcrumbSchema]}
        keywords={['Coach Inayah blog', 'Airbnb rental arbitrage', 'short-term rental tips', 'Inayah McMillan', 'rental arbitrage guide']}
      />

      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Tool
          </Link>
          <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            About Coach Inayah
          </Link>
        </div>
      </header>

      {/* Blog Header */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">
          Coach Inayah Blog
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl">
          Insights on short-term rentals, rental arbitrage, and building a profitable Airbnb business. Written by Inayah McMillan.
        </p>
      </div>

      {/* Blog Posts */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="space-y-8">
          {BLOG_POSTS.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="group border border-gray-200 rounded-xl p-6 md:p-8 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                  <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 group-hover:text-amber-700 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 line-clamp-2">
                  {post.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-amber-700 text-sm font-medium">
                  Read article <ChevronRight className="w-4 h-4" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Coach Inayah. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function BlogPostView({ slug }: { slug: string }) {
  const post = BLOG_POSTS.find(p => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
          <Link href="/blog" className="text-amber-700 hover:underline">Back to blog</Link>
        </div>
      </div>
    );
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Person',
      name: 'Inayah McMillan',
      alternateName: 'Coach Inayah',
      url: 'https://coachinayahturnkeytool.com/about'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Coach Inayah',
      url: 'https://coachinayahturnkeytool.com'
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://coachinayahturnkeytool.com/blog/${post.slug}`
    }
  };

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: post.title, url: `/blog/${post.slug}` }
  ]);

  const schemas: object[] = [articleSchema, personSchema, breadcrumbSchema];
  if (post.faqs) {
    schemas.push(createFAQSchema(post.faqs));
  }

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title={post.title}
        description={post.description}
        canonicalPath={`/blog/${post.slug}`}
        ogType="article"
        structuredData={schemas}
        keywords={['Coach Inayah', 'Inayah McMillan', 'rental arbitrage', 'Airbnb business', 'short-term rental']}
      />

      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All posts
          </Link>
          <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            About Coach Inayah
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
          <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {post.category}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4 leading-tight">
          {post.title}
        </h1>

        {/* Author */}
        <div className="flex items-center gap-3 mb-10 pb-10 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <User className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Inayah McMillan</p>
            <p className="text-xs text-gray-500">Coach Inayah &middot; Founder of Stayly</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-lg prose-gray max-w-none
          prose-headings:font-serif prose-headings:text-gray-900
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-p:text-gray-700 prose-p:leading-relaxed
          prose-strong:text-gray-900
          prose-a:text-amber-700 prose-a:no-underline hover:prose-a:underline
          prose-li:text-gray-700
        ">
          {post.content.split('\n\n').map((block, i) => {
            const trimmed = block.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith('## ')) {
              return <h2 key={i}>{trimmed.replace('## ', '')}</h2>;
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return <p key={i}><strong>{trimmed.replace(/\*\*/g, '')}</strong></p>;
            }
            if (trimmed.startsWith('**')) {
              // Bold start paragraph
              const parts = trimmed.split('**');
              return (
                <p key={i}>
                  {parts.map((part, j) => 
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
                </p>
              );
            }
            return <p key={i}>{trimmed}</p>;
          })}
        </div>

        {/* FAQ Section */}
        {post.faqs && post.faqs.length > 0 && (
          <div className="mt-16 pt-10 border-t border-gray-200">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {post.faqs.map((faq, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 bg-amber-50 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to run the numbers?
          </h3>
          <p className="text-gray-600 mb-6">
            Use the free rental revenue calculator to check how much any property could earn.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors">
            Try the Free Calculator
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Coach Inayah. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function BlogPage({ slug }: { slug?: string }) {
  if (slug) {
    return <BlogPostView slug={slug} />;
  }
  return <BlogIndex />;
}
