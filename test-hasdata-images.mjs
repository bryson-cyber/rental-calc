// Test HasData API to see what image data is returned
import 'dotenv/config';

const apiKey = process.env.HASDATA_API_KEY;

async function testHasDataImages() {
  const keyword = "Scottsdale, AZ";
  const type = "forRent";
  
  const queryParams = new URLSearchParams();
  queryParams.set("keyword", keyword);
  queryParams.set("type", type);
  
  const url = `https://api.hasdata.com/scrape/zillow/listing?${queryParams.toString()}`;
  
  console.log("Testing HasData API for image data...");
  console.log("URL:", url);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    }
  });
  
  const data = await response.json();
  
  // Check first property for all image-related fields
  if (data.properties && data.properties.length > 0) {
    const prop = data.properties[0];
    console.log("\n=== First Property ===");
    console.log("Address:", prop.streetAddress || prop.address);
    console.log("Price:", prop.price);
    
    console.log("\n=== Image Fields ===");
    console.log("imgSrc:", prop.imgSrc);
    console.log("image:", prop.image);
    console.log("thumbnail:", prop.thumbnail);
    console.log("photos:", prop.photos);
    console.log("carouselPhotos:", prop.carouselPhotos);
    console.log("hiResImageLink:", prop.hiResImageLink);
    console.log("mediumImageLink:", prop.mediumImageLink);
    console.log("smallImageLink:", prop.smallImageLink);
    
    console.log("\n=== All Keys ===");
    console.log(Object.keys(prop));
    
    // Log full property object
    console.log("\n=== Full Property Object ===");
    console.log(JSON.stringify(prop, null, 2));
  }
}

testHasDataImages().catch(console.error);
