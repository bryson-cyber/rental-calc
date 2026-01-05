# Airbnb Image URL Pattern

## Discovered Pattern
The Airbnb image URL pattern for listing photos is:
```
https://a0.muscache.com/im/pictures/prohost-api/Hosting-{LISTING_ID}/original/{IMAGE_UUID}.jpeg?im_w={WIDTH}
```

Example:
- Listing ID: 1214539418109523066
- Image URL: https://a0.muscache.com/im/pictures/prohost-api/Hosting-1214539418109523066/original/fde0b503-7c2e-4993-a701-d659f4d985cd.jpeg?im_w=720

## Problem
The image UUID (fde0b503-7c2e-4993-a701-d659f4d985cd) is unique per image and not predictable from the listing ID alone.

## Alternative Approach
Since we can't predict the image UUID, we have two options:
1. Scrape the Airbnb page to get the image URL (slow, may hit rate limits)
2. Use a placeholder/gradient image based on property type

## Decision
For now, use a styled placeholder with property type icon. In the future, could implement a server-side scraper that caches image URLs.
